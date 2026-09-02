from flask import Blueprint, request, jsonify, session
from backend.services.contact_service import (
    generate_connection_key,
    get_active_connection_key,
    consume_connection_key,
    get_user_contacts,
    remove_contact
)

contact_bp = Blueprint('contacts', __name__, url_prefix='/api/contacts')

def login_required():
    if 'username' not in session:
        return jsonify({'error': 'Authentication required. Please log in.'}), 401
    return None

@contact_bp.route('/key', methods=['POST'])
def generate_key():
    auth_err = login_required()
    if auth_err:
        return auth_err
        
    username = session['username']
    data = request.get_json(silent=True) or {}
    try:
        expiry = int(data.get('expiry_minutes', 5))
    except (ValueError, TypeError):
        expiry = 5
    
    try:
        key_info = generate_connection_key(username, expiry_minutes=expiry)
        return jsonify({
            'success': True,
            'message': 'Temporary connection key generated.',
            'key': key_info['raw_key'],
            'expires_at': key_info['expires_at'],
            'expires_in_seconds': key_info['expires_in_seconds']
        }), 201
    except Exception as e:
        return jsonify({'error': f'Failed to generate connection key: {str(e)}'}), 500

@contact_bp.route('/key/active', methods=['GET'])
def check_active_key():
    auth_err = login_required()
    if auth_err:
        return auth_err
        
    username = session['username']
    try:
        active_info = get_active_connection_key(username)
        return jsonify(active_info or {'has_active_key': False}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@contact_bp.route('/key/consume', methods=['POST'])
def consume_key():
    auth_err = login_required()
    if auth_err:
        return auth_err
        
    username = session['username']
    data = request.get_json(silent=True) or {}
    raw_key = data.get('key', '').strip()
    
    if not raw_key:
        return jsonify({'error': 'Connection key is required.'}), 400
        
    client_ip = request.headers.get('X-Forwarded-For', request.remote_addr or '')
    try:
        success, message, contact_data = consume_connection_key(username, raw_key, client_ip=client_ip)
        if not success:
            return jsonify({'error': message}), 400
            
        return jsonify({
            'success': True,
            'message': message,
            'contact': contact_data
        }), 200
    except Exception as e:
        return jsonify({'error': f'Error connecting: {str(e)}'}), 500

@contact_bp.route('', methods=['GET'])
def list_contacts():
    auth_err = login_required()
    if auth_err:
        return auth_err
        
    username = session['username']
    try:
        contacts = get_user_contacts(username)
        return jsonify({'contacts': contacts}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to load contacts: {str(e)}'}), 500

@contact_bp.route('/<string:contact_username>', methods=['DELETE', 'POST'])
def delete_contact(contact_username):
    auth_err = login_required()
    if auth_err:
        return auth_err
        
    username = session['username']
    try:
        success, message = remove_contact(username, contact_username)
        return jsonify({'success': success, 'message': message}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to remove contact: {str(e)}'}), 500
