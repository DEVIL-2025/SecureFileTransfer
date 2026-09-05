import hashlib
import uuid
import unittest
from backend.app import create_app
from backend.database.connection import execute_query, init_db, get_db_connection

class RealtimeTransferTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db_available = False
        try:
            conn = get_db_connection()
            conn.close()
            cls.db_available = True
        except Exception:
            cls.db_available = False

    def setUp(self):
        if not self.db_available:
            self.skipTest("Live PostgreSQL database not reachable.")
        self.app, self.socketio = create_app()
        self.app.config['TESTING'] = True
        init_db()
        self.uid = uuid.uuid4().hex[:8]

        # Register two users: sender and receiver
        self.sender_username = f"sender_{self.uid}"
        self.receiver_username = f"receiver_{self.uid}"

        client = self.app.test_client()
        client.post('/api/auth/register', json={
            'username': self.sender_username,
            'email': f"{self.sender_username}@test.com",
            'password': 'password123'
        })
        client.post('/api/auth/register', json={
            'username': self.receiver_username,
            'email': f"{self.receiver_username}@test.com",
            'password': 'password123'
        })

    def _create_authenticated_socket_clients(self):
        # Create authenticated Flask test clients with session cookies
        client_sender = self.app.test_client()
        client_sender.post('/api/auth/login', json={
            'identifier': self.sender_username,
            'password': 'password123'
        })

        client_receiver = self.app.test_client()
        client_receiver.post('/api/auth/login', json={
            'identifier': self.receiver_username,
            'password': 'password123'
        })

        # Connect via SocketIO test clients
        s_sock = self.socketio.test_client(self.app, flask_test_client=client_sender)
        r_sock = self.socketio.test_client(self.app, flask_test_client=client_receiver)

        self.assertTrue(s_sock.is_connected())
        self.assertTrue(r_sock.is_connected())
        return s_sock, r_sock

    def test_01_webrtc_signaling_relay(self):
        """Test that WebRTC offer, answer, and ICE candidates relay between authenticated peers."""
        s_sock, r_sock = self._create_authenticated_socket_clients()

        # Sender sends WebRTC offer to Receiver
        s_sock.emit('webrtc_offer', {
            'to': self.receiver_username,
            'sdp': {'type': 'offer', 'sdp': 'v=0\r\no=sender 123...'}
        })

        received_events = r_sock.get_received()
        offer_event = next((e for e in received_events if e['name'] == 'webrtc_offer'), None)
        self.assertIsNotNone(offer_event)
        self.assertEqual(offer_event['args'][0]['from'], self.sender_username)
        self.assertEqual(offer_event['args'][0]['sdp']['type'], 'offer')

        # Receiver sends WebRTC answer to Sender
        r_sock.emit('webrtc_answer', {
            'to': self.sender_username,
            'sdp': {'type': 'answer', 'sdp': 'v=0\r\no=receiver 456...'}
        })

        s_received = s_sock.get_received()
        answer_event = next((e for e in s_received if e['name'] == 'webrtc_answer'), None)
        self.assertIsNotNone(answer_event)
        self.assertEqual(answer_event['args'][0]['from'], self.receiver_username)
        self.assertEqual(answer_event['args'][0]['sdp']['type'], 'answer')

        # Receiver sends ICE candidate
        r_sock.emit('webrtc_ice_candidate', {
            'to': self.sender_username,
            'candidate': {'candidate': 'candidate:1 1 UDP 2130706431 ...', 'sdpMid': 'data'}
        })

        s_received_ice = s_sock.get_received()
        ice_event = next((e for e in s_received_ice if e['name'] == 'webrtc_ice_candidate'), None)
        self.assertIsNotNone(ice_event)
        self.assertEqual(ice_event['args'][0]['from'], self.receiver_username)

        s_sock.disconnect()
        r_sock.disconnect()

    def test_02_binary_chunk_transfer_exact_integrity(self):
        """
        Verify binary-safe chunk streaming for multiple file formats:
        TXT, PDF, JPG, PNG, MP4, ZIP, DOCX.
        Assert SHA-256 byte-for-byte exact equality between sender and receiver.
        """
        s_sock, r_sock = self._create_authenticated_socket_clients()

        test_files = [
            ('document.txt', b"Plain text file test with UTF-8 data: \xc3\xa9\xc3\xa0\xc3\xbc", 'text/plain'),
            ('report.pdf', b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n%%EOF", 'application/pdf'),
            ('photo.jpg', b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00\x08", 'image/jpeg'),
            ('graphic.png', b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x10\x00\x00\x00\x10\x08\x06\x00\x00\x00", 'image/png'),
            ('video.mp4', b"\x00\x00\x00\x1cftypisom\x00\x00\x02\x00isomiso2mp41\x00\x00\x00\x08free", 'video/mp4'),
            ('archive.zip', b"PK\x03\x04\x14\x00\x00\x00\x08\x00\x00\x00!\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00", 'application/zip'),
            ('manual.docx', b"PK\x03\x04\x14\x00\x06\x00\x08\x00\x00\x00!\x00[Content_Types].xml", 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        ]

        for filename, raw_bytes, mime in test_files:
            orig_sha256 = hashlib.sha256(raw_bytes).hexdigest()
            transfer_id = f"tx_{uuid.uuid4().hex}"

            # 1. Sender initiates transfer request
            s_sock.emit('file_send_request', {
                'to': self.receiver_username,
                'transferId': transfer_id,
                'fileName': filename,
                'totalSize': len(raw_bytes),
                'mimeType': mime
            })

            r_events = r_sock.get_received()
            incoming = next((e for e in r_events if e['name'] == 'incoming_file'), None)
            self.assertIsNotNone(incoming, f"Failed incoming_file for {filename}")
            self.assertEqual(incoming['args'][0]['transferId'], transfer_id)

            # 2. Receiver accepts transfer request
            r_sock.emit('file_accept', {
                'to': self.sender_username,
                'transferId': transfer_id,
                'fileName': filename,
                'totalSize': len(raw_bytes)
            })

            s_events = s_sock.get_received()
            start_ev = next((e for e in s_events if e['name'] == 'start_file_transfer'), None)
            self.assertIsNotNone(start_ev, f"Failed start_file_transfer for {filename}")

            # 3. Stream binary chunks over WebSocket relay
            # Chunking into 16-byte slices to test multiple frames and reassembly
            chunk_size = 16
            received_bytes_list = []

            for offset in range(0, len(raw_bytes), chunk_size):
                chunk_slice = raw_bytes[offset:offset + chunk_size]
                is_last = (offset + chunk_size) >= len(raw_bytes)

                meta = {
                    'to': self.receiver_username,
                    'transferId': transfer_id,
                    'fileName': filename,
                    'isLast': is_last,
                    'totalSize': len(raw_bytes),
                    'mimeType': mime
                }

                s_sock.emit('file_chunk_binary', meta, chunk_slice)

                r_chunk_events = r_sock.get_received()
                chunk_ev = next((e for e in r_chunk_events if e['name'] == 'receive_chunk_binary'), None)
                self.assertIsNotNone(chunk_ev, f"Failed receive_chunk_binary at offset {offset}")

                rec_meta, rec_bytes = chunk_ev['args']
                self.assertEqual(rec_meta['transferId'], transfer_id)
                self.assertEqual(rec_meta['isLast'], is_last)
                received_bytes_list.append(rec_bytes)

            assembled_bytes = b"".join(received_bytes_list)
            rec_sha256 = hashlib.sha256(assembled_bytes).hexdigest()

            # Byte-for-byte SHA256 integrity verification
            self.assertEqual(orig_sha256, rec_sha256, f"SHA-256 hash mismatch for {filename}!")
            self.assertEqual(raw_bytes, assembled_bytes, f"Binary mismatch for {filename}!")

        s_sock.disconnect()
        r_sock.disconnect()

    def test_03_transfer_rejection(self):
        """Test transfer rejection lifecycle."""
        s_sock, r_sock = self._create_authenticated_socket_clients()
        transfer_id = f"tx_rej_{uuid.uuid4().hex}"

        s_sock.emit('file_send_request', {
            'to': self.receiver_username,
            'transferId': transfer_id,
            'fileName': 'declined.pdf',
            'totalSize': 1024
        })

        r_events = r_sock.get_received()
        incoming = next((e for e in r_events if e['name'] == 'incoming_file'), None)
        self.assertIsNotNone(incoming)

        r_sock.emit('file_reject', {
            'to': self.sender_username,
            'transferId': transfer_id
        })

        s_events = s_sock.get_received()
        rejected = next((e for e in s_events if e['name'] == 'file_rejected'), None)
        self.assertIsNotNone(rejected)
        self.assertEqual(rejected['args'][0]['transferId'], transfer_id)

        s_sock.disconnect()
        r_sock.disconnect()

    def test_04_transfer_cancellation(self):
        """Test in-progress transfer cancellation."""
        s_sock, r_sock = self._create_authenticated_socket_clients()
        transfer_id = f"tx_cancel_{uuid.uuid4().hex}"

        s_sock.emit('cancel_transfer', {
            'to': self.receiver_username,
            'transferId': transfer_id
        })

        r_events = r_sock.get_received()
        cancelled = next((e for e in r_events if e['name'] == 'transfer_cancelled'), None)
        self.assertIsNotNone(cancelled)
        self.assertEqual(cancelled['args'][0]['from'], self.sender_username)

        s_sock.disconnect()
        r_sock.disconnect()

    def test_05_transfer_completion_and_deduplication(self):
        """
        Verify that transfer completion increments user sent/received counts
        and records to transfers table exactly once without duplicates.
        """
        s_sock, r_sock = self._create_authenticated_socket_clients()
        transfer_id = f"tx_dedup_{uuid.uuid4().hex}"

        # Initialize transfer request and acceptance
        s_sock.emit('file_send_request', {
            'to': self.receiver_username,
            'transferId': transfer_id,
            'fileName': 'verified.zip',
            'totalSize': 4096
        })
        _ = r_sock.get_received()

        r_sock.emit('file_accept', {
            'to': self.sender_username,
            'transferId': transfer_id,
            'fileName': 'verified.zip',
            'totalSize': 4096
        })
        _ = s_sock.get_received()

        # Send last chunk (which triggers completion)
        meta = {
            'to': self.receiver_username,
            'transferId': transfer_id,
            'fileName': 'verified.zip',
            'isLast': True,
            'totalSize': 4096
        }
        s_sock.emit('file_chunk_binary', meta, b"x" * 128)
        _ = r_sock.get_received()

        # Also emit p2p_transfer_completed with same transfer_id (simulating both triggers)
        r_sock.emit('p2p_transfer_completed', {
            'to': self.sender_username,
            'transferId': transfer_id,
            'fileName': 'verified.zip',
            'totalSize': 4096
        })

        # Check DB: transfers table must contain exactly 1 entry for this transfer
        rows = execute_query(
            "SELECT sender, receiver, filename, file_size, status FROM transfers WHERE sender = %s AND receiver = %s",
            (self.sender_username, self.receiver_username),
            fetchall=True
        )
        self.assertEqual(len(rows), 1, "There should be exactly one transfer record (deduplicated).")
        self.assertEqual(rows[0]['filename'], 'verified.zip')
        self.assertEqual(rows[0]['status'], 'completed')

        # Check user stats: sent=1, received=1
        s_user = execute_query("SELECT sent, received FROM users WHERE username = %s", (self.sender_username,), fetchone=True)
        r_user = execute_query("SELECT sent, received FROM users WHERE username = %s", (self.receiver_username,), fetchone=True)
        self.assertEqual(s_user['sent'], 1)
        self.assertEqual(r_user['received'], 1)

        s_sock.disconnect()
        r_sock.disconnect()

if __name__ == '__main__':
    unittest.main()
