"""Read-only ML feature extraction governed by the approved design §§1-3.

Canonical offers are joined to immutable raw observations only through
``canonical_offers.raw_observation_id`` as required by ADR-0006. The feature
inventory and all payload triage constants below mirror
``docs/analysis/ml-explainability-design.md`` §3; changing them requires a
design-doc amendment.
"""

from __future__ import annotations

import hashlib
import json
import logging
import math
import re
from collections import Counter
from collections.abc import Mapping, Sequence
from datetime import UTC, date, datetime
from typing import Any, Final, cast

import pandas as pd  # type: ignore[import-untyped]
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from basis.db.models import CanonicalOffer, RawObservation

logger = logging.getLogger(__name__)

DEFAULT_SKU: Final = "h100_sxm_80gb"
TRAINED_PROVIDERS: Final = ("vast", "runpod", "aws_spot", "tensordock")
ERA_LABELS: Final = ("era_0_backfill", "A", "B", "C", "D")

# Approved design §3.2: these three lists are the complete Vast payload audit.
# Both inclusion and exclusion are explicit so an unseen key cannot silently
# become a model feature.
VAST_EXCLUDED_PRICE_KEYS: Final = (
    "dph_base",
    "dph_total",
    "dph_total_adj",
    "discounted_dph_total",
    "discounted_hourly",
    "discount_rate",
    "credit_discount_max",
    "avail_vol_dph",
    "dlperf_per_dphtotal",
    "flops_per_dphtotal",
    "min_bid",
    "vram_costperhour",
    "inet_up_cost",
    "inet_down_cost",
    "internet_up_cost_per_tb",
    "internet_down_cost_per_tb",
    "storage_cost",
    "storage_total_cost",
    "score",
    "sla_broker_rate",
    "is_bid",
    "time_remaining_isbid",
)

VAST_EXCLUDED_IDENTITY_KEYS: Final = (
    "id",
    "ask_contract_id",
    "avail_vol_ask_id",
    "bundle_id",
    "cluster_id",
    "gpu_ids",
    "host_id",
    "machine_id",
    "hostname",
    "public_ipaddr",
    "logo",
    "webpage",
    "rn",
    "search",
    "bundled_results",
    "instance",
    "avail_vol_size",
    "rentable",
    "resource_type",
    "vericode",
    "verification",
    "geolocation",
    "geolocode",
    "driver_vers",
    "start_date",
    "end_date",
    "gpu_name",
)

VAST_INCLUDED_PAYLOAD_KEYS: Final = (
    # GPU hardware
    "gpu_arch",
    "gpu_ram",
    "gpu_total_ram",
    "gpu_frac",
    "num_gpus",
    "gpu_lanes",
    "gpu_mem_bw",
    "gpu_max_power",
    "gpu_max_temp",
    "gpu_display_active",
    "bw_nvlink",
    "compute_cap",
    "cuda_max_good",
    "total_flops",
    "dlperf",
    # CPU / board
    "cpu_arch",
    "cpu_name",
    "cpu_cores",
    "cpu_cores_effective",
    "cpu_ghz",
    "cpu_ram",
    "has_avx",
    "mobo_name",
    "pci_gen",
    "pcie_bw",
    # Disk
    "disk_name",
    "disk_bw",
    "disk_space",
    "nw_disk_avg_bw",
    "nw_disk_max_bw",
    "nw_disk_min_bw",
    # Network
    "inet_up",
    "inet_down",
    "direct_port_count",
    "static_ip",
    "external",
    # Reliability / SLA
    "reliability",
    "reliability2",
    "reliability_mult",
    "expected_reliability",
    "target_reliability",
    "sla_r_claim",
    "sla_sigma_x",
    # Host / platform state
    "hosting_type",
    "vms_enabled",
    "is_vm_deverified",
    "rented",
    "duration",
    "time_remaining",
    "driver_version",
    "os_version",
)

TRIAGED_VAST_PAYLOAD_KEYS: Final = frozenset(
    (*VAST_EXCLUDED_PRICE_KEYS, *VAST_EXCLUDED_IDENTITY_KEYS, *VAST_INCLUDED_PAYLOAD_KEYS)
)

BANNED_FEATURE_SUBSTRINGS: Final = (
    "dph",
    "price",
    "cost",
    "bid",
    "credit",
    "discount",
    "hourly",
    "perhour",
    "score",
    "broker_rate",
)

HIGH_CARDINALITY_PAYLOAD_KEYS: Final = (
    "cpu_name",
    "mobo_name",
    "disk_name",
    "os_version",
)
TOP_CATEGORY_COUNT: Final = 20

