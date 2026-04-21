"""Analytics integrity tests.

Protect the headline finding. The decomposition math asserts

    total_variance = sum(variance_from_*) + residual_variance

for every row. A bug in the sequential ANOVA that broke this identity would
silently corrupt `findings.md`'s claims. The threshold tests protect the
published minimum-n rules: dispersion needs >= 3 observations per bucket,
decomposition needs >= 5.
"""

import datetime

import pytest
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from basis.analytics.basis import MIN_OBSERVATIONS as DECOMP_MIN
from basis.analytics.dispersion import MIN_OBSERVATIONS as DISP_MIN
from basis.db.models import BasisDecomposition, CanonicalOffer, DailyAggregate

# The decomposition identity is a sum of up to 5 floats; 1e-9 is generous
# given how small the individual variances are (~0.01 - 1.0 range).
DECOMP_TOLERANCE = 1e-9


@pytest.mark.asyncio
async def test_decomposition_components_sum_to_total(db_session: AsyncSession) -> None:
    """For every basis_decomposition row, components + residual == total.

    This is the fundamental integrity property of sequential ANOVA. If this
    fails on any row, either the decomposition math is broken or the row
    is corrupt.
    """
    rows = (await db_session.execute(select(BasisDecomposition))).scalars().all()
    if not rows:
        pytest.skip("No basis_decomposition rows in DB; nothing to verify.")

    failures: list[str] = []
    for r in rows:
        components_sum = (
            r.variance_from_region
            + r.variance_from_commitment
            + r.variance_from_provider
            + r.variance_from_bundle
            + r.residual_variance
        )
        diff = abs(components_sum - r.total_variance)
        if diff > DECOMP_TOLERANCE:
            failures.append(
                f"({r.date}, {r.gpu_sku}): components+residual={components_sum:.12f} "
                f"total={r.total_variance:.12f} diff={diff:.2e}"
            )

    assert not failures, (
        f"Decomposition identity violated on {len(failures)} of {len(rows)} rows "
        f"(tolerance={DECOMP_TOLERANCE:.0e}). First failures:\n  "
        + "\n  ".join(failures[:5])
    )


@pytest.mark.asyncio
async def test_dispersion_threshold_respected(db_session: AsyncSession) -> None:
    """Every daily_aggregates row has observation_count >= DISP_MIN (3)."""
    total = (
        await db_session.execute(select(func.count(DailyAggregate.id)))
    ).scalar_one()
    if total == 0:
        pytest.skip("No daily_aggregates rows in DB; nothing to verify.")

    offenders = (
        await db_session.execute(
            select(DailyAggregate).where(DailyAggregate.observation_count < DISP_MIN)
        )
    ).scalars().all()

    assert not offenders, (
        f"{len(offenders)} daily_aggregates rows below the "
        f"observation_count >= {DISP_MIN} threshold: "
        + ", ".join(
            f"(date={o.date}, gpu_sku={o.gpu_sku}, provider={o.provider}, "
            f"n={o.observation_count})"
            for o in offenders[:5]
        )
    )


@pytest.mark.asyncio
async def test_decomposition_threshold_respected(db_session: AsyncSession) -> None:
    """Every basis_decomposition row comes from >= DECOMP_MIN (5) canonical offers.

    Counts canonical_offers joined on (gpu_sku_canonical, DATE(collected_at UTC)).
    Uses an explicit UTC-day range per decomposition row, matching the
    `pd.to_datetime(collected_at, utc=True).dt.date` bucketing in
    analytics/aggregates.py.
    """
    decomp_rows = (
        await db_session.execute(select(BasisDecomposition))
    ).scalars().all()
    if not decomp_rows:
        pytest.skip("No basis_decomposition rows in DB; nothing to verify.")

    offenders: list[str] = []
    for d in decomp_rows:
        start_utc = datetime.datetime.combine(
            d.date, datetime.time.min, tzinfo=datetime.UTC
        )
        end_utc = start_utc + datetime.timedelta(days=1)
        count = (
            await db_session.execute(
                select(func.count(CanonicalOffer.id)).where(
                    and_(
                        CanonicalOffer.gpu_sku_canonical == d.gpu_sku,
                        CanonicalOffer.collected_at >= start_utc,
                        CanonicalOffer.collected_at < end_utc,
                    )
                )
            )
        ).scalar_one()
        if count < DECOMP_MIN:
            offenders.append(
                f"(date={d.date}, gpu_sku={d.gpu_sku}): {count} offers "
                f"< DECOMP_MIN={DECOMP_MIN}"
            )

    assert not offenders, (
        f"{len(offenders)} decomposition rows produced from too few offers:\n  "
        + "\n  ".join(offenders[:5])
    )
