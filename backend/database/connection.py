import os
import sqlite3
import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from backend.config import Config

def is_postgres():
    url = Config.DATABASE_URL
    return url.startswith("postgresql://") or url.startswith("postgres://")

def get_raw_connection():
    if is_postgres():
        conn = psycopg2.connect(Config.DATABASE_URL)
        return conn
    else:
        # Extract path from sqlite:///path or default
        db_path = Config.DATABASE_URL.replace("sqlite:///", "")
        if not db_path:
            db_path = "database.db"
        # In SQLite, enable foreign keys explicitly
        conn = sqlite3.connect(db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        return conn

@contextmanager
def get_db():
    """
    Context manager for database connections.
    Guarantees automatic commit on success, rollback on exception, and connection closure.
    """
    conn = get_raw_connection()
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def execute_query(query, params=(), fetchone=False, fetchall=False, commit=True):
    """
    Unified query execution helper that handles parameter placeholders (%s for PG, ? for SQLite)
    and returns dictionary-like results.
    """
    with get_db() as conn:
        postgres = is_postgres()
        
        # Adapt parameter syntax if necessary
        formatted_query = query
        if not postgres:
            # Replace %s with ? for sqlite if needed
            formatted_query = query.replace("%s", "?")
        else:
            # Replace ? with %s for postgres if needed
            formatted_query = query.replace("?", "%s")
            
        if postgres:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
        else:
            cursor = conn.cursor()
            
        cursor.execute(formatted_query, params)
        
        if fetchone:
            row = cursor.fetchone()
            if row is not None and not postgres:
                return dict(row)
            return row
            
        if fetchall:
            rows = cursor.fetchall()
            if not postgres:
                return [dict(r) for r in rows]
            return rows
            
        last_id = getattr(cursor, 'lastrowid', None)
        return last_id

def init_db():
    """
    Initializes database tables, foreign keys, and indexes.
    Works seamlessly on both PostgreSQL and SQLite, and migrates legacy schemas.
    """
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    if os.path.exists(schema_path):
        with open(schema_path, "r") as f:
            schema_sql = f.read()
    else:
        return

    with get_db() as conn:
        postgres = is_postgres()
        cursor = conn.cursor()
        
        if not postgres:
            # Translate PostgreSQL-specific types to SQLite syntax
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
            cursor.execute(schema_sql)
            
    print(f"Database initialized successfully ({'PostgreSQL' if is_postgres() else 'SQLite'}).")
