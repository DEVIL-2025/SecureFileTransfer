import secrets
import string
import hashlib
import time
from datetime import datetime, timedelta, timezone
from backend.database.connection import execute_query, get_db
from backend.socket.transfer_socket import active_users

# In-memory rate limiting: identifier (username or IP) -> list of failed timestamps
_failed_attempts = {}
MAX_FAILED_ATTEMPTS = 5
RATE_LIMIT_WINDOW_SECONDS = 60

# Unambiguous characters for readable connection keys (excluding 0, O, 1, I, L)
KEY_CHARSET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"

def _get_utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)

def _hash_key(raw_key: str) -> str:
    """Normalizes and hashes raw key with SHA-256."""
    normalized = raw_key.replace("-", "").replace(" ", "").strip().upper()
    return hashlib.sha256(normalized.encode('utf-8')).hexdigest()

def _check_rate_limit(identifier: str) -> bool:
    """Returns True if identifier is rate limited."""
    now = time.time()
    attempts = _failed_attempts.get(identifier, [])
    valid_attempts = [t for t in attempts if now - t < RATE_LIMIT_WINDOW_SECONDS]
    _failed_attempts[identifier] = valid_attempts
    return len(valid_attempts) >= MAX_FAILED_ATTEMPTS

def _record_failed_attempt(identifier: str):
    now = time.time()
    attempts = _failed_attempts.get(identifier, [])
    attempts.append(now)
    _failed_attempts[identifier] = attempts

def generate_connection_key(owner_username: str, expiry_minutes: int = 15):
    """
    Generates a one-time cryptographically secure pairing key (format: XXXX-XXXX-XXXX).
    Stores only the SHA-256 hash in the database.
    Invalidates any previous unconsumed key for this user.
    """
    execute_query(
        "DELETE FROM connection_keys WHERE owner_username = %s AND used_at IS NULL",
        (owner_username,)
    )
    
    chars = [secrets.choice(KEY_CHARSET) for _ in range(12)]
    raw_key = f"{''.join(chars[0:4])}-{''.join(chars[4:8])}-{''.join(chars[8:12])}"
    key_hash = _hash_key(raw_key)
    
    now = _get_utc_now()
    expires_at = now + timedelta(minutes=expiry_minutes)
    
    execute_query(
        """
        INSERT INTO connection_keys (owner_username, key_hash, expires_at)
        VALUES (%s, %s, %s)
        """,
        (owner_username, key_hash, expires_at)
    )
    
    # ISO 8601 UTC with explicit 'Z' suffix
    iso_str = expires_at.strftime("%Y-%m-%dT%H:%M:%SZ")
    
    return {
        'raw_key': raw_key,
        'expires_at': iso_str,
        'expires_in_seconds': int(expiry_minutes * 60)
    }

def get_active_connection_key(owner_username: str):
    """
    Retrieves the current active unexpired and unconsumed key info if one exists.
    """
    row = execute_query(
        """
        SELECT id, expires_at, created_at
        FROM connection_keys
        WHERE owner_username = %s AND used_at IS NULL
        ORDER BY id DESC LIMIT 1
        """,
        (owner_username,),
        fetchone=True
    )
    if not row:
        return None
        
    expires_at = row.get('expires_at') if isinstance(row, dict) else row[1]
    if isinstance(expires_at, str):
        try:
            exp_dt = datetime.fromisoformat(expires_at.replace("Z", ""))
        except Exception:
            try:
                exp_dt = datetime.strptime(expires_at, "%Y-%m-%d %H:%M:%S")
            except Exception:
                exp_dt = _get_utc_now()
    else:
        exp_dt = expires_at
        
    if hasattr(exp_dt, 'tzinfo') and exp_dt.tzinfo is not None:
        exp_dt = exp_dt.astimezone(timezone.utc).replace(tzinfo=None)
        
    now = _get_utc_now()
    if exp_dt < now:
        return None
        
    remaining_seconds = max(0, int((exp_dt - now).total_seconds()))
    iso_str = exp_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    return {
        'has_active_key': True,
        'expires_at': iso_str,
        'expires_in_seconds': remaining_seconds
    }

