"""Add pgvector extension and rag_snippets table.

Revision ID: 005
Revises: 004
Create Date: 2026-04-11
"""

from alembic import op

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable pgvector extension (Neon supports this natively)
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.execute("""
        CREATE TABLE rag_snippets (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            category VARCHAR(50) NOT NULL,
            title VARCHAR(255) NOT NULL,
            content TEXT NOT NULL,
            tags TEXT[] NOT NULL DEFAULT '{}',
            embedding vector(1024) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    # Indexes
    op.execute("CREATE INDEX ix_rag_snippets_category ON rag_snippets (category)")
    op.execute(
        "CREATE INDEX ix_rag_snippets_embedding ON rag_snippets "
        "USING hnsw (embedding vector_cosine_ops) "
        "WITH (m = 16, ef_construction = 64)"
    )
    op.execute("CREATE INDEX ix_rag_snippets_tags ON rag_snippets USING gin (tags)")


def downgrade() -> None:
    op.drop_table("rag_snippets")
    op.execute("DROP EXTENSION IF EXISTS vector")
