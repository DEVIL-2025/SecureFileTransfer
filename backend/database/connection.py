import os
import psycopg2
from psycopg2.extras import RealDictCursor
from backend.config import Config

def get_db_connection():
    db_url = Config.DATABASE_URL
    # Normalize postgres:// to postgresql:// for psycopg2
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    conn = psycopg2.connect(db_url)
    return conn

get_db = get_db_connection

def execute_query(query, params=(), fetchone=False, fetchall=False, commit=True):
    conn = get_db_connection()
    try:
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
    finally:
        conn.close()

def init_db():
    schema_path = os.path.join(os.path.dirname(__file__), 'schema.sql')
    with open(schema_path, 'r') as f:
        schema_sql = f.read()

    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # 1. Pre-flight base tables and columns
        base_setup = [
            """
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(80) UNIQUE,
                email VARCHAR(255) UNIQUE,
                password VARCHAR(255),
                sent INTEGER DEFAULT 0,
                received INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """,
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(80) UNIQUE;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(255);",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS sent INTEGER DEFAULT 0;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS received INTEGER DEFAULT 0;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;"
        ]
        for stmt in base_setup:
            try:
                cursor.execute(stmt)
                conn.commit()
            except Exception:
                conn.rollback()

        # 2. Execute individual schema statements safely
        statements = [s.strip() for s in schema_sql.split(';') if s.strip()]
        for stmt in statements:
            try:
                cursor.execute(stmt)
                conn.commit()
            except Exception:
                conn.rollback()

        # 3. Final column migrations
        postgres_migrations = [
            "ALTER TABLE files ADD COLUMN IF NOT EXISTS original_filename VARCHAR(255) DEFAULT '';",
            "ALTER TABLE files ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0;",
            "ALTER TABLE files ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100) DEFAULT 'application/octet-stream';",
            "ALTER TABLE files ADD COLUMN IF NOT EXISTS file_key TEXT DEFAULT '';",
            "ALTER TABLE files ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;",
            "ALTER TABLE transfers ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0;",
            "ALTER TABLE transfers ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'completed';",
            "ALTER TABLE transfers ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP;"
        ]
        for stmt in postgres_migrations:
            try:
                cursor.execute(stmt)
                conn.commit()
            except Exception:
                conn.rollback()
                
    print("Database initialized successfully (PostgreSQL).")
