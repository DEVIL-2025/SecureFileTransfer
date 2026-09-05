-- Relational Database Schema for Secure File Transfer
-- Fully compatible with PostgreSQL (Neon / Supabase / AWS) and SQLite

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(80) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    sent INTEGER DEFAULT 0,
    received INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Transfers Table (Real-time Transfer History)
CREATE TABLE IF NOT EXISTS transfers (
    id SERIAL PRIMARY KEY,
    sender VARCHAR(80) NOT NULL,
    receiver VARCHAR(80) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_size BIGINT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'completed',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Audit Logs Table (Security and Activity Tracking)
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    username VARCHAR(80),
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Connection Keys Table (One-Time Pairing Keys)
CREATE TABLE IF NOT EXISTS connection_keys (
    id SERIAL PRIMARY KEY,
    owner_username VARCHAR(80) NOT NULL,
    key_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    used_by VARCHAR(80),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. User Contacts Table (Persistent Trusted Contacts Relationship)
CREATE TABLE IF NOT EXISTS user_contacts (
    id SERIAL PRIMARY KEY,
    user_a VARCHAR(80) NOT NULL,
    user_b VARCHAR(80) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_contact_pair UNIQUE (user_a, user_b),
    CONSTRAINT canonical_contact_order CHECK (user_a < user_b)
);

-- Indexes for high-performance querying
CREATE INDEX IF NOT EXISTS idx_transfers_sender ON transfers(sender);
CREATE INDEX IF NOT EXISTS idx_transfers_receiver ON transfers(receiver);
CREATE INDEX IF NOT EXISTS idx_audit_username ON audit_logs(username);
CREATE INDEX IF NOT EXISTS idx_conn_keys_hash ON connection_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_conn_keys_owner ON connection_keys(owner_username);
CREATE INDEX IF NOT EXISTS idx_conn_keys_expires ON connection_keys(expires_at);
CREATE INDEX IF NOT EXISTS idx_contacts_user_a ON user_contacts(user_a);
CREATE INDEX IF NOT EXISTS idx_contacts_user_b ON user_contacts(user_b);
