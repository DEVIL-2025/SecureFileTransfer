import os
import sqlite3
import psycopg2
from psycopg2.extras import RealDictCursor
from backend.config import Config

DEFAULT_SQLITE_PATH = "database.db"

def is_postgres():
    return Config.DATABASE_URL.startswith("postgresql://") or Config.DATABASE_URL.startswith("postgres://")

def get_db_path():
    if Config.DATABASE_URL.startswith("sqlite:///"):
        return Config.DATABASE_URL.replace("sqlite:///", "")
    return DEFAULT_SQLITE_PATH

def get_db_connection():
    if is_postgres():
        db_url = Config.DATABASE_URL
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql://", 1)
        conn = psycopg2.connect(db_url)
        return conn
    else:
        conn = sqlite3.connect(get_db_path())
        conn.row_factory = sqlite3.Row
        return conn

get_db = get_db_connection

def execute_query(query, params=(), fetchone=False, fetchall=False, commit=True):
    conn = get_db_connection()
    try:
        if is_postgres():
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(query, params)
            if commit:
                conn.commit()
            if fetchone:
                res = cursor.fetchone()
                return dict(res) if res else None
            if fetchall:
                res = cursor.fetchall()
                return [dict(r) for r in res] if res else []
            return None
        else:
            cursor = conn.cursor()
            formatted_query = query.replace("%s", "?")
            cursor.execute(formatted_query, params)
            if commit:
                conn.commit()
            if fetchone:
                res = cursor.fetchone()
                return dict(res) if res else None
            if fetchall:
                res = cursor.fetchall()
                return [dict(r) for r in res] if res else []
            return None
    finally:
        conn.close()

def init_db():
    schema_path = os.path.join(os.path.dirname(__file__), 'schema.sql')
    with open(schema_path, 'r') as f:
        schema_sql = f.read()

    with get_db_connection() as conn:
        cursor = conn.cursor()
        if not is_postgres():
            sqlite_schema = schema_sql
            sqlite_schema = sqlite_schema.replace("SERIAL PRIMARY KEY", "INTEGER PRIMARY KEY AUTOINCREMENT")
            sqlite_schema = sqlite_schema.replace("BIGINT", "INTEGER")
            sqlite_schema = sqlite_schema.replace("VARCHAR(80)", "TEXT")
            sqlite_schema = sqlite_schema.replace("VARCHAR(255)", "TEXT")
            sqlite_schema = sqlite_schema.replace("VARCHAR(100)", "TEXT")
            sqlite_schema = sqlite_schema.replace("VARCHAR(64)", "TEXT")
            sqlite_schema = sqlite_schema.replace("VARCHAR(50)", "TEXT")
            sqlite_schema = sqlite_schema.replace("VARCHAR(45)", "TEXT")
            sqlite_schema = sqlite_schema.replace("TIMESTAMP", "DATETIME")
            
            cursor.executescript(sqlite_schema)

            # Auto-migrate missing columns for existing SQLite tables
            cursor.execute("PRAGMA table_info(files)")
            file_cols = [row[1] for row in cursor.fetchall()]
            if "original_filename" not in file_cols:
                cursor.execute("ALTER TABLE files ADD COLUMN original_filename TEXT DEFAULT ''")
            if "file_size" not in file_cols:
                cursor.execute("ALTER TABLE files ADD COLUMN file_size INTEGER DEFAULT 0")
            if "mime_type" not in file_cols:
                cursor.execute("ALTER TABLE files ADD COLUMN mime_type TEXT DEFAULT 'application/octet-stream'")
            if "file_key" not in file_cols:
                cursor.execute("ALTER TABLE files ADD COLUMN file_key TEXT DEFAULT ''")
            if "created_at" not in file_cols:
                cursor.execute("ALTER TABLE files ADD COLUMN created_at DATETIME")

            cursor.execute("PRAGMA table_info(users)")
            user_cols = [row[1] for row in cursor.fetchall()]
            if "sent" not in user_cols:
                cursor.execute("ALTER TABLE users ADD COLUMN sent INTEGER DEFAULT 0")
            if "received" not in user_cols:
                cursor.execute("ALTER TABLE users ADD COLUMN received INTEGER DEFAULT 0")
            if "created_at" not in user_cols:
                cursor.execute("ALTER TABLE users ADD COLUMN created_at DATETIME")

            cursor.execute("PRAGMA table_info(shared_files)")
            shared_cols = [row[1] for row in cursor.fetchall()]
            if "shared_by" not in shared_cols:
                cursor.execute("ALTER TABLE shared_files ADD COLUMN shared_by TEXT DEFAULT ''")
            if "created_at" not in shared_cols:
                cursor.execute("ALTER TABLE shared_files ADD COLUMN created_at DATETIME")

            cursor.execute("PRAGMA table_info(transfers)")
            transfer_cols = [row[1] for row in cursor.fetchall()]
            if "file_size" not in transfer_cols:
                cursor.execute("ALTER TABLE transfers ADD COLUMN file_size INTEGER DEFAULT 0")
            if "status" not in transfer_cols:
                cursor.execute("ALTER TABLE transfers ADD COLUMN status TEXT DEFAULT 'completed'")
        else:
            # Execute PostgreSQL schema
            cursor.execute(schema_sql)
            
            # Safe column migrations for PostgreSQL if tables existed previously
            postgres_migrations = [
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(80) UNIQUE",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(255)",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS sent INTEGER DEFAULT 0",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS received INTEGER DEFAULT 0",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
                "ALTER TABLE files ADD COLUMN IF NOT EXISTS original_filename VARCHAR(255) DEFAULT ''",
                "ALTER TABLE files ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0",
                "ALTER TABLE files ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100) DEFAULT 'application/octet-stream'",
                "ALTER TABLE files ADD COLUMN IF NOT EXISTS file_key TEXT DEFAULT ''",
                "ALTER TABLE files ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
                "ALTER TABLE transfers ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0",
                "ALTER TABLE transfers ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'completed'",
                "ALTER TABLE transfers ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
            ]
            for stmt in postgres_migrations:
                try:
                    cursor.execute(stmt)
                except Exception:
                    pass
            conn.commit()
            
    print(f"Database initialized successfully ({'PostgreSQL' if is_postgres() else 'SQLite'}).")
