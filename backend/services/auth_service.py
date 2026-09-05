import re
from werkzeug.security import generate_password_hash, check_password_hash
from backend.database.connection import execute_query

def register_user(username, email, password):
    if not username or not email or not password:
        return False, "All fields (username, email, password) are required."
        
    username = username.strip()
    email = email.strip()
    
    if len(username) < 3:
        return False, "Username must be at least 3 characters long."
        
    if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
        return False, "Invalid email address format."
        
    if len(password) < 6:
        return False, "Password must be at least 6 characters long."
        
    # Check for existing username or email
    existing = execute_query(
        "SELECT id, username, email FROM users WHERE LOWER(username) = LOWER(%s) OR LOWER(email) = LOWER(%s)",
        (username, email),
        fetchone=True
    )
    if existing:
        if isinstance(existing, dict):
            ex_u = existing.get('username', '').lower()
            ex_e = existing.get('email', '').lower()
        else:
            ex_u = existing[1].lower() if len(existing) > 1 else ''
            ex_e = existing[2].lower() if len(existing) > 2 else ''
            
        if ex_u == username.lower():
            return False, "Username is already taken."
        if ex_e == email.lower():
            return False, "Email address is already registered."

    hashed_pw = generate_password_hash(password)
    
    execute_query(
        """
        INSERT INTO users (username, email, password)
        VALUES (%s, %s, %s)
        """,
        (username, email, hashed_pw)
    )
    
    execute_query(
        "INSERT INTO audit_logs (username, action, details) VALUES (%s, %s, %s)",
        (username, "REGISTER", f"User @{username} registered.")
    )
    
    return True, "Registration successful."

def authenticate_user(identifier, password):
    if not identifier or not password:
        return None, "Identifier and password are required."
        
    identifier = identifier.strip()
    user = execute_query(
        "SELECT * FROM users WHERE LOWER(username) = LOWER(%s) OR LOWER(email) = LOWER(%s)",
        (identifier, identifier),
        fetchone=True
    )
    if not user:
        return None, "Invalid credentials."
        
    stored_password = user.get("password") if isinstance(user, dict) else user[3]
    username = user.get("username") if isinstance(user, dict) else user[1]
    
    if not check_password_hash(stored_password, password):
        return None, "Invalid credentials."
        
    execute_query(
        "INSERT INTO audit_logs (username, action, details) VALUES (%s, %s, %s)",
        (username, "LOGIN_SUCCESS", "User logged in.")
    )
    
    return username, "Login successful."

def update_user_profile(current_username, new_username=None, new_email=None, current_password=None, new_password=None):
    user = execute_query(
        "SELECT * FROM users WHERE username = %s",
        (current_username,),
        fetchone=True
    )
    if not user:
        return False, "User not found.", None
        
    stored_password = user.get("password") if isinstance(user, dict) else user[3]
    active_username = current_username
    active_email = user.get("email") if isinstance(user, dict) else user[2]
    
    # 1. Update Email if requested
    if new_email and new_email.strip() and new_email.strip().lower() != active_email.lower():
        new_email = new_email.strip()
        if not re.match(r"[^@]+@[^@]+\.[^@]+", new_email):
            return False, "Invalid email address format.", None
            
        taken_email = execute_query(
            "SELECT id FROM users WHERE LOWER(email) = LOWER(%s) AND username != %s",
            (new_email, current_username),
            fetchone=True
        )
        if taken_email:
            return False, "This email address is already in use by another account.", None
            
        execute_query("UPDATE users SET email = %s WHERE username = %s", (new_email, current_username))
        active_email = new_email

    # 2. Update Username if requested
    if new_username and new_username.strip() and new_username.strip() != current_username:
        new_username = new_username.strip()
        if len(new_username) < 3:
            return False, "Username must be at least 3 characters long.", None
            
        taken_user = execute_query(
            "SELECT id FROM users WHERE LOWER(username) = LOWER(%s) AND username != %s",
            (new_username, current_username),
            fetchone=True
        )
        if taken_user:
            return False, "Username is already taken.", None
            
        execute_query("UPDATE users SET username = %s WHERE username = %s", (new_username, current_username))
        execute_query("UPDATE transfers SET sender = %s WHERE sender = %s", (new_username, current_username))
        execute_query("UPDATE transfers SET receiver = %s WHERE receiver = %s", (new_username, current_username))
        execute_query("UPDATE connection_keys SET owner_username = %s WHERE owner_username = %s", (new_username, current_username))
        
        # Update user_contacts canonically
        contacts = execute_query(
            "SELECT id, user_a, user_b FROM user_contacts WHERE user_a = %s OR user_b = %s",
            (current_username, current_username),
            fetchall=True
        )
        for c in (contacts or []):
            cid = c.get('id') if isinstance(c, dict) else c[0]
            ua = c.get('user_a') if isinstance(c, dict) else c[1]
            ub = c.get('user_b') if isinstance(c, dict) else c[2]
            other = ub if ua == current_username else ua
            new_a = min(new_username, other)
            new_b = max(new_username, other)
            execute_query("UPDATE user_contacts SET user_a = %s, user_b = %s WHERE id = %s", (new_a, new_b, cid))
            
        active_username = new_username

    # 3. Update Password if requested
    if new_password:
        if not current_password:
            return False, "Current password is required to set a new password.", None
        if not check_password_hash(stored_password, current_password):
            return False, "Current password is incorrect.", None
        if len(new_password) < 6:
            return False, "New password must be at least 6 characters long.", None
            
        hashed = generate_password_hash(new_password)
        execute_query("UPDATE users SET password = %s WHERE username = %s", (hashed, active_username))
        
    execute_query(
        "INSERT INTO audit_logs (username, action, details) VALUES (%s, %s, %s)",
        (active_username, "PROFILE_UPDATE", "User updated profile details.")
    )
    
    return True, "Profile updated successfully.", {
        'username': active_username,
        'email': active_email
    }
