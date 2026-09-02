import threading
import time
from flask import request, session
from flask_socketio import emit, join_room, leave_room
from backend.database.connection import execute_query

# active_users stores username -> set of active SIDs (supporting multiple browser tabs per user)
active_users = {}
active_connections = set()  # set of (u1, u2) tuples

# Grace period tracking for transient page refreshes: username -> timer
_disconnect_timers = {}
GRACE_PERIOD_SECONDS = 15

def register_socket_handlers(socketio):

    def _cleanup_user_connections(username):
        if username not in active_users:
            to_remove = [c for c in active_connections if c[0] == username or c[1] == username]
            for c in to_remove:
                active_connections.discard(c)
                peer = c[1] if c[0] == username else c[0]
                socketio.emit('user_disconnected', {'user': username}, room=peer)

    @socketio.on('connect')
    def handle_connect():
        username = session.get('username')
        if not username:
            return False
            
        sid = request.sid
        if username not in active_users:
            active_users[username] = set()
        active_users[username].add(sid)
        
        # Cancel any pending disconnect cleanup timer if user reconnected quickly
        if username in _disconnect_timers:
            timer = _disconnect_timers.pop(username)
            if timer and timer.is_alive():
                timer.cancel()
        
        # Join user's personal room for multi-tab message broadcasting
        join_room(username)
        
        # Broadcast online users to everyone
        socketio.emit('update_users', list(active_users.keys()))
        
        # Restore existing active peer connections for this user with currently online peers
        restored = [u2 for (u1, u2) in active_connections if u1 == username and u2 in active_users]
        emit('restore_connections', restored)
        
        # Symmetrically notify online peers that this user reconnected
        for peer in restored:
            socketio.emit('request_accepted', {'peer': username, 'from': username}, room=peer)

    @socketio.on('disconnect')
    def handle_disconnect():
        sid = request.sid
        username = session.get('username')
        
        if username and username in active_users:
            active_users[username].discard(sid)
            leave_room(username)
            if len(active_users[username]) == 0:
                del active_users[username]
                t = threading.Timer(GRACE_PERIOD_SECONDS, _cleanup_user_connections, args=[username])
                _disconnect_timers[username] = t
                t.start()
                
        socketio.emit('update_users', list(active_users.keys()))

    # --- P2P Connection Signaling ---

    @socketio.on('send_request')
    def handle_send_request(data):
        sender = session.get('username')
        receiver = data.get('to')
        if not sender or not receiver or receiver not in active_users:
            return
            
        if (sender, receiver) in active_connections:
            emit('request_accepted', {'peer': receiver, 'from': receiver}, room=sender)
            emit('request_accepted', {'peer': sender, 'from': sender}, room=receiver)
            return
            
        emit('receive_request', {'from': sender}, room=receiver)

    @socketio.on('accept_request')
    def handle_accept_request(data):
        receiver = session.get('username')
        sender = data.get('to')
        if not sender or not receiver:
            return
            
        active_connections.add((sender, receiver))
        active_connections.add((receiver, sender))
        
        emit('request_accepted', {'peer': receiver, 'from': receiver}, room=sender)
        emit('request_accepted', {'peer': sender, 'from': receiver}, room=receiver)

    @socketio.on('reject_request')
    def handle_reject_request(data):
        sender = data.get('to')
        receiver = session.get('username')
        if sender:
            emit('request_rejected', {'from': receiver}, room=sender)

    # --- E2EE Public Key Exchange (ECDH) ---

    @socketio.on('ecdh_key_exchange')
    def handle_ecdh_key_exchange(data):
        sender = session.get('username')
        receiver = data.get('to')
        public_key_jwk = data.get('publicKey')
        
        if not sender or not receiver or receiver not in active_users:
            return
            
        emit('ecdh_key_exchange', {
            'from': sender,
            'publicKey': public_key_jwk
        }, room=receiver)

    # --- WebRTC P2P Signaling (Offer, Answer, ICE Candidates) ---

    @socketio.on('webrtc_offer')
    def handle_webrtc_offer(data):
        sender = session.get('username')
        receiver = data.get('to')
        if not sender or not receiver or receiver not in active_users:
            return
        emit('webrtc_offer', {
            'from': sender,
            'sdp': data.get('sdp')
        }, room=receiver)

    @socketio.on('webrtc_answer')
    def handle_webrtc_answer(data):
        sender = session.get('username')
        receiver = data.get('to')
        if not sender or not receiver or receiver not in active_users:
            return
        emit('webrtc_answer', {
            'from': sender,
            'sdp': data.get('sdp')
        }, room=receiver)

    @socketio.on('webrtc_ice_candidate')
    def handle_webrtc_ice_candidate(data):
        sender = session.get('username')
        receiver = data.get('to')
        if not sender or not receiver or receiver not in active_users:
            return
        emit('webrtc_ice_candidate', {
            'from': sender,
            'candidate': data.get('candidate')
        }, room=receiver)

    # --- Real-Time File Transfer Events ---

    @socketio.on('file_send_request')
    def handle_file_send_request(data):
        sender = session.get('username')
        receiver = data.get('to')
        if not sender or not receiver or receiver not in active_users:
            return
            
        emit('incoming_file', {
            'from': sender,
            'fileName': data.get('fileName'),
            'totalSize': data.get('totalSize'),
            'mimeType': data.get('mimeType'),
            'transport': data.get('transport', 'P2P')
        }, room=receiver)

    @socketio.on('file_accept')
    def handle_file_accept(data):
        receiver = session.get('username')
        sender = data.get('to')
        if sender:
            emit('start_file_transfer', {
                'from': receiver,
                'fileName': data.get('fileName'),
                'totalSize': data.get('totalSize')
            }, room=sender)

    @socketio.on('file_reject')
    def handle_file_reject(data):
        receiver = session.get('username')
        sender = data.get('to')
        if sender:
            emit('file_rejected', {'from': receiver}, room=sender)

    @socketio.on('file_chunk')
    def handle_file_chunk(data):
        sender = session.get('username')
        receiver = data.get('to')
        if not sender or not receiver or receiver not in active_users:
            return
            
        is_last = data.get('isLast', False)
        if is_last:
            filename = data.get('fileName')
            total_size = data.get('totalSize', 0)
            
            execute_query("UPDATE users SET sent = sent + 1 WHERE username = %s", (sender,))
            execute_query("UPDATE users SET received = received + 1 WHERE username = %s", (receiver,))
            execute_query(
                """
                INSERT INTO transfers (sender, receiver, filename, file_size, status)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (sender, receiver, filename, total_size, 'completed')
            )
            
        emit('receive_chunk', data, room=receiver)

    @socketio.on('ack_chunk')
    def handle_ack_chunk(data):
        sender = data.get('to')
        if sender:
            emit('next_chunk', data, room=sender)

    @socketio.on('transfer_progress_sync')
    def handle_transfer_progress_sync(data):
        sender = session.get('username')
        receiver = data.get('to')
        if receiver:
            emit('transfer_progress_sync', {
                'receivedBytes': data.get('receivedBytes'),
                'totalBytes': data.get('totalBytes'),
                'from': sender
            }, room=receiver)

    @socketio.on('p2p_transfer_completed')
    def handle_p2p_transfer_completed(data):
        """Records transfer completion metrics when streaming over WebRTC P2P."""
        sender = session.get('username')
        receiver = data.get('to')
        filename = data.get('fileName')
        total_size = data.get('totalSize', 0)
        
        if sender and receiver:
            execute_query("UPDATE users SET sent = sent + 1 WHERE username = %s", (sender,))
            execute_query("UPDATE users SET received = received + 1 WHERE username = %s", (receiver,))
            execute_query(
                """
                INSERT INTO transfers (sender, receiver, filename, file_size, status)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (sender, receiver, filename, total_size, 'completed')
            )
            emit('transfer_finished_sync', {'fileName': filename, 'from': sender}, room=receiver)
            emit('transfer_finished_sync', {'fileName': filename, 'from': sender}, room=sender)

    @socketio.on('cancel_transfer')
    def handle_cancel_transfer(data):
        receiver = data.get('to')
        sender = session.get('username')
        if receiver:
            emit('transfer_cancelled', {'from': sender}, room=receiver)
            emit('transfer_cancelled', {'from': sender}, room=sender)

    @socketio.on('disconnect_user')
    def handle_disconnect_user(data):
        from_user = session.get('username')
        to_user = data.get('to')
        if not from_user or not to_user:
            return
            
        active_connections.discard((from_user, to_user))
        active_connections.discard((to_user, from_user))
        
        emit('user_disconnected', {'user': to_user}, room=from_user)
        emit('user_disconnected', {'user': from_user}, room=to_user)
