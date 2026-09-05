import os
from flask import Flask, send_from_directory, jsonify, make_response
from flask_cors import CORS
from flask_socketio import SocketIO
from backend.config import Config
from backend.database.connection import init_db
from backend.routes.auth_routes import auth_bp
from backend.routes.user_routes import user_bp
from backend.routes.contact_routes import contact_bp
from backend.socket.transfer_socket import register_socket_handlers

def create_app():
    app = Flask(__name__, static_folder="../frontend/dist", static_url_path="/")
    app.config.from_object(Config)
    
    # Configure allowed CORS origins (supports comma-separated list or '*')
    cors_origins_env = os.environ.get("CORS_ORIGIN", "")
    allowed_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://localhost:5000"
    ]
    if cors_origins_env:
        for o in cors_origins_env.split(','):
            cleaned = o.strip()
            if cleaned and cleaned not in allowed_origins:
                allowed_origins.append(cleaned)
    
    # Enable CORS for React frontend with credentials (cookies) enabled
    CORS(app, supports_credentials=True, origins=allowed_origins if cors_origins_env != "*" else "*")
    
    # Initialize Socket.IO with production async mode support
    socketio = SocketIO(
        app,
        cors_allowed_origins="*",
        manage_session=False,
        async_mode=os.environ.get("SOCKETIO_ASYNC_MODE", "threading")
    )
    
    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(user_bp)
    app.register_blueprint(contact_bp)
    
    # Register real-time transfer socket events
    register_socket_handlers(socketio)
    
    # Initialize Database
    with app.app_context():
        init_db()
        
    # SPA Frontend fallback routes with proper caching headers
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
    def serve_frontend(path):
        # Return 404 for unmatched API endpoints
        if path.startswith("api/") or path == "api":
            return jsonify({"error": "Endpoint not found", "success": False}), 404

        dist_dir = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
        
        # 1. Serve static asset files (JS, CSS, SVGs, images)
        if path != "" and os.path.exists(os.path.join(dist_dir, path)):
            response = make_response(send_from_directory(dist_dir, path))
            if path.startswith("assets/"):
                response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
            return response
            
        # 2. Serve SPA index.html for client-side routing
        if os.path.exists(os.path.join(dist_dir, "index.html")):
            response = make_response(send_from_directory(dist_dir, "index.html"))
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            return response
            
        return jsonify({
            "name": "Secure File Transfer REST & Real-time API",
            "status": "online",
            "version": "2.0.0",
            "message": "Frontend build not found. Run 'npm run build' in /frontend directory."
        })
        
    return app, socketio

app, socketio = create_app()
