"""Add user_themes table for AI-generated theme personas (T4.1).

Revision ID: 009
Revises: 008
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_themes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("source_kind", sa.String(20), nullable=False),
        sa.Column("source_prompt", sa.Text, nullable=True),
        sa.Column("source_image_url", sa.Text, nullable=True),
        sa.Column("persona_json", JSONB, nullable=False),
        sa.Column("cost_usd", sa.Float, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_user_themes_user_id", "user_themes", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_user_themes_user_id", table_name="user_themes")
    op.drop_table("user_themes")
