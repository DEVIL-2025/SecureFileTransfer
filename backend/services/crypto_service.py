import os
import hashlib
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import serialization, hashes

RSA_PRIVATE_KEY_PATH = "private_key.pem"
RSA_PUBLIC_KEY_PATH = "public_key.pem"

def ensure_rsa_keys():
    """Generates server RSA key pair if not already present on disk."""
    if not os.path.exists(RSA_PRIVATE_KEY_PATH) or not os.path.exists(RSA_PUBLIC_KEY_PATH):
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048
        )
        public_key = private_key.public_key()
        
        with open(RSA_PRIVATE_KEY_PATH, "wb") as f:
            f.write(private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            ))
            
        with open(RSA_PUBLIC_KEY_PATH, "wb") as f:
            f.write(public_key.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo
            ))
        print("Generated new RSA key pair.")

def generate_user_rsa_keys(username=None):
    """Generates a user RSA public/private key pair in PEM format."""
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048
    )
    public_key = private_key.public_key()
    
    priv_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    ).decode('utf-8')
    
    pub_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode('utf-8')
    
    return pub_pem, priv_pem

def encrypt_file_data(file_bytes: bytes):
    """
    Encrypts file data using a hybrid cryptographic scheme:
    1. Generates a unique ephemeral AES symmetric key (Fernet).
    2. Encrypts the raw file payload with the AES key.
    3. Wraps the AES key using the server's RSA Public Key (OAEP SHA-256).
    Returns (encrypted_data_bytes, hex_wrapped_key, sha256_hash).
    """
    ensure_rsa_keys()
    
    aes_key = Fernet.generate_key()
    cipher = Fernet(aes_key)
    encrypted_data = cipher.encrypt(file_bytes)
    
    file_hash = hashlib.sha256(file_bytes).hexdigest()
    
    with open(RSA_PUBLIC_KEY_PATH, "rb") as f:
        public_key = serialization.load_pem_public_key(f.read())
        
    encrypted_key = public_key.encrypt(
        aes_key,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )
    
    return encrypted_data, encrypted_key.hex(), file_hash

def decrypt_file_data(encrypted_bytes: bytes, hex_wrapped_key: str) -> bytes:
    """
    Decrypts stored file data using the server's RSA Private Key:
    1. Unwraps the AES key with RSA-OAEP.
    2. Decrypts the file ciphertext with the recovered AES key.
    """
    ensure_rsa_keys()
    
    with open(RSA_PRIVATE_KEY_PATH, "rb") as f:
        private_key = serialization.load_pem_private_key(f.read(), password=None)
        
    encrypted_key = bytes.fromhex(hex_wrapped_key)
    
    aes_key = private_key.decrypt(
        encrypted_key,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )
    
    cipher = Fernet(aes_key)
    decrypted_data = cipher.decrypt(encrypted_bytes)
    return decrypted_data
