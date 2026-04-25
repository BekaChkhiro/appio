"""Add preview_url and public_url to generations.

Revision ID: 004
Revises: 003
"""

import sqlalchemy as sa
from alembic import op

revision = "004"
down_revision = "003_autofix_tracking"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("generations", sa.Column("preview_url", sa.Text(), nullable=True))
    op.add_column("generations", sa.Column("public_url", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("generations", "public_url")
    op.drop_column("generations", "preview_url")
