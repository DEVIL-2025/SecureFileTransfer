import io
from flask import Blueprint, request, jsonify, session, send_file
from backend.database.connection import execute_query
from backend.services.file_service import (
    save_and_encrypt_file,
    get_file_for_download,
    delete_user_file,
    share_user_file,
    list_user_files
)

file_bp = Blueprint('files', __name__, url_prefix='/api/files')

def login_required_check():
    if 'username' not in session:
        return jsonify({'error': 'Authentication required. Please log in.'}), 401
    return None

@file_bp.route('', methods=['GET'])
@file_bp.route('/list', methods=['GET'])
def get_files():
    auth_err = login_required_check()
    if auth_err:
        return auth_err
        
    username = session['username']
    my_files, shared_files = list_user_files(username)
    return jsonify({
        'my_files': my_files,
        'shared_files': shared_files
    }), 200

@file_bp.route('/upload', methods=['POST'])
def upload_file():
    auth_err = login_required_check()
    if auth_err:
        return auth_err
        
    if 'file' not in request.files:
        return jsonify({'error': 'No file part provided in request.'}), 400
        
    file = request.files['file']
    username = session['username']
    
    success, message = save_and_encrypt_file(file, username)
    if not success:
        return jsonify({'error': message}), 400
        
    return jsonify({'message': message, 'success': True}), 201

@file_bp.route('/download/<int:file_id>', methods=['GET'])
def download_file(file_id):
    auth_err = login_required_check()
    if auth_err:
        return auth_err
        
    username = session['username']
    file_info, error = get_file_for_download(file_id, username)
    
    if error:
        return jsonify({'error': error}), 403 if 'Unauthorized' in error else 404
        
    return send_file(
        io.BytesIO(file_info['data']),
        as_attachment=True,
        download_name=file_info['filename'],
        mimetype=file_info['mime_type']
    )

@file_bp.route('/delete/<int:file_id>', methods=['POST', 'DELETE'])
def delete_file(file_id):
    auth_err = login_required_check()
    if auth_err:
        return auth_err
        
    username = session['username']
    success, message = delete_user_file(file_id, username)
    if not success:
        return jsonify({'error': message}), 403 if 'Unauthorized' in message else 404
        
    return jsonify({'message': message, 'success': True}), 200

@file_bp.route('/share/<int:file_id>', methods=['POST'])
def share_file(file_id):
    auth_err = login_required_check()
    if auth_err:
        return auth_err
        
    data = request.get_json() or {}
    target_username = data.get('username') or data.get('target_username')
    
    if not target_username:
        return jsonify({'error': 'Target username is required.'}), 400
        
    username = session['username']
    success, message = share_user_file(file_id, username, target_username)
    if not success:
        return jsonify({'error': message}), 400
        
    return jsonify({'message': message, 'success': True}), 200

@file_bp.route('/shared/clear', methods=['POST'])
def clear_shared_files():
    auth_err = login_required_check()
    if auth_err:
        return auth_err
        
    username = session['username']
    execute_query(
        "DELETE FROM shared_files WHERE shared_with = %s",
        (username,)
    )
    return jsonify({'message': 'Shared files list cleared.', 'success': True}), 200

@file_bp.route('/shared/remove/<int:file_id>', methods=['POST'])
def remove_shared_file(file_id):
    auth_err = login_required_check()
    if auth_err:
        return auth_err
        
    username = session['username']
    execute_query(
        "DELETE FROM shared_files WHERE file_id = %s AND shared_with = %s",
        (file_id, username)
    )
    return jsonify({'message': 'Removed from shared files.', 'success': True}), 200
