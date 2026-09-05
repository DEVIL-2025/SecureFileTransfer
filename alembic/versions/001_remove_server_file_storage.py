"""remove server file storage tables

Revision ID: 001_remove_storage
Revises: None
Create Date: 2026-09-05 22:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '001_remove_storage'
down_revision: Union[str, None] = 'afbc6cd311b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Safely drop stored-file sharing table
    op.execute("DROP TABLE IF EXISTS shared_files CASCADE;")
    # Safely drop stored files table
    op.execute("DROP TABLE IF EXISTS files CASCADE;")
    # Safely drop obsolete indexes if present
    op.execute("DROP INDEX IF EXISTS idx_files_username;")
    op.execute("DROP INDEX IF EXISTS idx_shared_files_with;")


def downgrade() -> None:
    # Re-create files table if rolled back
    op.execute("""
        CREATE TABLE IF NOT EXISTS files (
            id SERIAL PRIMARY KEY,
            filename VARCHAR(255) NOT NULL,
            original_filename VARCHAR(255) NOT NULL,
            file_size BIGINT DEFAULT 0,
            mime_type VARCHAR(100) DEFAULT 'application/octet-stream',
            username VARCHAR(80) NOT NULL,
            file_key TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS shared_files (
            id SERIAL PRIMARY KEY,
            file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
            shared_by VARCHAR(80) NOT NULL,
            shared_with VARCHAR(80) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT unique_file_share UNIQUE (file_id, shared_with)
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_files_username ON files(username);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_shared_files_with ON shared_files(shared_with);")