def consume_connection_key(consumer_username: str, raw_key: str, client_ip: str = "127.0.0.1"):
    """
    Atomically consumes a connection key and establishes a persistent trusted contact pair.
    """
    rate_limit_key = f"{consumer_username}:{client_ip}"
    if _check_rate_limit(rate_limit_key):
        return False, "Too many connection attempts. Please wait a minute and try again.", None

    if not raw_key or len(raw_key.strip()) < 8:
        _record_failed_attempt(rate_limit_key)
        return False, "Invalid connection key format.", None

    key_hash = _hash_key(raw_key)
    
    key_row = execute_query(
        """
        SELECT id, owner_username, expires_at, used_at, used_by
        FROM connection_keys
        WHERE key_hash = %s
        """,
        (key_hash,),
        fetchone=True
    )
    
    if not key_row:
        _record_failed_attempt(rate_limit_key)
        return False, "Invalid connection key.", None
        
    key_id = key_row.get('id') if isinstance(key_row, dict) else key_row[0]
    owner_username = key_row.get('owner_username') if isinstance(key_row, dict) else key_row[1]
    expires_at = key_row.get('expires_at') if isinstance(key_row, dict) else key_row[2]
    used_at = key_row.get('used_at') if isinstance(key_row, dict) else key_row[3]
    
    if used_at is not None:
        _record_failed_attempt(rate_limit_key)
        return False, "This connection key has already been used.", None
        
    if isinstance(expires_at, str):
        try:
            exp_dt = datetime.fromisoformat(expires_at.replace("Z", ""))
        except Exception:
            try:
                exp_dt = datetime.strptime(expires_at, "%Y-%m-%d %H:%M:%S")
            except Exception:
                exp_dt = _get_utc_now()
    else:
        exp_dt = expires_at
        
    if hasattr(exp_dt, 'tzinfo') and exp_dt.tzinfo is not None:
        exp_dt = exp_dt.astimezone(timezone.utc).replace(tzinfo=None)
        
    if exp_dt < _get_utc_now():
        _record_failed_attempt(rate_limit_key)
        return False, "This connection key has expired. Ask the user to generate a new key.", None
        
    if consumer_username == owner_username:
        _record_failed_attempt(rate_limit_key)
        return False, "You cannot connect with your own key.", None
        
    u_a = min(consumer_username, owner_username)
    u_b = max(consumer_username, owner_username)
    
    existing = execute_query(
        "SELECT id FROM user_contacts WHERE user_a = %s AND user_b = %s",
        (u_a, u_b),
        fetchone=True
    )
    if existing:
        return False, "You are already connected with this user.", None
        
    conn = get_db()
    try:
        cursor = conn.cursor()
        
        # 1. Update key record
        cursor.execute(
            "UPDATE connection_keys SET used_at = CURRENT_TIMESTAMP, used_by = %s WHERE id = %s AND used_at IS NULL",
            (consumer_username, key_id)
        )
        if cursor.rowcount == 0:
            return False, "This connection key has already been used.", None
            
        # 2. Insert contact relationship
        cursor.execute(
            "INSERT INTO user_contacts (user_a, user_b) VALUES (%s, %s)",
            (u_a, u_b)
        )
        
        # 3. Log in audit_logs
        cursor.execute(
            "INSERT INTO audit_logs (username, action, details, ip_address) VALUES (%s, %s, %s, %s)",
            (
                consumer_username,
                "ESTABLISH_CONTACT",
                f"Connected with @{owner_username} via connection key #{key_id}",
                client_ip
            )
        )
        conn.commit()
    finally:
        conn.close()
        
    owner_info = execute_query(
        "SELECT username, email, created_at FROM users WHERE username = %s",
        (owner_username,),
        fetchone=True
    )
    
    contact_data = {
        'username': owner_username,
        'email': owner_info.get('email') if isinstance(owner_info, dict) else (owner_info[1] if owner_info else ''),
        'online': owner_username in active_users
    }
    
    return True, f"Connection established successfully with @{owner_username}!", contact_data

def get_user_contacts(username: str):
    """
    Returns the list of persistent trusted contacts for a given user,
    enriched with online status.
    """
    rows = execute_query(
        """
        SELECT 
            uc.id,
            CASE WHEN uc.user_a = %s THEN uc.user_b ELSE uc.user_a END as contact_username,
            u.email,
            uc.created_at as connected_at
        FROM user_contacts uc
        JOIN users u ON u.username = (CASE WHEN uc.user_a = %s THEN uc.user_b ELSE uc.user_a END)
        WHERE uc.user_a = %s OR uc.user_b = %s
        ORDER BY uc.id DESC
        """,
        (username, username, username, username),
        fetchall=True
    )
    
    contacts = []
    for r in (rows or []):
        contact_user = r.get('contact_username') if isinstance(r, dict) else r[1]
        email = r.get('email') if isinstance(r, dict) else r[2]
        connected_at = r.get('connected_at') if isinstance(r, dict) else r[3]
        
        contacts.append({
            'username': contact_user,
            'email': email,
            'connected_at': str(connected_at) if connected_at else None,
            'online': contact_user in active_users
        })
        
    return contacts

def remove_contact(username: str, contact_username: str):
    """
    Removes a persistent contact connection symmetrically.
    """
    u_a = min(username, contact_username)
    u_b = max(username, contact_username)
    
    execute_query(
        "DELETE FROM user_contacts WHERE user_a = %s AND user_b = %s",
        (u_a, u_b)
    )
    
    execute_query(
        "INSERT INTO audit_logs (username, action, details) VALUES (%s, %s, %s)",
        (username, "REMOVE_CONTACT", f"Removed contact connection with @{contact_username}")
    )
    
    return True, f"Contact @{contact_username} removed."
