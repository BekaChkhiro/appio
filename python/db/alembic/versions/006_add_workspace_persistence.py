"""Add workspace_url and workspace_expires_at to generations.

T2.18 — Workspace persistence to R2 for conversational refinement.

Revision ID: 006
Revises: 005
"""

import sqlalchemy as sa
from alembic import op

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "generations",
        sa.Column("workspace_url", sa.Text(), nullable=True),
    )
    op.add_column(
        "generations",
        sa.Column(
            "workspace_expires_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("generations", "workspace_expires_at")
    op.drop_column("generations", "workspace_url")
