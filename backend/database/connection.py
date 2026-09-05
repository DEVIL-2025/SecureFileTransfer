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

        # 3. Final column migrations and schema alignment
        postgres_migrations = [
            "ALTER TABLE transfers ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0;",
            "ALTER TABLE transfers ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'completed';",
            "ALTER TABLE transfers ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP;",
            "ALTER TABLE transfers ADD COLUMN IF NOT EXISTS sender VARCHAR(80);",
            "ALTER TABLE transfers ADD COLUMN IF NOT EXISTS receiver VARCHAR(80);",
            "ALTER TABLE transfers ALTER COLUMN sender_id DROP NOT NULL;",
            "ALTER TABLE transfers ALTER COLUMN receiver_id DROP NOT NULL;",
            "ALTER TABLE connection_keys ADD COLUMN IF NOT EXISTS owner_username VARCHAR(80);",
            "ALTER TABLE connection_keys ADD COLUMN IF NOT EXISTS used_by VARCHAR(80);",
            "ALTER TABLE connection_keys ALTER COLUMN owner_id DROP NOT NULL;",
            "ALTER TABLE connection_keys ALTER COLUMN used_by_id DROP NOT NULL;",
            "ALTER TABLE user_contacts ADD COLUMN IF NOT EXISTS user_a VARCHAR(80);",
            "ALTER TABLE user_contacts ADD COLUMN IF NOT EXISTS user_b VARCHAR(80);",
            "ALTER TABLE user_contacts ALTER COLUMN user_a_id DROP NOT NULL;",
            "ALTER TABLE user_contacts ALTER COLUMN user_b_id DROP NOT NULL;",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS username VARCHAR(80);",
            # Backfills
            "UPDATE transfers t SET sender = u.username FROM users u WHERE t.sender_id = u.id AND (t.sender IS NULL OR t.sender = '');",
            "UPDATE transfers t SET receiver = u.username FROM users u WHERE t.receiver_id = u.id AND (t.receiver IS NULL OR t.receiver = '');",
            "UPDATE connection_keys ck SET owner_username = u.username FROM users u WHERE ck.owner_id = u.id AND (ck.owner_username IS NULL OR ck.owner_username = '');",
            "UPDATE connection_keys ck SET used_by = u.username FROM users u WHERE ck.used_by_id = u.id AND (ck.used_by IS NULL OR ck.used_by = '');",
            "UPDATE user_contacts uc SET user_a = u.username FROM users u WHERE uc.user_a_id = u.id AND (uc.user_a IS NULL OR uc.user_a = '');",
            "UPDATE user_contacts uc SET user_b = u.username FROM users u WHERE uc.user_b_id = u.id AND (uc.user_b IS NULL OR uc.user_b = '');",
            # Performance Indexes
            "CREATE INDEX IF NOT EXISTS idx_transfers_sender ON transfers(sender);",
            "CREATE INDEX IF NOT EXISTS idx_transfers_receiver ON transfers(receiver);",
            "CREATE INDEX IF NOT EXISTS idx_audit_username ON audit_logs(username);",
            "CREATE INDEX IF NOT EXISTS idx_conn_keys_owner ON connection_keys(owner_username);",
            "CREATE INDEX IF NOT EXISTS idx_conn_keys_expires ON connection_keys(expires_at);",
            "CREATE INDEX IF NOT EXISTS idx_contacts_user_a ON user_contacts(user_a);",
            "CREATE INDEX IF NOT EXISTS idx_contacts_user_b ON user_contacts(user_b);"
        ]
        for stmt in postgres_migrations:
            try:
                cursor.execute(stmt)
                conn.commit()
            except Exception:
                conn.rollback()
                
    print("Database initialized and aligned successfully (PostgreSQL).")
