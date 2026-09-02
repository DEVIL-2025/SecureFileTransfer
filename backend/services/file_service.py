import os
import uuid
from werkzeug.utils import secure_filename
from backend.config import Config
from backend.database.connection import execute_query
from backend.services.crypto_service import encrypt_file_data, decrypt_file_data

def is_allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS

def save_and_encrypt_file(file_storage, username):
    """
    Saves an uploaded file to disk after encrypting it.
    """
    if not file_storage or file_storage.filename == '':
        return False, "No file selected."
        
    orig_filename = secure_filename(file_storage.filename)
    if not is_allowed_file(orig_filename):
        return False, f"File extension not allowed. Allowed extensions: {', '.join(Config.ALLOWED_EXTENSIONS)}"
        
    os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
    
    unique_name = f"{uuid.uuid4()}_{orig_filename}"
    disk_path = os.path.join(Config.UPLOAD_FOLDER, unique_name)
    
    # Read raw bytes
    raw_data = file_storage.read()
    file_size = len(raw_data)
    mime_type = file_storage.mimetype or 'application/octet-stream'
    
    # Encrypt data using hybrid crypto
    encrypted_bytes, hex_wrapped_key, _ = encrypt_file_data(raw_data)
    
    # Write encrypted bytes to disk
    with open(disk_path, "wb") as f:
        f.write(encrypted_bytes)
        
    # Insert record into database
    execute_query(
        """
        INSERT INTO files (filename, original_filename, file_size, mime_type, username, file_key)
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        (unique_name, orig_filename, file_size, mime_type, username, hex_wrapped_key)
    )
    
    execute_query(
        "INSERT INTO audit_logs (username, action, details) VALUES (%s, %s, %s)",
        (username, "FILE_UPLOAD", f"Uploaded and encrypted {orig_filename} ({file_size} bytes)")
    )
    
    return True, "File uploaded and encrypted successfully."

def get_file_for_download(file_id, username):
    """
    Verifies user permissions (owner or shared), decrypts file data and returns (decrypted_bytes, filename, mime_type).
    """
    file_record = execute_query(
        "SELECT * FROM files WHERE id = %s",
        (file_id,),
        fetchone=True
    )
    
    if not file_record:
        return None, "File record not found in database."
        
    owner = file_record.get("username") if isinstance(file_record, dict) else file_record[5]
    filename = file_record.get("filename") if isinstance(file_record, dict) else file_record[1]
    orig_filename = file_record.get("original_filename") if isinstance(file_record, dict) else file_record[2]
    file_key = file_record.get("file_key") if isinstance(file_record, dict) else file_record[6]
    mime_type = file_record.get("mime_type") if isinstance(file_record, dict) else file_record[4]
    
    # Authorization check
    if owner != username:
        shared = execute_query(
            "SELECT id FROM shared_files WHERE file_id = %s AND shared_with = %s",
            (file_id, username),
            fetchone=True
        )
        if not shared:
            return None, "Unauthorized: You do not have permission to download this file."
            
    disk_path = os.path.join(Config.UPLOAD_FOLDER, filename)
    if not os.path.exists(disk_path):
        return None, "File not found on storage disk."
        
    with open(disk_path, "rb") as f:
        encrypted_bytes = f.read()
        
    try:
        decrypted_bytes = decrypt_file_data(encrypted_bytes, file_key)
    except Exception as e:
        return None, f"Decryption failed: {str(e)}"
        
    execute_query(
        "INSERT INTO audit_logs (username, action, details) VALUES (%s, %s, %s)",
        (username, "FILE_DOWNLOAD", f"Downloaded {orig_filename}")
    )
    
    return {
        "data": decrypted_bytes,
        "filename": orig_filename,
        "mime_type": mime_type
    }, None

def delete_user_file(file_id, username):
    """
    Deletes the file from disk and database, cascading to shared_files.
    """
    file_record = execute_query(
        "SELECT * FROM files WHERE id = %s",
        (file_id,),
        fetchone=True
    )
    
    if not file_record:
        return False, "File not found."
        
    owner = file_record.get("username") if isinstance(file_record, dict) else file_record[5]
    filename = file_record.get("filename") if isinstance(file_record, dict) else file_record[1]
    orig_filename = file_record.get("original_filename") if isinstance(file_record, dict) else file_record[2]
    
    if owner != username:
        return False, "Unauthorized: Only the file owner can delete this file."
        
    disk_path = os.path.join(Config.UPLOAD_FOLDER, filename)
    if os.path.exists(disk_path):
        try:
            os.remove(disk_path)
        except OSError:
            pass
            
    # Delete sharing records & file record
    execute_query("DELETE FROM shared_files WHERE file_id = %s", (file_id,))
    execute_query("DELETE FROM files WHERE id = %s", (file_id,))
    
    execute_query(
        "INSERT INTO audit_logs (username, action, details) VALUES (%s, %s, %s)",
        (username, "FILE_DELETE", f"Deleted {orig_filename}")
    )
    
    return True, "File deleted successfully."

def share_user_file(file_id, owner_username, target_username):
    """
    Shares a file with another registered user.
    """
    target_username = target_username.strip()
    if target_username == owner_username:
        return False, "You cannot share a file with yourself."
        
    # Check if target user exists
    target = execute_query(
        "SELECT id FROM users WHERE username = %s",
        (target_username,),
        fetchone=True
    )
    if not target:
        return False, f"User '{target_username}' does not exist."
        
    # Check ownership
    file_record = execute_query(
        "SELECT username, original_filename FROM files WHERE id = %s",
        (file_id,),
        fetchone=True
    )
    if not file_record:
        return False, "File not found."
        
    owner = file_record.get("username") if isinstance(file_record, dict) else file_record[0]
    orig_filename = file_record.get("original_filename") if isinstance(file_record, dict) else file_record[1]
    
    if owner != owner_username:
        return False, "Unauthorized: Only the owner can share this file."
        
    # Check if already shared
    existing = execute_query(
        "SELECT id FROM shared_files WHERE file_id = %s AND shared_with = %s",
        (file_id, target_username),
        fetchone=True
    )
    if existing:
        return False, f"File is already shared with {target_username}."
        
    execute_query(
        "INSERT INTO shared_files (file_id, shared_by, shared_with) VALUES (%s, %s, %s)",
        (file_id, owner_username, target_username)
    )
    
    execute_query(
        "INSERT INTO audit_logs (username, action, details) VALUES (%s, %s, %s)",
        (owner_username, "FILE_SHARE", f"Shared {orig_filename} with {target_username}")
    )
    
    return True, f"File successfully shared with {target_username}."

def list_user_files(username):
    my_files = execute_query(
        """
        SELECT id, filename, original_filename, file_size, mime_type, created_at
        FROM files WHERE username = %s ORDER BY id DESC
        """,
        (username,),
        fetchall=True
    )
    
    shared_files = execute_query(
        """
        SELECT f.id, f.filename, f.original_filename, f.file_size, f.mime_type, s.shared_by, s.created_at
        FROM files f
        JOIN shared_files s ON f.id = s.file_id
        WHERE s.shared_with = %s
        ORDER BY s.id DESC
        """,
        (username,),
        fetchall=True
    )
    
    return my_files or [], shared_files or []
