"""add Ask Basis daily usage counter

The counter is keyed by UTC date and updated atomically by the endpoint. It
persists across API restarts, unlike the deliberately in-process per-IP
sliding-window limiter.

Revision ID: d9e4f6a1b2c3
Revises: c8d9e2f1a4b6
Create Date: 2026-07-31
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d9e4f6a1b2c3"
down_revision: str | None = "c8d9e2f1a4b6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ask_daily_usage",
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("question_count", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("day"),
    )


def downgrade() -> None:
    op.drop_table("ask_daily_usage")
