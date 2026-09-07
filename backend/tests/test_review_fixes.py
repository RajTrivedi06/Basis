"""Regression tests for the 2026-09-06 mathematical review, phases 1-2.

Each test names the finding it guards. Database-backed tests use the shared
``db_session`` fixture and roll back what they insert.
"""

from __future__ import annotations

import datetime
import math

import pandas as pd
import pytest
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from basis.analytics.aggregates import (
    _ReplaceScope,
    _upsert_aggregates,
    _upsert_decompositions,
)
from basis.analytics.basis import DecompositionRow
from basis.db.models import BasisDecomposition, DailyAggregate
from basis.ml.features import _deduplicate_last_daily, _offer_identity
from basis.schemas.canonical import CanonicalOfferCreate
from basis.schemas.raw import RawObservationCreate

D = datetime.date(2099, 1, 1)  # far from any fixture date
NOW = datetime.datetime(2099, 1, 1, 12, tzinfo=datetime.UTC)


# --- Finding 5: RunPod tier is part of the daily offer identity ----------------


def test_runpod_identity_separates_cloud_tiers() -> None:
    idents = {
        tier: _offer_identity(
            provider="runpod",
            payload={"id": "NVIDIA H100 80GB HBM3"},
            provider_metadata={"runpod_id": "NVIDIA H100 80GB HBM3", "cloud_tier": tier},
            raw_region=None,
            included_features={},
        )
        for tier in ("community", "secure")
    }
    assert idents["community"] != idents["secure"]


def test_runpod_daily_dedupe_keeps_both_tiers() -> None:
    rows = []
    for i, tier in enumerate(("community", "secure")):
        ident = _offer_identity(
            provider="runpod",
            payload={"id": "h100"},
            provider_metadata={"runpod_id": "h100", "cloud_tier": tier},
            raw_region=None,
            included_features={},
        )
        rows.append(
            {
                "provider": "runpod",
                "offer_identity": ident,
                "commitment_type": "on_demand",
                "collected_day": D,
                "collected_at": str(D),
                "canonical_offer_id": i,
                "tier": tier,
            }
        )
    kept = _deduplicate_last_daily(pd.DataFrame(rows))
    assert sorted(kept["tier"]) == ["community", "secure"]


# --- Register: schemas reject non-finite prices --------------------------------


@pytest.mark.parametrize("bad", [math.inf, -math.inf, math.nan, 0.0, -1.0])
def test_raw_schema_rejects_non_finite_or_non_positive_price(bad: float) -> None:
    with pytest.raises(ValidationError):
        RawObservationCreate(
            source="vast",
            collected_at=NOW,
            raw_payload={},
            gpu_model_reported="H100 SXM",
            price_hourly=bad,
        )


@pytest.mark.parametrize("bad", [math.inf, math.nan, 0.0])
def test_canonical_schema_rejects_non_finite_or_non_positive_price(bad: float) -> None:
    with pytest.raises(ValidationError):
        CanonicalOfferCreate(
            raw_observation_id=1,
            collected_at=NOW,
            gpu_sku_canonical="h100_sxm_80gb",
            provider="vast",
            commitment_type="on_demand",
            price_usd_per_hour=bad,
        )


# --- Finding 12: materialization replaces the whole requested scope -----------


def _decomp(date: datetime.date, sku: str) -> DecompositionRow:
    return DecompositionRow(
        date=date,
        gpu_sku=sku,
        total_variance=1.0,
        variance_from_region=0.1,
        variance_from_commitment=0.2,
        variance_from_bundle=0.3,
        variance_from_provider=0.1,
        residual_variance=0.3,
    )


def test_replace_scope_clause_shapes() -> None:
    """Aggregates scope on (date, sku); decompositions additionally on method."""
    assert _ReplaceScope(only_date=None, only_gpu_sku=None).clause(DailyAggregate) == []
    assert len(_ReplaceScope(only_date=D, only_gpu_sku="x").clause(DailyAggregate)) == 2
    # A decomposition scope is never unbounded: the method is always pinned.
    assert len(_ReplaceScope(only_date=None, only_gpu_sku=None).clause(BasisDecomposition)) == 1
    assert len(_ReplaceScope(only_date=D, only_gpu_sku=None).clause(BasisDecomposition)) == 2
    assert len(_ReplaceScope(only_date=D, only_gpu_sku="x").clause(BasisDecomposition)) == 3


