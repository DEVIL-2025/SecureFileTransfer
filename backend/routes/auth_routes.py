from flask import Blueprint, request, jsonify, session
from backend.services.auth_service import register_user, authenticate_user

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    
    if not username or not email or not password:
        return jsonify({'error': 'Username, email, and password are required.'}), 400
        
    success, message = register_user(username, email, password)
    if not success:
        return jsonify({'error': message}), 400
        
    return jsonify({'message': message, 'success': True}), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    
    # Support username/email identifier OR legacy separate fields
    identifier = data.get('identifier') or data.get('username') or data.get('email')
    password = data.get('password')
    
    if not identifier or not password:
        return jsonify({'error': 'Username/Email and password are required.'}), 400
        
    username, message = authenticate_user(identifier, password)
    if not username:
        return jsonify({'error': message}), 401
        
    session['username'] = username
    session.permanent = True
    
    return jsonify({
        'message': message,
        'user': {'username': username},
        'success': True
    }), 200

@auth_bp.route('/logout', methods=['POST', 'GET'])
def logout():
    session.pop('username', None)
    return jsonify({'message': 'Logged out successfully.', 'success': True}), 200

@auth_bp.route('/me', methods=['GET'])
def get_current_user():
    username = session.get('username')
    if not username:
        return jsonify({'authenticated': False, 'user': None}), 200
        
    return jsonify({
        'authenticated': True,
        'user': {'username': username}
    }), 200
