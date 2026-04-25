"""Add convex_oauth_tokens, convex_deployments, app_publish_jobs tables and
publish columns on apps (T3.6).

Revision ID: 010
Revises: 009
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ARRAY, UUID

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "convex_oauth_tokens",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("team_slug", sa.String(255), nullable=False),
        sa.Column("access_token_encrypted", sa.Text, nullable=False),
        sa.Column("refresh_token_encrypted", sa.Text, nullable=True),
        sa.Column(
            "scopes",
            ARRAY(sa.String(100)),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_refreshed_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.UniqueConstraint("user_id", name="uq_convex_oauth_tokens_user_id"),
    )
    op.create_index("ix_convex_oauth_tokens_user_id", "convex_oauth_tokens", ["user_id"])

    op.create_table(
        "convex_deployments",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("app_id", UUID(as_uuid=True), sa.ForeignKey("apps.id"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("deployment_name", sa.String(255), nullable=False),
        sa.Column("deployment_url", sa.Text, nullable=False),
        sa.Column("team_slug", sa.String(255), nullable=False),
        sa.Column("project_slug", sa.String(255), nullable=False),
        sa.Column(
            "provisioned_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
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
        sa.UniqueConstraint("app_id", name="uq_convex_deployments_app_id"),
    )
    op.create_index("ix_convex_deployments_user_id", "convex_deployments", ["user_id"])
    op.create_index("ix_convex_deployments_app_id", "convex_deployments", ["app_id"])

    op.create_table(
        "app_publish_jobs",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("app_id", UUID(as_uuid=True), sa.ForeignKey("apps.id"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("current_step", sa.String(50), nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("deployment_url", sa.Text, nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
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
    op.create_index("ix_app_publish_jobs_app_id", "app_publish_jobs", ["app_id"])
    op.create_index("ix_app_publish_jobs_user_id", "app_publish_jobs", ["user_id"])
    op.create_index(
        "ix_app_publish_jobs_app_status",
        "app_publish_jobs",
        ["app_id", "status"],
    )
    op.create_index(
        "ix_app_publish_jobs_user_created",
        "app_publish_jobs",
        ["user_id", "created_at"],
    )

    op.add_column("apps", sa.Column("published_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("apps", sa.Column("publish_status", sa.String(20), nullable=True))
    op.add_column("apps", sa.Column("sandbox_archived_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("apps", "sandbox_archived_at")
    op.drop_column("apps", "publish_status")
    op.drop_column("apps", "published_at")

    op.drop_index("ix_app_publish_jobs_user_created", table_name="app_publish_jobs")
    op.drop_index("ix_app_publish_jobs_app_status", table_name="app_publish_jobs")
    op.drop_index("ix_app_publish_jobs_user_id", table_name="app_publish_jobs")
    op.drop_index("ix_app_publish_jobs_app_id", table_name="app_publish_jobs")
    op.drop_table("app_publish_jobs")

    op.drop_index("ix_convex_deployments_app_id", table_name="convex_deployments")
    op.drop_index("ix_convex_deployments_user_id", table_name="convex_deployments")
    op.drop_table("convex_deployments")

    op.drop_index("ix_convex_oauth_tokens_user_id", table_name="convex_oauth_tokens")
    op.drop_table("convex_oauth_tokens")
