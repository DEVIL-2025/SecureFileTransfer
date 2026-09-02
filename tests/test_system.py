import os
import io
import unittest
import uuid
from datetime import datetime, timedelta
from backend.config import Config
from backend.app import create_app
from backend.database.connection import execute_query, init_db
from backend.services.crypto_service import encrypt_file_data, decrypt_file_data
from backend.services.contact_service import (
    generate_connection_key,
    consume_connection_key,
    get_user_contacts,
    remove_contact
)

class SecureFileTransferTestCase(unittest.TestCase):
    def setUp(self):
        self.test_db = f"test_{uuid.uuid4().hex}.db"
        Config.DATABASE_URL = f"sqlite:///{self.test_db}"
        self.app, self.socketio = create_app()
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()
        init_db()
        
    def tearDown(self):
        if os.path.exists(self.test_db):
            try:
                os.remove(self.test_db)
            except OSError:
                pass

    def test_01_user_registration(self):
        # Valid registration
        res = self.client.post('/api/auth/register', json={
            'username': 'alice',
            'email': 'alice@example.com',
            'password': 'password123'
        })
        self.assertEqual(res.status_code, 201)
        self.assertTrue(res.get_json()['success'])

        # Duplicate username
        res2 = self.client.post('/api/auth/register', json={
            'username': 'alice',
            'email': 'alice2@example.com',
            'password': 'password123'
        })
        self.assertEqual(res2.status_code, 400)

        # Duplicate email
        res3 = self.client.post('/api/auth/register', json={
            'username': 'alice_new',
            'email': 'alice@example.com',
            'password': 'password123'
        })
        self.assertEqual(res3.status_code, 400)

    def test_02_user_login(self):
        # Register user
        self.client.post('/api/auth/register', json={
            'username': 'bob',
            'email': 'bob@example.com',
            'password': 'secretpassword'
        })

        # Login with username
        res = self.client.post('/api/auth/login', json={
            'identifier': 'bob',
            'password': 'secretpassword'
        })
        self.assertEqual(res.status_code, 200)

        # Login with email
        res2 = self.client.post('/api/auth/login', json={
            'identifier': 'bob@example.com',
            'password': 'secretpassword'
        })
        self.assertEqual(res2.status_code, 200)

        # Login with wrong password
        res3 = self.client.post('/api/auth/login', json={
            'identifier': 'bob',
            'password': 'wrongpassword'
        })
        self.assertEqual(res3.status_code, 401)

    def test_03_stored_file_encryption_and_decryption(self):
        original_plaintext = b"Confidential Final Year B.Tech Research Data 2026."
        encrypted_bytes, hex_wrapped_key, orig_hash = encrypt_file_data(original_plaintext)

        # Verify ciphertext is different from plaintext
        self.assertNotEqual(original_plaintext, encrypted_bytes)

        # Decrypt using RSA private key
        decrypted_plaintext = decrypt_file_data(encrypted_bytes, hex_wrapped_key)
        self.assertEqual(original_plaintext, decrypted_plaintext)

    def test_04_file_upload_download_share_delete_lifecycle(self):
        # Register Alice and Charlie
        self.client.post('/api/auth/register', json={'username': 'alice', 'email': 'alice@test.com', 'password': 'password123'})
        self.client.post('/api/auth/register', json={'username': 'charlie', 'email': 'charlie@test.com', 'password': 'password123'})

        # Login as Alice
        self.client.post('/api/auth/login', json={'identifier': 'alice', 'password': 'password123'})

        # Upload file as Alice
        file_content = b"Top secret document content for cloud storage."
        data = {
            'file': (io.BytesIO(file_content), 'research.txt')
        }
        res_upload = self.client.post('/api/files/upload', data=data, content_type='multipart/form-data')
        self.assertEqual(res_upload.status_code, 201)

        # List files
        res_list = self.client.get('/api/files')
        self.assertEqual(res_list.status_code, 200)
        my_files = res_list.get_json()['my_files']
        self.assertEqual(len(my_files), 1)
        file_id = my_files[0]['id']

        # Download file as Alice & verify content
        res_download = self.client.get(f'/api/files/download/{file_id}')
        self.assertEqual(res_download.status_code, 200)
        self.assertEqual(res_download.data, file_content)

        # Login as Charlie (not shared yet)
        self.client.post('/api/auth/login', json={'identifier': 'charlie', 'password': 'password123'})
        res_unauthorized = self.client.get(f'/api/files/download/{file_id}')
        self.assertEqual(res_unauthorized.status_code, 403)

        # Login as Alice and share with Charlie
        self.client.post('/api/auth/login', json={'identifier': 'alice', 'password': 'password123'})
        res_share = self.client.post(f'/api/files/share/{file_id}', json={'username': 'charlie'})
        self.assertEqual(res_share.status_code, 200)

        # Login as Charlie and download shared file
        self.client.post('/api/auth/login', json={'identifier': 'charlie', 'password': 'password123'})
        res_shared_download = self.client.get(f'/api/files/download/{file_id}')
        self.assertEqual(res_shared_download.status_code, 200)
        self.assertEqual(res_shared_download.data, file_content)

        # Login as Alice and delete the file
        self.client.post('/api/auth/login', json={'identifier': 'alice', 'password': 'password123'})
        res_delete = self.client.post(f'/api/files/delete/{file_id}')
        self.assertEqual(res_delete.status_code, 200)

        # Verify file is deleted
        res_list_after = self.client.get('/api/files')
        self.assertEqual(len(res_list_after.get_json()['my_files']), 0)

    def test_05_connection_key_generation_and_consumption(self):
        # Register User A (Alice) and User B (Bob)
        self.client.post('/api/auth/register', json={'username': 'alice', 'email': 'alice@keytest.com', 'password': 'password123'})
        self.client.post('/api/auth/register', json={'username': 'bob', 'email': 'bob@keytest.com', 'password': 'password123'})

        # Login as Alice and generate connection key
        self.client.post('/api/auth/login', json={'identifier': 'alice', 'password': 'password123'})
        res_key = self.client.post('/api/contacts/key', json={'expiry_minutes': 15})
        self.assertEqual(res_key.status_code, 201)
        key_data = res_key.get_json()
        raw_key = key_data['key']
        self.assertRegex(raw_key, r'^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$')

        # Login as Bob and consume Alice's key
        self.client.post('/api/auth/login', json={'identifier': 'bob', 'password': 'password123'})
        res_consume = self.client.post('/api/contacts/key/consume', json={'key': raw_key})
        self.assertEqual(res_consume.status_code, 200)
        consume_data = res_consume.get_json()
        self.assertTrue(consume_data['success'])
        self.assertEqual(consume_data['contact']['username'], 'alice')

        # Check Bob's contacts list
        res_contacts_bob = self.client.get('/api/contacts')
        self.assertEqual(res_contacts_bob.status_code, 200)
        bob_contacts = res_contacts_bob.get_json()['contacts']
        self.assertEqual(len(bob_contacts), 1)
        self.assertEqual(bob_contacts[0]['username'], 'alice')

        # Check Alice's contacts list (bidirectional symmetric pairing)
        self.client.post('/api/auth/login', json={'identifier': 'alice', 'password': 'password123'})
        res_contacts_alice = self.client.get('/api/contacts')
        self.assertEqual(res_contacts_alice.status_code, 200)
        alice_contacts = res_contacts_alice.get_json()['contacts']
        self.assertEqual(len(alice_contacts), 1)
        self.assertEqual(alice_contacts[0]['username'], 'bob')

    def test_06_connection_key_security_edge_cases(self):
        # Register Alice, Bob, and Dave
        self.client.post('/api/auth/register', json={'username': 'alice', 'email': 'alice@sec.com', 'password': 'password123'})
        self.client.post('/api/auth/register', json={'username': 'bob', 'email': 'bob@sec.com', 'password': 'password123'})
        self.client.post('/api/auth/register', json={'username': 'dave', 'email': 'dave@sec.com', 'password': 'password123'})

        # Alice generates key
        self.client.post('/api/auth/login', json={'identifier': 'alice', 'password': 'password123'})
        res_key = self.client.post('/api/contacts/key', json={'expiry_minutes': 15})
        raw_key = res_key.get_json()['key']

        # 1. Alice attempts self-connection with own key
        res_self = self.client.post('/api/contacts/key/consume', json={'key': raw_key})
        self.assertEqual(res_self.status_code, 400)
        self.assertIn("own key", res_self.get_json()['error'])

        # 2. Bob attempts invalid key
        self.client.post('/api/auth/login', json={'identifier': 'bob', 'password': 'password123'})
        res_invalid = self.client.post('/api/contacts/key/consume', json={'key': 'INVALID-KEY-1234'})
        self.assertEqual(res_invalid.status_code, 400)
        self.assertIn("Invalid connection key", res_invalid.get_json()['error'])

        # 3. Bob consumes Alice's key successfully
        res_ok = self.client.post('/api/contacts/key/consume', json={'key': raw_key})
        self.assertEqual(res_ok.status_code, 200)

        # 4. Dave attempts to consume the already-used key
        self.client.post('/api/auth/login', json={'identifier': 'dave', 'password': 'password123'})
        res_reused = self.client.post('/api/contacts/key/consume', json={'key': raw_key})
        self.assertEqual(res_reused.status_code, 400)
        self.assertIn("already been used", res_reused.get_json()['error'])

        # 5. Bob tries to connect with Alice again (already connected)
        self.client.post('/api/auth/login', json={'identifier': 'alice', 'password': 'password123'})
        res_key2 = self.client.post('/api/contacts/key')
        raw_key2 = res_key2.get_json()['key']
        self.client.post('/api/auth/login', json={'identifier': 'bob', 'password': 'password123'})
        res_dup = self.client.post('/api/contacts/key/consume', json={'key': raw_key2})
        self.assertEqual(res_dup.status_code, 400)
        self.assertIn("already connected", res_dup.get_json()['error'])

    def test_07_trusted_contacts_persistence_and_removal(self):
        # Register Alice and Bob
        self.client.post('/api/auth/register', json={'username': 'alice', 'email': 'alice@rem.com', 'password': 'password123'})
        self.client.post('/api/auth/register', json={'username': 'bob', 'email': 'bob@rem.com', 'password': 'password123'})

        # Connect via key
        self.client.post('/api/auth/login', json={'identifier': 'alice', 'password': 'password123'})
        raw_key = self.client.post('/api/contacts/key').get_json()['key']
        self.client.post('/api/auth/login', json={'identifier': 'bob', 'password': 'password123'})
        self.client.post('/api/contacts/key/consume', json={'key': raw_key})

        # Verify Bob has Alice in contacts
        res_list = self.client.get('/api/contacts')
        self.assertEqual(len(res_list.get_json()['contacts']), 1)

        # Remove Alice from Bob's contacts
        res_del = self.client.delete('/api/contacts/alice')
        self.assertEqual(res_del.status_code, 200)

        # Verify Bob's list is empty
        res_list_bob_after = self.client.get('/api/contacts')
        self.assertEqual(len(res_list_bob_after.get_json()['contacts']), 0)

        # Verify Alice's list is also empty (symmetric removal)
        self.client.post('/api/auth/login', json={'identifier': 'alice', 'password': 'password123'})
        res_list_alice_after = self.client.get('/api/contacts')
        self.assertEqual(len(res_list_alice_after.get_json()['contacts']), 0)

    def test_08_profile_updation_every_detail(self):
        # 1. Register test user
        self.client.post('/api/auth/register', json={
            'username': 'olduser',
            'email': 'olduser@test.com',
            'password': 'password123'
        })
        self.client.post('/api/auth/login', json={'identifier': 'olduser', 'password': 'password123'})

        # 2. Update Username & Email
        res_up = self.client.post('/api/users/update-profile', json={
            'username': 'newuser',
            'email': 'newemail@test.com'
        })
        self.assertEqual(res_up.status_code, 200)
        self.assertTrue(res_up.get_json()['success'])

        # 3. Verify Profile reflection
        res_prof = self.client.get('/api/users/profile')
        self.assertEqual(res_prof.get_json()['username'], 'newuser')
        self.assertEqual(res_prof.get_json()['email'], 'newemail@test.com')

        # 4. Update Password with wrong current password (should fail)
        res_pw_fail = self.client.post('/api/users/update-profile', json={
            'currentPassword': 'wrongpassword',
            'newPassword': 'newsecurepassword123'
        })
        self.assertEqual(res_pw_fail.status_code, 400)
        self.assertIn('incorrect', res_pw_fail.get_json()['error'])

        # 5. Update Password with correct current password (should succeed)
        res_pw_ok = self.client.post('/api/users/update-profile', json={
            'currentPassword': 'password123',
            'newPassword': 'newsecurepassword123'
        })
        self.assertEqual(res_pw_ok.status_code, 200)

        # 6. Verify login with new password and new username
        self.client.post('/api/auth/logout')
        res_login_new = self.client.post('/api/auth/login', json={
            'identifier': 'newuser',
            'password': 'newsecurepassword123'
        })
        self.assertEqual(res_login_new.status_code, 200)
        self.assertTrue(res_login_new.get_json()['success'])
        self.assertEqual(res_login_new.get_json()['user']['username'], 'newuser')

if __name__ == '__main__':
    unittest.main()


