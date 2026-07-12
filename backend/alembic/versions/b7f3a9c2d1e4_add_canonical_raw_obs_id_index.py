"""add index on canonical_offers.raw_observation_id

Speeds up the normalization anti-join (find raw observations that don't yet
have a canonical offer). A foreign key does not auto-create an index in
Postgres, so the check full-scanned canonical_offers; once both tables passed
~300k rows the pipeline's count query ran for tens of minutes and stalled the
collect service. See docs/analysis/2026-07-11-findings-refresh.md.

Uses CREATE INDEX IF NOT EXISTS because the index was created manually on
production (2026-07-12) during the incident, before this migration existed —
this makes the migration a no-op there and a real create everywhere else.

Revision ID: b7f3a9c2d1e4
Revises: fac2a232ed22
Create Date: 2026-07-12
"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b7f3a9c2d1e4"
down_revision: str | None = "fac2a232ed22"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_canonical_raw_obs_id "
        "ON canonical_offers (raw_observation_id)"
    )


def downgrade() -> None:
    op.drop_index("ix_canonical_raw_obs_id", table_name="canonical_offers")