@pytest.mark.asyncio
async def test_v1_rebuild_leaves_other_method_versions_alone(db_session: AsyncSession) -> None:
    """Versioning exists so a rebuild is a new row set, not an overwrite."""
    sku = "review_method_sku"
    v1 = _ReplaceScope(only_date=D, only_gpu_sku=sku)  # default v1-joint-cell
    v2 = _ReplaceScope(only_date=D, only_gpu_sku=sku, method_version="v2-additive")
    try:
        await _upsert_decompositions(db_session, [_decomp(D, sku)], scope=v1)
        await _upsert_decompositions(db_session, [_decomp(D, sku)], scope=v2)
        await db_session.flush()
        assert sorted(r.method_version for r in await _decomps_for(db_session, sku)) == [
            "v1-joint-cell",
            "v2-additive",
        ]
        # Re-materialize v1 with nothing eligible: only the v1 row may go.
        await _upsert_decompositions(db_session, [], scope=v1)
        await db_session.flush()
        assert [r.method_version for r in await _decomps_for(db_session, sku)] == ["v2-additive"]
    finally:
        await db_session.rollback()


async def _decomps_for(session: AsyncSession, sku: str) -> list[BasisDecomposition]:
    return list(
        (
            await session.execute(
                select(BasisDecomposition).where(
                    BasisDecomposition.gpu_sku == sku, BasisDecomposition.date == D
                )
            )
        ).scalars().all()
    )


@pytest.mark.asyncio
async def test_ineligible_slice_is_removed_on_rematerialize(db_session: AsyncSession) -> None:
    """Eligible -> ineligible: a slice that emits nothing must lose its old row."""
    sku = "review_test_sku"
    scope = _ReplaceScope(only_date=D, only_gpu_sku=sku)
    try:
        await _upsert_decompositions(db_session, [_decomp(D, sku)], scope=scope)
        await db_session.flush()
        assert len(await _decomps_for(db_session, sku)) == 1

        await _upsert_decompositions(db_session, [], scope=scope)
        await db_session.flush()
        assert await _decomps_for(db_session, sku) == [], (
            "stale decomposition survived an empty re-materialization"
        )
    finally:
        await db_session.rollback()


@pytest.mark.asyncio
async def test_scope_delete_does_not_touch_other_skus(db_session: AsyncSession) -> None:
    a, b = "review_sku_a", "review_sku_b"
    try:
        await _upsert_decompositions(
            db_session, [_decomp(D, a)], scope=_ReplaceScope(only_date=D, only_gpu_sku=a)
        )
        await _upsert_decompositions(
            db_session, [_decomp(D, b)], scope=_ReplaceScope(only_date=D, only_gpu_sku=b)
        )
        await db_session.flush()
        await _upsert_decompositions(
            db_session, [], scope=_ReplaceScope(only_date=D, only_gpu_sku=a)
        )
        await db_session.flush()
        assert await _decomps_for(db_session, a) == []
        assert len(await _decomps_for(db_session, b)) == 1
    finally:
        await db_session.rollback()


@pytest.mark.asyncio
async def test_aggregate_scope_replacement_with_empty_result(db_session: AsyncSession) -> None:
    sku = "review_agg_sku"
    scope = _ReplaceScope(only_date=D, only_gpu_sku=sku)
    try:
        db_session.add(
            DailyAggregate(
                date=D, gpu_sku=sku, provider=None, region=None, observation_count=5,
                median_price=1.0, p25_price=0.9, p75_price=1.1, normalized_median_price=None,
            )
        )
        await db_session.flush()
        await _upsert_aggregates(db_session, [], scope=scope)
        await db_session.flush()
        left = (
            await db_session.execute(
                select(DailyAggregate).where(
                    DailyAggregate.gpu_sku == sku, DailyAggregate.date == D
                )
            )
        ).scalars().all()
        assert left == []
    finally:
        await db_session.rollback()
