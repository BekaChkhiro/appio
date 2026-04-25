"""Ops indexes + slug URL-safety constraints.

Adds indexes that back the admin cost dashboard and the rate_limit DB
fallback (last-24h lookups), plus CHECK constraints that guarantee slugs
are URL-safe (lowercase alphanumeric + hyphens).

Revision ID: 008
Revises: 007_app_templates
"""

import sqlalchemy as sa
from alembic import op

revision = "008"
down_revision = "007_app_templates"
branch_labels = None
depends_on = None


_SLUG_PATTERN = r"^[a-z0-9](?:[a-z0-9\-]{0,98}[a-z0-9])?$"


def upgrade() -> None:
    # ── generations: range-scan indexes ────────────────────────────────
    # Cost dashboard ranges over created_at per month; rate_limit DB
    # fallback ranges over last 24h per user.
    op.create_index(
        "ix_generations_created_at_desc",
        "generations",
        [sa.text("created_at DESC")],
    )
    op.create_index(
        "ix_generations_build_status",
        "generations",
        ["build_status"],
    )
    # Composite for the common "user + recent" access pattern (per-user
    # cost detail, user dashboard). Postgres uses user_id as the leading
    # filter and created_at for sort.
    op.create_index(
        "ix_generations_user_id_created_at",
        "generations",
        ["user_id", sa.text("created_at DESC")],
    )

    # ── apps.slug CHECK constraint ─────────────────────────────────────
    op.create_check_constraint(
        "ck_apps_slug_url_safe",
        "apps",
        sa.text(f"slug ~ '{_SLUG_PATTERN}'"),
    )

    # ── app_templates.slug CHECK constraint ───────────────────────────
    op.create_check_constraint(
        "ck_app_templates_slug_url_safe",
        "app_templates",
        sa.text(f"slug ~ '{_SLUG_PATTERN}'"),
    )


def downgrade() -> None:
    op.drop_constraint("ck_app_templates_slug_url_safe", "app_templates", type_="check")
    op.drop_constraint("ck_apps_slug_url_safe", "apps", type_="check")
    op.drop_index("ix_generations_user_id_created_at", table_name="generations")
    op.drop_index("ix_generations_build_status", table_name="generations")
    op.drop_index("ix_generations_created_at_desc", table_name="generations")