# Design §3.2 explicitly notes these three keys as sparse.
VAST_DOCUMENTED_SPARSE_PAYLOAD_KEYS: Final = frozenset(
    {"target_reliability", "sla_r_claim", "sla_sigma_x"}
)
# Stage 3.2's full-corpus audit found an approved-doc/data discrepancy:
# presence ≠ non-null. These keys are present in every payload object, but
# external/nw_disk_* are present-but-null corpus-wide and mobo_name is 68.2%
# non-null pre-dedup. They remain approved features; this set only prevents the
# ≥95% non-null drift guard from making a false claim.
VAST_CORPUS_NULLABLE_PAYLOAD_KEYS: Final = frozenset(
    {
        "external",
        "mobo_name",
        "nw_disk_avg_bw",
        "nw_disk_max_bw",
        "nw_disk_min_bw",
    }
)
VAST_EXPECTED_FULL_PAYLOAD_KEYS: Final = frozenset(VAST_INCLUDED_PAYLOAD_KEYS).difference(
    VAST_DOCUMENTED_SPARSE_PAYLOAD_KEYS,
    VAST_CORPUS_NULLABLE_PAYLOAD_KEYS,
)

CANONICAL_FEATURE_COLUMNS: Final = (
    "provider",
    "commitment_type",
    "region_country",
    "vcpus_bundled",
    "ram_gb_bundled",
    "storage_gb_bundled",
    "networking_type",
    "verification_tier",
    "era",
)
FEATURE_COLUMNS: Final = (*CANONICAL_FEATURE_COLUMNS, *VAST_INCLUDED_PAYLOAD_KEYS)

METADATA_COLUMNS: Final = (
    "canonical_offer_id",
    "collected_at",
    "collected_day",
    "provider_metadata_backfill",
    "machine_id",
    "offer_identity",
)
TARGET_COLUMN: Final = "y_log_price"

_ERA_A_START: Final = date(2026, 4, 26)
_ERA_B_START: Final = date(2026, 6, 16)
_ERA_C_START: Final = date(2026, 7, 12)
_ERA_D_START: Final = date(2026, 7, 26)
_DRIVER_PART_PATTERN: Final = re.compile(r"\d+")


def derive_era(value: date | datetime) -> str:
    """Return the total approved era label for a UTC calendar date.

    Any pre-cutover date maps to ``era_0_backfill``. The function therefore
    remains total if a future AWS backfill reaches before 2026-04-26.
    """
    if isinstance(value, datetime):
        if value.tzinfo is not None:
            value = value.astimezone(UTC)
        observed_day = value.date()
    else:
        observed_day = value

    if observed_day < _ERA_A_START:
        return "era_0_backfill"
    if observed_day < _ERA_B_START:
        return "A"
    if observed_day < _ERA_C_START:
        return "B"
    if observed_day < _ERA_D_START:
        return "C"
    return "D"


async def extract_features(
    session: AsyncSession,
    sku: str = DEFAULT_SKU,
    providers: Sequence[str] = TRAINED_PROVIDERS,
    *,
    eras: Sequence[str] | None = None,
) -> pd.DataFrame:
    """Extract, deduplicate, and validate the approved feature sample.

    The returned frame contains non-feature audit metadata, the active subset
    of ``FEATURE_COLUMNS``, and ``y_log_price``. Candidate features with exactly
    one distinct non-null value are removed. Extraction statistics and the
    final feature list are stored in ``frame.attrs``.
    """
    provider_allowlist = tuple(dict.fromkeys(providers))
    era_allowlist = _validate_eras(eras)
    if not provider_allowlist:
        return _empty_frame()

    statement = (
        select(
            CanonicalOffer.id.label("canonical_offer_id"),
            CanonicalOffer.collected_at,
            CanonicalOffer.provider,
            CanonicalOffer.commitment_type,
            CanonicalOffer.region_country,
            CanonicalOffer.vcpus_bundled,
            CanonicalOffer.ram_gb_bundled,
            CanonicalOffer.storage_gb_bundled,
            CanonicalOffer.networking_type,
            CanonicalOffer.verification_tier,
            CanonicalOffer.price_usd_per_hour,
            RawObservation.raw_payload,
            RawObservation.provider_metadata,
            RawObservation.region_reported,
        )
        .join(
            RawObservation,
            CanonicalOffer.raw_observation_id == RawObservation.id,
        )
        .where(
            CanonicalOffer.gpu_sku_canonical == sku,
            CanonicalOffer.provider.in_(provider_allowlist),
        )
        .order_by(CanonicalOffer.collected_at, CanonicalOffer.id)
    )
    rows = (await session.execute(statement)).mappings().all()
    records = [_feature_record(cast(Mapping[str, Any], row)) for row in rows]
    if era_allowlist is not None:
        records = [record for record in records if record["era"] in era_allowlist]

    rows_before_dedup = len(records)
    if not records:
        frame = _empty_frame()
        frame.attrs["rows_before_dedup"] = rows_before_dedup
        return frame

    frame = _deduplicate_last_daily(pd.DataFrame.from_records(records))
    frame["machine_id"] = frame["machine_id"].convert_dtypes()

    _parse_driver_versions(frame)
    _collapse_high_cardinality_levels(frame)
    frame, dropped_columns = _drop_constant_features(frame)

    active_features = tuple(column for column in FEATURE_COLUMNS if column in frame.columns)
    output_columns = [*METADATA_COLUMNS, *active_features, TARGET_COLUMN]
    frame = frame.loc[:, output_columns]
    frame.attrs.update(
        {
            "rows_before_dedup": rows_before_dedup,
            "rows_after_dedup": len(frame),
            "feature_columns": active_features,
            "payload_feature_columns": tuple(
                column for column in VAST_INCLUDED_PAYLOAD_KEYS if column in frame.columns
            ),
            "dropped_constant_columns": dropped_columns,
        }
    )
    return frame


