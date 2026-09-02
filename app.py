import os
from backend.app import app, socketio

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    is_prod = os.environ.get("FLASK_ENV") == "production"
    print(f"Starting Secure File Transfer Application on port {port} (Production={is_prod})...")
    socketio.run(
        app,
        host='0.0.0.0',
        port=port,
        debug=not is_prod,
        allow_unsafe_werkzeug=True
    )
