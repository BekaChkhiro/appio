"""widen publish status columns

VARCHAR(20) overflowed for status='validating_credentials' (22 chars).
Bumping to 50 to fit any reasonable step name.

Revision ID: 013
Revises: 012
Create Date: 2026-04-26 00:30:00
"""

import sqlalchemy as sa
from alembic import op


revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "app_publish_jobs",
        "status",
        existing_type=sa.String(20),
        type_=sa.String(50),
    )
    op.alter_column(
        "apps",
        "publish_status",
        existing_type=sa.String(20),
        type_=sa.String(50),
    )


def downgrade() -> None:
    op.alter_column(
        "app_publish_jobs",
        "status",
        existing_type=sa.String(50),
        type_=sa.String(20),
    )
    op.alter_column(
        "apps",
        "publish_status",
        existing_type=sa.String(50),
        type_=sa.String(20),
    )
