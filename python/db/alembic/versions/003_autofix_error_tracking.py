"""T2.7: Add AutoFix error tracking columns.

Adds to `generations`:
  - autofix_attempts (int, default 0)
  - last_error_stage (varchar 20, nullable)
  - error_context (JSONB, nullable)

Adds to `templates`:
  - total_builds (int, default 0)
  - successful_builds (int, default 0)
  - failed_builds (int, default 0)
  - autofix_triggered (int, default 0)
  - autofix_resolved (int, default 0)

Revision ID: 003_autofix_tracking
Revises: 002_seed_templates
Create Date: 2026-04-07
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "003_autofix_tracking"
down_revision = "002_seed_templates"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- generations table ---
    op.add_column(
        "generations",
        sa.Column("autofix_attempts", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "generations",
        sa.Column("last_error_stage", sa.String(20), nullable=True),
    )
    op.add_column(
        "generations",
        sa.Column("error_context", JSONB(), nullable=True),
    )

    # --- templates table ---
    op.add_column(
        "templates",
        sa.Column("total_builds", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "templates",
        sa.Column("successful_builds", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "templates",
        sa.Column("failed_builds", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "templates",
        sa.Column("autofix_triggered", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "templates",
        sa.Column("autofix_resolved", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("templates", "autofix_resolved")
    op.drop_column("templates", "autofix_triggered")
    op.drop_column("templates", "failed_builds")
    op.drop_column("templates", "successful_builds")
    op.drop_column("templates", "total_builds")
    op.drop_column("generations", "error_context")
    op.drop_column("generations", "last_error_stage")
    op.drop_column("generations", "autofix_attempts")
