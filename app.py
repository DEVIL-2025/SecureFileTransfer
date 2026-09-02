import os
from backend.app import app, socketio

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting Secure File Transfer Application on port {port}...")
    socketio.run(app, host='0.0.0.0', port=port, debug=True)
