# Security Policy & Cryptographic Architecture

## 1. Cryptographic Design Decisions

### A. End-to-End Encryption (E2EE) for Real-Time Streaming
- **Key Agreement:** NIST P-256 (secp256r1) Elliptic Curve Diffie-Hellman (ECDH).
- **Session Cipher:** AES-GCM with a 256-bit key length.
- **Nonce/IV Management:** A cryptographically secure 12-byte random initialization vector (IV) generated via `window.crypto.getRandomValues()` for every single chunk to prevent replay attacks and keystream reuse.
- **Zero-Knowledge Guarantee:** Private keys and derived AES session keys are stored strictly in client browser memory and are NEVER transmitted across WebSockets or stored on disk.

### B. Encrypted Cloud Vault Storage (Data at Rest)
- **Hybrid Cryptography:**
  - Files are encrypted using AES symmetric keys.
  - The symmetric key is encrypted (wrapped) with the server's RSA-2048 Public Key using **OAEP with SHA-256** padding.
  - The encrypted file payload is stored on the filesystem, while the wrapped key is stored in the database.
  - Decryption requires the server's private RSA key, protecting files from offline filesystem theft.

---

## 2. Access Control & Authorization Matrix

| Endpoint | Method | Role / Authorization Rule | Security Controls |
| :--- | :--- | :--- | :--- |
| `/api/auth/login` | `POST` | Public | Rate-limiting ready, salted hash verification |
| `/api/files/upload` | `POST` | Authenticated User | `secure_filename`, extension whitelist, size quota |
| `/api/files/download/<id>` | `GET` | File Owner OR Recipient in `shared_files` | Explicit ownership/permission check |
| `/api/files/delete/<id>` | `POST` | File Owner ONLY | Cascading delete on `shared_files` and disk cleanup |
| `/api/files/share/<id>` | `POST` | File Owner ONLY | Validates recipient existence; prevents self-sharing |

---

## 3. Threat Mitigation Summary

| Threat Vector | Mitigation Strategy |
| :--- | :--- |
| **Eavesdropping / MITM** | End-to-End Encryption with ECDH + AES-256-GCM; TLS in production. |
| **CSRF Attacks** | State-changing actions restricted to `POST`/`DELETE` methods. |
| **SQL Injection** | Parameterized queries with prepared statements across SQLite and PostgreSQL. |
| **Database Locks / Leaks** | Context manager lifecycle (`with get_db() as conn:`) with automatic rollback. |
| **Path Traversal** | `secure_filename()` sanitization and random UUID prepending to storage paths. |
| **Session Hijacking** | `HttpOnly`, `SameSite=Lax` cookies with environment-driven secret keys. |
