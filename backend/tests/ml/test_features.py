from __future__ import annotations

import math
import re
from datetime import date, datetime, time, timedelta
from pathlib import Path

import numpy as np
import pandas as pd  # type: ignore[import-untyped]
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from basis.db.models import CanonicalOffer, RawObservation
from basis.ml import features
from basis.ml.features import (
    BANNED_FEATURE_SUBSTRINGS,
    FEATURE_COLUMNS,
    HIGH_CARDINALITY_PAYLOAD_KEYS,
    METADATA_COLUMNS,
    TARGET_COLUMN,
    TOP_CATEGORY_COUNT,
    TRAINED_PROVIDERS,
    TRIAGED_VAST_PAYLOAD_KEYS,
    VAST_EXCLUDED_IDENTITY_KEYS,
    VAST_EXCLUDED_PRICE_KEYS,
    VAST_EXPECTED_FULL_PAYLOAD_KEYS,
    VAST_INCLUDED_PAYLOAD_KEYS,
    _deduplicate_last_daily,
    derive_era,
    extract_features,
)


def test_feature_inventory_matches_approved_design() -> None:
    """The three §3.2 lists are disjoint, exhaustive, and leakage-free."""
    assert TRAINED_PROVIDERS == ("vast", "runpod", "aws_spot", "tensordock")

    included = set(VAST_INCLUDED_PAYLOAD_KEYS)
    excluded_price = set(VAST_EXCLUDED_PRICE_KEYS)
    excluded_identity = set(VAST_EXCLUDED_IDENTITY_KEYS)

    assert len(included) == 51
    assert len(excluded_price) == 22
    assert len(excluded_identity) == 27
    assert not included & excluded_price
    assert not included & excluded_identity
    assert not excluded_price & excluded_identity
    assert included | excluded_price | excluded_identity == TRIAGED_VAST_PAYLOAD_KEYS

    banned = {
        column
        for column in FEATURE_COLUMNS
        if any(token in column.casefold() for token in BANNED_FEATURE_SUBSTRINGS)
    }
    assert not banned

    payload_candidates = set(FEATURE_COLUMNS) & TRIAGED_VAST_PAYLOAD_KEYS
    assert payload_candidates == included
    assert TARGET_COLUMN not in FEATURE_COLUMNS
    assert not set(METADATA_COLUMNS) & set(FEATURE_COLUMNS)


def test_era_derivation_is_total_from_2026_through_today() -> None:
    current = date(2026, 1, 1)
    today = date.today()
    observed_labels: set[str] = set()

    while current <= today:
        label = derive_era(current)
        assert label in features.ERA_LABELS
        observed_labels.add(label)
        current += timedelta(days=1)

    assert derive_era(date(2026, 1, 1)) == "era_0_backfill"
    assert derive_era(date(2026, 4, 25)) == "era_0_backfill"
    assert derive_era(date(2026, 4, 26)) == "A"
    assert derive_era(date(2026, 6, 16)) == "B"
    assert derive_era(date(2026, 7, 12)) == "C"
    assert derive_era(date(2026, 7, 26)) == "D"
    assert observed_labels == set(features.ERA_LABELS)


def test_daily_dedup_keeps_last_collection_run() -> None:
    day = date(2026, 7, 29)
    frame = pd.DataFrame(
        [
            {
                "canonical_offer_id": 1,
                "collected_at": datetime.combine(day, time(8, 0)),
                "collected_day": day,
                "provider": "vast",
                "offer_identity": "vast:machine",
                "commitment_type": "on_demand",
            },
            {
                "canonical_offer_id": 2,
                "collected_at": datetime.combine(day, time(20, 0)),
                "collected_day": day,
                "provider": "vast",
                "offer_identity": "vast:machine",
                "commitment_type": "on_demand",
            },
            {
                "canonical_offer_id": 3,
                "collected_at": datetime.combine(day, time(20, 0)),
                "collected_day": day,
                "provider": "vast",
                "offer_identity": "vast:machine",
                "commitment_type": "spot",
            },
        ]
    )

    deduplicated = _deduplicate_last_daily(frame)

    assert deduplicated["canonical_offer_id"].tolist() == [2, 3]


def test_ml_package_source_is_read_only() -> None:
    """ADR-0006 guard: no transaction or mutation token enters basis/ml."""
    package_dir = Path(features.__file__).resolve().parent
    forbidden = re.compile(
        r"\.(?:commit|flush)\s*\(|\b(?:INSERT|UPDATE|DELETE)\b",
    )
    offenders: list[str] = []

    for source_path in sorted(package_dir.glob("*.py")):
        for line_number, line in enumerate(source_path.read_text().splitlines(), start=1):
            if forbidden.search(line):
                offenders.append(f"{source_path.name}:{line_number}: {line.strip()}")

    assert not offenders