def _feature_record(row: Mapping[str, Any]) -> dict[str, Any]:
    payload = _mapping_or_empty(row["raw_payload"])
    provider_metadata = _mapping_or_empty(row["provider_metadata"])
    collected_at = _utc_datetime(row["collected_at"])
    collected_day = collected_at.date()
    provider = str(row["provider"])

    price = float(row["price_usd_per_hour"])
    if not math.isfinite(price) or price <= 0:
        raise ValueError(
            f"canonical offer {row['canonical_offer_id']} has invalid hourly price {price!r}"
        )

    record: dict[str, Any] = {
        "canonical_offer_id": int(row["canonical_offer_id"]),
        "collected_at": collected_at,
        "collected_day": collected_day,
        "provider_metadata_backfill": bool(provider_metadata.get("backfill", False)),
        "machine_id": payload.get("machine_id") if provider == "vast" else None,
        "provider": provider,
        "commitment_type": row["commitment_type"],
        "region_country": row["region_country"],
        "vcpus_bundled": row["vcpus_bundled"],
        "ram_gb_bundled": row["ram_gb_bundled"],
        "storage_gb_bundled": row["storage_gb_bundled"],
        "networking_type": row["networking_type"],
        "verification_tier": row["verification_tier"],
        "era": derive_era(collected_day),
        TARGET_COLUMN: math.log(price),
    }
    for key in VAST_INCLUDED_PAYLOAD_KEYS:
        record[key] = payload.get(key) if provider == "vast" else None

    record["offer_identity"] = _offer_identity(
        provider=provider,
        payload=payload,
        provider_metadata=provider_metadata,
        raw_region=row["region_reported"],
        included_features=record,
    )
    return record


def _offer_identity(
    *,
    provider: str,
    payload: Mapping[str, Any],
    provider_metadata: Mapping[str, Any],
    raw_region: object,
    included_features: Mapping[str, Any],
) -> str:
    # Design §2, Vast: machine_id + num_gpus + gpu_frac distinguishes slices.
    if provider == "vast":
        parts = (payload.get("machine_id"), payload.get("num_gpus"), payload.get("gpu_frac"))
        if _identity_complete(parts):
            return _encoded_identity(provider, parts)

    # Design §2, AWS: region + availability zone + instance type.
    if provider == "aws_spot":
        availability_zone = provider_metadata.get("availability_zone") or payload.get(
            "AvailabilityZone"
        )
        region = provider_metadata.get("region")
        if region is None and isinstance(availability_zone, str) and availability_zone:
            region = availability_zone[:-1]
        parts = (
            region,
            availability_zone,
            provider_metadata.get("instance_type") or payload.get("InstanceType"),
        )
        if _identity_complete(parts):
            return _encoded_identity(provider, parts)

    # Design §2, catalog providers: stored SKU/instance type + provider region.
    # RunPod does not expose a region, so its explicit missing region is part of
    # the stable catalog identity rather than a reason to invent one.
    if provider in {"runpod", "azure", "gcp"}:
        if provider == "runpod":
            catalog_sku = provider_metadata.get("runpod_id") or payload.get("id")
        elif provider == "azure":
            catalog_sku = provider_metadata.get("instance_type") or payload.get("armSkuName")
        else:
            catalog_sku = provider_metadata.get("skuId") or payload.get("skuId")
        if catalog_sku not in (None, ""):
            return _encoded_identity(provider, (catalog_sku, raw_region))

    # Design §2 fallback, including TensorDock: hash only approved feature
    # values. Target price, identifiers, and excluded payload keys never enter.
    feature_vector = {
        column: _json_scalar(included_features.get(column)) for column in FEATURE_COLUMNS
    }
    serialized = json.dumps(
        feature_vector,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    )
    digest = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
    return f"{provider}:fallback:{digest}"


