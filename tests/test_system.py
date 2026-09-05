import os
import io
import uuid
import unittest
from datetime import datetime, timedelta
from backend.config import Config
from backend.app import create_app
from backend.database.connection import execute_query, init_db, get_db_connection
from backend.services.contact_service import (
    generate_connection_key,
    consume_connection_key,
    get_user_contacts,
    remove_contact
)

class ServerStorageDecommissionedTestCase(unittest.TestCase):
    def test_no_server_storage_artifacts(self):
        """Verify that server-side upload directory and RSA key files do not exist."""
        self.assertFalse(os.path.exists("uploads"), "uploads directory should not exist")
        self.assertFalse(os.path.exists("private_key.pem"), "private_key.pem should not exist")
        self.assertFalse(os.path.exists("public_key.pem"), "public_key.pem should not exist")

class SecureFileTransferTestCase(unittest.TestCase):
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
        self.client = self.app.test_client()
        init_db()
        self.uid = uuid.uuid4().hex[:8]

    def test_01_user_registration(self):
        user = f"alice_{self.uid}"
        email = f"alice_{self.uid}@example.com"
        
        # Valid registration
        res = self.client.post('/api/auth/register', json={
            'username': user,
            'email': email,
            'password': 'password123'
        })
        self.assertEqual(res.status_code, 201)
        self.assertTrue(res.get_json()['success'])

        # Duplicate username
        res2 = self.client.post('/api/auth/register', json={
            'username': user,
            'email': f"alt_{email}",
            'password': 'password123'
        })
        self.assertEqual(res2.status_code, 400)

    def test_02_user_authentication_and_session(self):
        user = f"bob_{self.uid}"
        email = f"bob_{self.uid}@example.com"
        
        # Register user
        self.client.post('/api/auth/register', json={
            'username': user,
            'email': email,
            'password': 'securepassword'
        })

        # Login with correct credentials
        res = self.client.post('/api/auth/login', json={
            'identifier': user,
            'password': 'securepassword'
        })
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.get_json()['success'])
        self.assertEqual(res.get_json()['user']['username'], user)

        # Check authenticated session
        res_me = self.client.get('/api/auth/me')
        self.assertEqual(res_me.status_code, 200)
        self.assertEqual(res_me.get_json()['user']['username'], user)

        # Logout
        res_logout = self.client.post('/api/auth/logout')
        self.assertEqual(res_logout.status_code, 200)

        # Me should now indicate unauthenticated
        res_me_after = self.client.get('/api/auth/me')
        self.assertEqual(res_me_after.status_code, 200)
        self.assertFalse(res_me_after.get_json()['authenticated'])

    def test_04_server_file_storage_removed_and_transfer_activity(self):
        user = f"transuser_{self.uid}"
        email = f"trans_{self.uid}@example.com"
        
        # Register & Login
        self.client.post('/api/auth/register', json={
            'username': user,
            'email': email,
            'password': 'password123'
        })
        self.client.post('/api/auth/login', json={
            'identifier': user,
            'password': 'password123'
        })

        # Verify obsolete server file storage routes return 404
        res_upload = self.client.post('/api/files/upload', data={'file': (io.BytesIO(b'data'), 'test.txt')})
        self.assertEqual(res_upload.status_code, 404, "Server file upload route must return 404")

        res_list = self.client.get('/api/files')
        self.assertEqual(res_list.status_code, 404, "Server file list route must return 404")

        res_download = self.client.get('/api/files/download/1')
        self.assertEqual(res_download.status_code, 404, "Server file download route must return 404")

        # Verify transfer history endpoint functions correctly
        res_transfers = self.client.get('/api/users/transfers')
        self.assertEqual(res_transfers.status_code, 200)
        self.assertIsInstance(res_transfers.get_json(), list)

        # Verify clear transfers endpoint
        res_clear = self.client.post('/api/users/transfers/clear')
        self.assertEqual(res_clear.status_code, 200)
        self.assertTrue(res_clear.get_json()['success'])

    def test_05_connection_key_generation_and_consumption(self):
        u1 = f"alice_key_{self.uid}"
        u2 = f"bob_key_{self.uid}"
        
        self.client.post('/api/auth/register', json={'username': u1, 'email': f"{u1}@keytest.com", 'password': 'password123'})
        self.client.post('/api/auth/register', json={'username': u2, 'email': f"{u2}@keytest.com", 'password': 'password123'})

        self.client.post('/api/auth/login', json={'identifier': u1, 'password': 'password123'})
        res_key = self.client.post('/api/contacts/key', json={'expiry_minutes': 15})
        self.assertEqual(res_key.status_code, 201)
        key_data = res_key.get_json()
        raw_key = key_data['key']
        self.assertRegex(raw_key, r'^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$')

        self.client.post('/api/auth/login', json={'identifier': u2, 'password': 'password123'})
        res_consume = self.client.post('/api/contacts/key/consume', json={'key': raw_key})
        self.assertEqual(res_consume.status_code, 200)
        consume_data = res_consume.get_json()
        self.assertTrue(consume_data['success'])
        self.assertEqual(consume_data['contact']['username'], u1)

        res_contacts_bob = self.client.get('/api/contacts')
        self.assertEqual(res_contacts_bob.status_code, 200)
        bob_contacts = res_contacts_bob.get_json()['contacts']
        self.assertTrue(any(c['username'] == u1 for c in bob_contacts))

    def test_06_connection_key_security_edge_cases(self):
        user = f"eve_sec_{self.uid}"
        self.client.post('/api/auth/register', json={'username': user, 'email': f"{user}@sectest.com", 'password': 'password123'})
        self.client.post('/api/auth/login', json={'identifier': user, 'password': 'password123'})

        res_key = self.client.post('/api/contacts/key', json={'expiry_minutes': 15})
        raw_key = res_key.get_json()['key']

        res_self = self.client.post('/api/contacts/key/consume', json={'key': raw_key})
        self.assertEqual(res_self.status_code, 400)
        self.assertIn("own key", res_self.get_json()['error'].lower())

        res_invalid = self.client.post('/api/contacts/key/consume', json={'key': 'XXXX-XXXX-XXXX'})
        self.assertEqual(res_invalid.status_code, 400)

    def test_07_trusted_contacts_persistence_and_removal(self):
        u1 = f"user_x_{self.uid}"
        u2 = f"user_y_{self.uid}"
        
        self.client.post('/api/auth/register', json={'username': u1, 'email': f"{u1}@pair.com", 'password': 'password123'})
        self.client.post('/api/auth/register', json={'username': u2, 'email': f"{u2}@pair.com", 'password': 'password123'})

        self.client.post('/api/auth/login', json={'identifier': u1, 'password': 'password123'})
        key = self.client.post('/api/contacts/key', json={'expiry_minutes': 15}).get_json()['key']

        self.client.post('/api/auth/login', json={'identifier': u2, 'password': 'password123'})
        self.client.post('/api/contacts/key/consume', json={'key': key})

        res_list = self.client.get('/api/contacts')
        self.assertTrue(any(c['username'] == u1 for c in res_list.get_json()['contacts']))

        res_remove = self.client.delete(f'/api/contacts/{u1}')
        self.assertEqual(res_remove.status_code, 200)

        res_list_after = self.client.get('/api/contacts')
        self.assertFalse(any(c['username'] == u1 for c in res_list_after.get_json()['contacts']))

    def test_08_profile_updation_every_detail(self):
        orig_user = f"profileuser_orig_{self.uid}"
        new_user = f"profileuser_new_{self.uid}"
        orig_email = f"profile_orig_{self.uid}@example.com"
        new_email = f"profile_new_{self.uid}@example.com"
        
        self.client.post('/api/auth/register', json={
            'username': orig_user,
            'email': orig_email,
            'password': 'oldpassword123'
        })

        self.client.post('/api/auth/login', json={
            'identifier': orig_user,
            'password': 'oldpassword123'
        })

        res_up = self.client.post('/api/users/update-profile', json={
            'current_password': 'oldpassword123',
            'username': new_user,
            'email': new_email,
            'new_password': 'newpassword123'
        })
        self.assertEqual(res_up.status_code, 200)
        self.assertEqual(res_up.get_json()['user']['username'], new_user)
        self.assertEqual(res_up.get_json()['user']['email'], new_email)

if __name__ == '__main__':
    unittest.main()
