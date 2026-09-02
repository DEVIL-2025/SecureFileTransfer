import secrets
import string
import hashlib
import time
from datetime import datetime, timedelta, timezone
from backend.database.connection import execute_query, get_db, is_postgres
from backend.socket.transfer_socket import active_users

# In-memory rate limiting: identifier (username or IP) -> list of failed timestamps
_failed_attempts = {}
MAX_FAILED_ATTEMPTS = 5
RATE_LIMIT_WINDOW_SECONDS = 60

# Unambiguous characters for readable connection keys (excluding 0, O, 1, I, L)
KEY_CHARSET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"

def _get_utc_now():
    return datetime.now(timezone.utc)

def _hash_key(raw_key: str) -> str:
    """Normalizes and hashes raw key with SHA-256."""
    normalized = raw_key.replace("-", "").replace(" ", "").strip().upper()
    return hashlib.sha256(normalized.encode('utf-8')).hexdigest()

def _check_rate_limit(identifier: str) -> bool:
    """Returns True if identifier is rate limited."""
    now = time.time()
    attempts = _failed_attempts.get(identifier, [])
    # Filter attempts within the window
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
    # Invalidate / delete old unconsumed keys for this user
    execute_query(
        "DELETE FROM connection_keys WHERE owner_username = %s AND used_at IS NULL",
        (owner_username,)
    )
    
    # Generate 12 random characters formatted in 3 chunks of 4
    chars = [secrets.choice(KEY_CHARSET) for _ in range(12)]
    raw_key = f"{''.join(chars[0:4])}-{''.join(chars[4:8])}-{''.join(chars[8:12])}"
    key_hash = _hash_key(raw_key)
    
    now = _get_utc_now()
    expires_at = now + timedelta(minutes=expiry_minutes)
    
    # Format as ISO string for sqlite / timestamp for postgres
    exp_val = expires_at.strftime("%Y-%m-%d %H:%M:%S")
    
    execute_query(
        """
        INSERT INTO connection_keys (owner_username, key_hash, expires_at)
        VALUES (%s, %s, %s)
        """,
        (owner_username, key_hash, exp_val)
    )
    
    return {
        'raw_key': raw_key,
        'expires_at': expires_at.isoformat(),
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
                exp_dt = datetime.now()
    else:
        exp_dt = expires_at
        
    if exp_dt.tzinfo is None:
        exp_dt = exp_dt.replace(tzinfo=timezone.utc)
        
    remaining = max(0, int((exp_dt - _get_utc_now()).total_seconds()))
    if remaining <= 0:
        return None
        
    return {
        'has_active_key': True,
        'expires_at': exp_dt.isoformat(),
        'expires_in_seconds': remaining
    }

def consume_connection_key(consumer_username: str, raw_key: str, client_ip: str = ""):
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
    
    # Query key record
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
    
    # Check if already used
    if used_at is not None:
        _record_failed_attempt(rate_limit_key)
        return False, "This connection key has already been used.", None
        
    # Check expiration
    if isinstance(expires_at, str):
        try:
            exp_dt = datetime.fromisoformat(expires_at.replace("Z", ""))
        except Exception:
            try:
                exp_dt = datetime.strptime(expires_at, "%Y-%m-%d %H:%M:%S")
            except Exception:
                exp_dt = datetime.now()
    else:
        exp_dt = expires_at
        
    if exp_dt.tzinfo is None:
        exp_dt = exp_dt.replace(tzinfo=timezone.utc)
        
    if exp_dt < _get_utc_now():
        _record_failed_attempt(rate_limit_key)
        return False, "This connection key has expired. Ask the user to generate a new key.", None
        
    # Prevent self-pairing
    if consumer_username == owner_username:
        _record_failed_attempt(rate_limit_key)
        return False, "You cannot connect with your own key.", None
        
    # Check if already connected
    u_a = min(consumer_username, owner_username)
    u_b = max(consumer_username, owner_username)
    
    existing = execute_query(
        "SELECT id FROM user_contacts WHERE user_a = %s AND user_b = %s",
        (u_a, u_b),
        fetchone=True
    )
    if existing:
        return False, "You are already connected with this user.", None
        
    now_str = _get_utc_now().strftime("%Y-%m-%d %H:%M:%S")
    
    # Atomic transaction to mark key used and create contact
    with get_db() as conn:
        postgres = is_postgres()
        cursor = conn.cursor()
        
        # Lock and update key record
        update_query = "UPDATE connection_keys SET used_at = CURRENT_TIMESTAMP, used_by = %s WHERE id = %s AND used_at IS NULL"
        if not postgres:
            update_query = update_query.replace("%s", "?")
        cursor.execute(update_query, (consumer_username, key_id))
        
        if cursor.rowcount == 0:
            return False, "This connection key has already been used.", None
            
        # Insert contact relationship
        insert_contact = "INSERT INTO user_contacts (user_a, user_b) VALUES (%s, %s)"
        if not postgres:
            insert_contact = insert_contact.replace("%s", "?")
        cursor.execute(insert_contact, (u_a, u_b))
        
        # Log in audit_logs
        log_query = "INSERT INTO audit_logs (username, action, details, ip_address) VALUES (%s, %s, %s, %s)"
        if not postgres:
            log_query = log_query.replace("%s", "?")
        cursor.execute(log_query, (
            consumer_username,
            "ESTABLISH_CONTACT",
            f"Connected with @{owner_username} via connection key #{key_id}",
            client_ip
        ))
        
    # Fetch owner details for instant feedback
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
    Returns all trusted contacts for a given user, resolved with email, created date,
    and real-time online status.
    """
    rows = execute_query(
        """
        SELECT 
            CASE WHEN c.user_a = %s THEN c.user_b ELSE c.user_a END AS contact_username,
            c.created_at AS connected_since,
            u.email,
            u.sent,
            u.received
        FROM user_contacts c
        JOIN users u ON u.username = (CASE WHEN c.user_a = %s THEN c.user_b ELSE c.user_a END)
        WHERE c.user_a = %s OR c.user_b = %s
        ORDER BY c.created_at DESC
        """,
        (username, username, username, username),
        fetchall=True
    )
    
    contacts = []
    for r in (rows or []):
        contact_name = r.get('contact_username') if isinstance(r, dict) else r[0]
        connected_since = r.get('connected_since') if isinstance(r, dict) else r[1]
        email = r.get('email') if isinstance(r, dict) else r[2]
        sent = r.get('sent', 0) if isinstance(r, dict) else (r[3] or 0)
        received = r.get('received', 0) if isinstance(r, dict) else (r[4] or 0)
        
        contacts.append({
            'username': contact_name,
            'email': email,
            'connected_since': connected_since.isoformat() if hasattr(connected_since, 'isoformat') else str(connected_since),
            'online': contact_name in active_users,
            'sent': sent,
            'received': received
        })
        
    return contacts

def remove_contact(username: str, contact_username: str):
    """
    Removes the trusted contact relationship between two users.
    """
    u_a = min(username, contact_username)
    u_b = max(username, contact_username)
    
    execute_query(
        "DELETE FROM user_contacts WHERE user_a = %s AND user_b = %s",
        (u_a, u_b)
    )
    return True, f"@{contact_username} removed from trusted contacts."