@pytest.mark.asyncio
async def test_extracted_feature_matrix_contract(db_session: AsyncSession) -> None:
    frame = await extract_features(db_session)
    if frame.empty:
        pytest.skip("No approved-provider H100-SXM rows in database")

    active_features = tuple(frame.attrs["feature_columns"])
    assert frame.attrs["rows_before_dedup"] >= len(frame)
    assert frame.attrs["rows_after_dedup"] == len(frame)
    assert set(frame["provider"]) <= set(TRAINED_PROVIDERS)
    assert TARGET_COLUMN in frame
    assert TARGET_COLUMN not in active_features
    assert set(METADATA_COLUMNS) <= set(frame.columns)
    assert set(active_features) <= set(frame.columns)
    assert set(frame.columns) == {*METADATA_COLUMNS, *active_features, TARGET_COLUMN}
    assert np.isfinite(frame[TARGET_COLUMN].to_numpy(dtype=float)).all()
    assert frame["provider_metadata_backfill"].map(type).eq(bool).all()

    for column in active_features:
        assert frame[column].nunique(dropna=True) != 1

    for column in HIGH_CARDINALITY_PAYLOAD_KEYS:
        if column in frame:
            assert frame[column].nunique(dropna=True) <= TOP_CATEGORY_COUNT + 1


@pytest.mark.asyncio
async def test_payload_feature_null_map(db_session: AsyncSession) -> None:
    frame = await extract_features(db_session)
    if frame.empty:
        pytest.skip("No approved-provider H100-SXM rows in database")

    payload_columns = list(frame.attrs["payload_feature_columns"])
    assert payload_columns

    non_vast = frame.loc[frame["provider"] != "vast", payload_columns]
    assert non_vast.isna().all().all()

    vast = frame.loc[frame["provider"] == "vast"]
    assert not vast.empty
    full_fill_columns = sorted(set(payload_columns) & VAST_EXPECTED_FULL_PAYLOAD_KEYS)
    assert full_fill_columns
    fill_rates = vast[full_fill_columns].notna().mean()
    assert (fill_rates >= 0.95).all(), fill_rates[fill_rates < 0.95].to_dict()


@pytest.mark.asyncio
async def test_join_and_dedup_integrity(db_session: AsyncSession) -> None:
    frame = await extract_features(db_session)
    if frame.empty:
        pytest.skip("No approved-provider H100-SXM rows in database")

    assert frame["canonical_offer_id"].is_unique
    assert not frame.duplicated(
        ["provider", "offer_identity", "commitment_type", "collected_day"]
    ).any()
    assert frame["machine_id"].notna().eq(frame["provider"] == "vast").all()
    assert (pd.to_datetime(frame["collected_at"], utc=True).dt.date == frame["collected_day"]).all()

    canonical_ids = [int(value) for value in frame["canonical_offer_id"]]
    canonical_rows = (
        await db_session.execute(
            select(CanonicalOffer.id, CanonicalOffer.price_usd_per_hour).where(
                CanonicalOffer.id.in_(canonical_ids)
            )
        )
    ).all()
    assert len(canonical_rows) == len(frame)

    prices_by_id = {canonical_id: price for canonical_id, price in canonical_rows}
    expected_target = frame["canonical_offer_id"].map(
        lambda canonical_id: math.log(prices_by_id[int(canonical_id)])
    )
    assert np.allclose(frame[TARGET_COLUMN], expected_target)


@pytest.mark.slow
@pytest.mark.asyncio
async def test_vast_payload_has_no_untriaged_keys(db_session: AsyncSession) -> None:
    payloads = (
        await db_session.execute(
            select(RawObservation.raw_payload)
            .join(
                CanonicalOffer,
                CanonicalOffer.raw_observation_id == RawObservation.id,
            )
            .where(
                CanonicalOffer.gpu_sku_canonical == features.DEFAULT_SKU,
                CanonicalOffer.provider == "vast",
            )
        )
    ).scalars()
    observed_keys: set[str] = set()
    for payload in payloads:
        observed_keys.update(payload)

    if not observed_keys:
        pytest.skip("No Vast H100-SXM payloads in database")
    assert not observed_keys.difference(TRIAGED_VAST_PAYLOAD_KEYS)
