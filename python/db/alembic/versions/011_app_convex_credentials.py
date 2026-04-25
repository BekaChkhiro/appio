"""Add app_convex_credentials table for deploy-key-based publish flow (T3.8).

Part of the ADR 007 shift from OAuth partner integration to per-app deploy
key paste. This migration is intentionally additive — the legacy
``convex_oauth_tokens`` table is left in place for now and will be
dropped in a follow-up migration once the endpoint refactor lands and
no reader code references it.

Revision ID: 011
Revises: 010
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "app_convex_credentials",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "app_id",
            UUID(as_uuid=True),
            sa.ForeignKey("apps.id"),
            nullable=False,
        ),
        sa.Column(
            "created_by_user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("deployment_url", sa.Text, nullable=False),
        sa.Column("deploy_key_encrypted", sa.Text, nullable=False),
        sa.Column("team_slug", sa.String(255), nullable=True),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.UniqueConstraint("app_id", name="uq_app_convex_credentials_app_id"),
    )
    op.create_index(
        "ix_app_convex_credentials_app_id",
        "app_convex_credentials",
        ["app_id"],
    )
    op.create_index(
        "ix_app_convex_credentials_created_by_user_id",
        "app_convex_credentials",
        ["created_by_user_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_app_convex_credentials_created_by_user_id",
        table_name="app_convex_credentials",
    )
    op.drop_index(
        "ix_app_convex_credentials_app_id",
        table_name="app_convex_credentials",
    )
    op.drop_table("app_convex_credentials")
