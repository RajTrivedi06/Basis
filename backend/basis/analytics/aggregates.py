"""Analytics orchestrator.

Pulls canonical offers from the DB, computes dispersion rows and
decomposition rows, and upserts them into daily_aggregates and
basis_decomposition.

Idempotent: re-running for the same (date, gpu_sku) replaces the
existing rows.
"""

from __future__ import annotations

import datetime
import logging
from dataclasses import dataclass

import pandas as pd
from sqlalchemy import and_, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from basis.analytics.basis import DecompositionRow, compute_decompositions
from basis.analytics.dispersion import DispersionRow, compute_dispersion
from basis.db.models import BasisDecomposition, CanonicalOffer, DailyAggregate, RawObservation

logger = logging.getLogger(__name__)

DEFAULT_METHOD_VERSION = "v1-joint-cell"
"""The sequential joint-cell partition ``compute_decompositions`` implements."""


async def run_analytics(
    session: AsyncSession,
    only_date: datetime.date | None = None,
    only_gpu_sku: str | None = None,
) -> dict:
    """Run the analytics pipeline and upsert results.

    Args:
        session: async SQLAlchemy session.
        only_date: if set, restrict processing to this collection date.
        only_gpu_sku: if set, restrict processing to this canonical SKU.

    Returns a summary dict with counts.
    """
    offers = await _load_canonical_offers(session, only_date, only_gpu_sku)
    logger.info("Loaded %d canonical offers for analytics", len(offers))

    if offers.empty:
        logger.warning("No canonical offers matched filters — nothing to do")
        return {"offers_loaded": 0, "aggregates_written": 0, "decompositions_written": 0}

    # Derive a date column from collected_at (UTC).
    offers["date"] = pd.to_datetime(offers["collected_at"], utc=True).dt.date

    dispersion_rows = compute_dispersion(offers)
    decomposition_rows = compute_decompositions(offers)

    logger.info(
        "Computed %d dispersion rows, %d decomposition rows",
        len(dispersion_rows),
        len(decomposition_rows),
    )

    # Replace the entire requested scope, not just the pairs we happen to emit.
    # A slice that dropped below the minimum-observation threshold, or lost all
    # of its source offers, emits nothing — and used to keep its stale row.
    scope = _ReplaceScope(only_date=only_date, only_gpu_sku=only_gpu_sku)
    await _upsert_aggregates(session, dispersion_rows, scope=scope)
    await _upsert_decompositions(session, decomposition_rows, scope=scope)
    await session.commit()

    return {
        "offers_loaded": len(offers),
        "aggregates_written": len(dispersion_rows),
        "decompositions_written": len(decomposition_rows),
    }


async def _load_canonical_offers(
    session: AsyncSession,
    only_date: datetime.date | None,
    only_gpu_sku: str | None,
) -> pd.DataFrame:
    """Pull canonical offers as a pandas DataFrame."""
    query = select(
        CanonicalOffer.id,
        CanonicalOffer.collected_at,
        CanonicalOffer.gpu_sku_canonical,
        CanonicalOffer.provider,
        CanonicalOffer.commitment_type,
        CanonicalOffer.region_country,
        CanonicalOffer.vcpus_bundled,
        CanonicalOffer.ram_gb_bundled,
        CanonicalOffer.storage_gb_bundled,
        CanonicalOffer.price_usd_per_hour,
        CanonicalOffer.normalized_price_usd_per_hour,
    ).join(
        RawObservation, CanonicalOffer.raw_observation_id == RawObservation.id
    ).where(
        # ADR-0007: the live market series is a same-mechanism cron sample.
        # Backfill rows exist for ML training history; at the backfill's
        # coverage boundary their extra density creates a population
        # discontinuity that masquerades as a market change.
        func.coalesce(RawObservation.provider_metadata["backfill"].astext, "")
        .notin_(["true", "t", "1"])
    )

    if only_gpu_sku:
        query = query.where(CanonicalOffer.gpu_sku_canonical == only_gpu_sku)

    result = await session.execute(query)
    rows = result.all()
    df = pd.DataFrame(rows, columns=result.keys())

    if only_date:
        day_start = datetime.datetime.combine(only_date, datetime.time.min, tzinfo=datetime.UTC)
        day_end = day_start + datetime.timedelta(days=1)
        ts = pd.to_datetime(df["collected_at"], utc=True)
        df = df[(ts >= day_start) & (ts < day_end)].copy()

    return df


@dataclass(frozen=True)
class _ReplaceScope:
    """The (date, gpu_sku) region a materialization run is responsible for.

    ``None`` on either axis means "every value of that axis". The scope is what
    gets deleted before insert, so an output whose input slice became
    ineligible is removed rather than left behind.
    """

    only_date: datetime.date | None
    only_gpu_sku: str | None
    # A rebuild replaces one estimand's rows, never another's: a v1 recompute
    # must not delete v2-additive output that shares the (date, sku) scope.
    method_version: str = DEFAULT_METHOD_VERSION

    def clause(
        self, model: type[DailyAggregate] | type[BasisDecomposition]
    ) -> list[ColumnElement[bool]]:
        conds: list[ColumnElement[bool]] = []
        if self.only_date is not None:
            conds.append(model.date == self.only_date)
        if self.only_gpu_sku is not None:
            conds.append(model.gpu_sku == self.only_gpu_sku)
        if model is BasisDecomposition:
            conds.append(BasisDecomposition.method_version == self.method_version)
        return conds


async def _delete_scope(
    session: AsyncSession,
    model: type[DailyAggregate] | type[BasisDecomposition],
    scope: _ReplaceScope,
) -> None:
    conds = scope.clause(model)
    stmt = delete(model)
    if conds:
        stmt = stmt.where(and_(*conds))
    await session.execute(stmt)


async def _upsert_aggregates(
    session: AsyncSession, rows: list[DispersionRow], *, scope: _ReplaceScope
) -> None:
    """Replace every daily_aggregates row in ``scope``, then insert ``rows``.

    Runs even when ``rows`` is empty: an empty result for a scope means the
    scope has no eligible output, and the previous output must go.
    """
    await _delete_scope(session, DailyAggregate, scope)
    if not rows:
        return

    session.add_all(
        [
            DailyAggregate(
                date=r.date,
                gpu_sku=r.gpu_sku,
                provider=r.provider,
                region=r.region,
                observation_count=r.observation_count,
                median_price=r.median_price,
                p25_price=r.p25_price,
                p75_price=r.p75_price,
                normalized_median_price=r.normalized_median_price,
            )
            for r in rows
        ]
    )


async def _upsert_decompositions(
    session: AsyncSession, rows: list[DecompositionRow], *, scope: _ReplaceScope
) -> None:
    """Replace every basis_decomposition row in ``scope``, then insert ``rows``."""
    await _delete_scope(session, BasisDecomposition, scope)
    if not rows:
        return

    session.add_all(
        [
            BasisDecomposition(
                date=r.date,
                gpu_sku=r.gpu_sku,
                total_variance=r.total_variance,
                variance_from_region=r.variance_from_region,
                variance_from_commitment=r.variance_from_commitment,
                variance_from_bundle=r.variance_from_bundle,
                variance_from_provider=r.variance_from_provider,
                residual_variance=r.residual_variance,
                method_version=scope.method_version,
            )
            for r in rows
        ]
    )
