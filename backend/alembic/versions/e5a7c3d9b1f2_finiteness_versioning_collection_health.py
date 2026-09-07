"""Price finiteness checks, method/population versioning, collection_health.

Revision ID: e5a7c3d9b1f2
Revises: d9e4f6a1b2c3
Create Date: 2026-09-06

From the 2026-09-06 mathematical review:

* ``gt=0`` alone admits +Infinity and NaN. In PostgreSQL both sort above every
  finite value, so ``price > 0`` is TRUE for them; ``price < 'Infinity'::float8``
  is FALSE for both. Production held zero violating rows at review time; the
  scan adding the constraint reads rows and does not alter raw_observations'
  immutability.
* ``method_version`` / ``population_id`` must exist before any historical
  output is rebuilt, so a rebuild is a new versioned row set rather than an
  in-place overwrite. Existing rows are labelled ``v1-joint-cell`` with a NULL
  population — the pre-versioning population.
* ``collection_health`` gives the volume alert a persistent, non-adaptive
  completeness state to read.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "e5a7c3d9b1f2"
down_revision: str | None = "d9e4f6a1b2c3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_check_constraint(
        "ck_raw_obs_price_finite",
        "raw_observations",
        "price_hourly > 0 AND price_hourly < 'Infinity'::float8",
    )
    op.create_check_constraint(
        "ck_canonical_price_finite",
        "canonical_offers",
        "price_usd_per_hour > 0 AND price_usd_per_hour < 'Infinity'::float8",
    )
    op.create_check_constraint(
        "ck_canonical_norm_price_finite",
        "canonical_offers",
        "normalized_price_usd_per_hour IS NULL OR "
        "(normalized_price_usd_per_hour > 0 "
        "AND normalized_price_usd_per_hour < 'Infinity'::float8)",
    )

    op.add_column(
        "daily_aggregates",
        sa.Column("population_id", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "basis_decomposition",
        sa.Column(
            "method_version",
            sa.String(length=40),
            nullable=False,
            server_default="v1-joint-cell",
        ),
    )
    op.add_column(
        "basis_decomposition",
        sa.Column("population_id", sa.String(length=64), nullable=True),
    )
    op.create_index("ix_basis_decomp_method", "basis_decomposition", ["method_version"])

    op.create_table(
        "collection_health",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("collected_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source", sa.String(length=50), nullable=False),
        sa.Column("commitment_type", sa.String(length=50), nullable=False),
        sa.Column("cap", sa.Integer(), nullable=False),
        sa.Column("bands_total", sa.Integer(), nullable=False),
        sa.Column("bands_incomplete", sa.Integer(), nullable=False),
        sa.Column("offers_returned", sa.Integer(), nullable=False),
        sa.Column("offers_unique", sa.Integer(), nullable=False),
        sa.Column("exhaustive", sa.Boolean(), nullable=False),
        sa.Column("desc_check_missing", sa.Integer(), nullable=True),
        sa.Column("probe_missing", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.create_index(
        "ix_collection_health_source_ts",
        "collection_health",
        ["source", "commitment_type", "collected_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_collection_health_source_ts", table_name="collection_health")
    op.drop_table("collection_health")
    op.drop_index("ix_basis_decomp_method", table_name="basis_decomposition")
    op.drop_column("basis_decomposition", "population_id")
    op.drop_column("basis_decomposition", "method_version")
    op.drop_column("daily_aggregates", "population_id")
    op.drop_constraint("ck_canonical_norm_price_finite", "canonical_offers", type_="check")
    op.drop_constraint("ck_canonical_price_finite", "canonical_offers", type_="check")
    op.drop_constraint("ck_raw_obs_price_finite", "raw_observations", type_="check")