def _encoded_identity(provider: str, parts: Sequence[object]) -> str:
    serialized = json.dumps(
        [_json_scalar(part) for part in parts],
        separators=(",", ":"),
        allow_nan=False,
    )
    return f"{provider}:{serialized}"


def _identity_complete(parts: Sequence[object]) -> bool:
    return all(part not in (None, "") for part in parts)


def _parse_driver_versions(frame: pd.DataFrame) -> None:
    if "driver_version" not in frame:
        return
    frame["driver_version"] = frame["driver_version"].map(_parse_driver_version)


def _parse_driver_version(value: object) -> float:
    """Encode dotted driver versions numerically while preserving ordering."""
    if value is None or value is pd.NA:
        return math.nan
    if isinstance(value, float) and math.isnan(value):
        return math.nan

    parts = [int(part) for part in _DRIVER_PART_PATTERN.findall(str(value))]
    if not parts:
        return math.nan
    major, minor, patch = (*parts[:3], 0, 0)[:3]
    return float(major * 1_000_000 + minor * 1_000 + patch)


def _collapse_high_cardinality_levels(frame: pd.DataFrame) -> None:
    for column in HIGH_CARDINALITY_PAYLOAD_KEYS:
        if column not in frame:
            continue
        series = frame[column]
        populated = series.notna()
        if not populated.any():
            continue
        as_strings = series.loc[populated].astype(str)
        counts = Counter(as_strings)
        top_levels = {
            level
            for level, _count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))[
                :TOP_CATEGORY_COUNT
            ]
        }
        frame.loc[populated, column] = as_strings.where(as_strings.isin(top_levels), "other")


def _deduplicate_last_daily(frame: pd.DataFrame) -> pd.DataFrame:
    """Keep the last collection row for every approved daily offer unit."""
    ordered = frame.sort_values(
        ["collected_at", "canonical_offer_id"],
        kind="stable",
    )
    return ordered.drop_duplicates(
        subset=["provider", "offer_identity", "commitment_type", "collected_day"],
        keep="last",
    ).reset_index(drop=True)


def _drop_constant_features(frame: pd.DataFrame) -> tuple[pd.DataFrame, tuple[str, ...]]:
    dropped: list[str] = []
    for column in FEATURE_COLUMNS:
        if column in frame and frame[column].nunique(dropna=True) <= 1:
            logger.info("Dropping constant ML feature column: %s", column)
            dropped.append(column)
    if dropped:
        frame = frame.drop(columns=dropped)
    return frame, tuple(dropped)


def _validate_eras(eras: Sequence[str] | None) -> frozenset[str] | None:
    if eras is None:
        return None
    requested = frozenset(eras)
    unknown = requested.difference(ERA_LABELS)
    if unknown:
        raise ValueError(f"unknown era labels: {', '.join(sorted(unknown))}")
    return requested


def _utc_datetime(value: object) -> datetime:
    if not isinstance(value, datetime):
        raise TypeError(f"collected_at must be datetime, got {type(value).__name__}")
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _mapping_or_empty(value: object) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _json_scalar(value: object) -> str | int | float | bool | None:
    if value is None or value is pd.NA:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def _empty_frame() -> pd.DataFrame:
    frame = pd.DataFrame(columns=[*METADATA_COLUMNS, *FEATURE_COLUMNS, TARGET_COLUMN])
    frame.attrs.update(
        {
            "rows_before_dedup": 0,
            "rows_after_dedup": 0,
            "feature_columns": FEATURE_COLUMNS,
            "payload_feature_columns": VAST_INCLUDED_PAYLOAD_KEYS,
            "dropped_constant_columns": (),
        }
    )
    return frame


assert len(VAST_EXCLUDED_PRICE_KEYS) == 22
assert len(VAST_EXCLUDED_IDENTITY_KEYS) == 27
assert len(VAST_INCLUDED_PAYLOAD_KEYS) == 51
assert len(TRIAGED_VAST_PAYLOAD_KEYS) == 100
