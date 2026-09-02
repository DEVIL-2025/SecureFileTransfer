import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-fallback-secret-key-replace-in-production")
    DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/secure_transfer_db")
    UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER", os.path.join(os.getcwd(), "uploads"))
    MAX_CONTENT_LENGTH = int(os.environ.get("MAX_CONTENT_LENGTH", 500 * 1024 * 1024))  # 500 MB default
    ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'mkv', 'mp4', 'zip', 'docx', 'xlsx', 'csv'}
    CORS_ORIGIN = os.environ.get("CORS_ORIGIN", "*")
    
    # Session cookie security settings (Supports cross-domain cookies for Vercel -> Render)
    is_prod = os.environ.get("FLASK_ENV") == "production"
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'None' if is_prod else 'Lax'
    SESSION_COOKIE_SECURE = True if is_prod else False
