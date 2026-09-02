from flask import Blueprint, request, jsonify, session
from backend.database.connection import execute_query
from backend.services.auth_service import update_user_profile

user_bp = Blueprint('users', __name__, url_prefix='/api/users')

def login_required_check():
    if 'username' not in session:
        return jsonify({'error': 'Authentication required. Please log in.'}), 401
    return None

@user_bp.route('/profile', methods=['GET'])
def get_profile():
    auth_err = login_required_check()
    if auth_err:
        return auth_err
        
    username = session['username']
    user = execute_query(
        "SELECT username, email, sent, received, created_at FROM users WHERE username = %s",
        (username,),
        fetchone=True
    )
    if not user:
        return jsonify({'error': 'User profile not found.'}), 404
        
    return jsonify({
        'username': user.get('username') if isinstance(user, dict) else user[0],
        'email': user.get('email') if isinstance(user, dict) else user[1],
        'sent': user.get('sent', 0) if isinstance(user, dict) else user[2],
        'received': user.get('received', 0) if isinstance(user, dict) else user[3],
        'createdAt': user.get('created_at') if isinstance(user, dict) else user[4],
        'lastActive': 'Online now'
    }), 200

@user_bp.route('/transfers', methods=['GET'])
def get_recent_transfers():
    auth_err = login_required_check()
    if auth_err:
        return auth_err
        
    username = session['username']
    try:
        start = int(request.args.get('start', 0))
        limit = int(request.args.get('limit', 10))
    except ValueError:
        return jsonify({'error': 'Invalid pagination parameters.'}), 400
        
    rows = execute_query(
        """
        SELECT sender, receiver, filename, file_size, status, timestamp
        FROM transfers
        WHERE sender = %s OR receiver = %s
        ORDER BY id DESC
        LIMIT %s OFFSET %s
        """,
        (username, username, limit, start),
        fetchall=True
    )
    
    return jsonify(rows or []), 200

@user_bp.route('/transfers/clear', methods=['POST'])
def clear_transfers():
    auth_err = login_required_check()
    if auth_err:
        return auth_err
        
    username = session['username']
    execute_query(
        "DELETE FROM transfers WHERE sender = %s OR receiver = %s",
        (username, username)
    )
    return jsonify({'message': 'Transfer history cleared successfully.', 'success': True}), 200

@user_bp.route('/update-profile', methods=['POST'])
def update_profile():
    auth_err = login_required_check()
    if auth_err:
        return auth_err
        
    data = request.get_json(silent=True) or {}
    new_username = data.get('username')
    new_email = data.get('email')
    current_password = data.get('currentPassword')
    new_password = data.get('newPassword')
    
    if not new_username and not new_email and not new_password:
        return jsonify({'error': 'No fields provided to update.'}), 400
        
    username = session['username']
    success, message, profile_data = update_user_profile(
        username,
        new_username=new_username,
        new_email=new_email,
        current_password=current_password,
        new_password=new_password
    )
    
    if not success:
        return jsonify({'error': message}), 400
        
    if profile_data and 'username' in profile_data:
        session['username'] = profile_data['username']
        
    return jsonify({
        'message': message,
        'user': profile_data,
        'success': True
    }), 200
