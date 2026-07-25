"""Tests for the normalization layer.

Normalization correctness is critical -- bugs here invalidate the entire study.
Test every mapping rule explicitly.
"""

import ast
import os
import random
from pathlib import Path

import pytest
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from basis.config import settings
from basis.db.models import CanonicalOffer, RawObservation
from basis.normalization.bundle import explain_extract_bundle
from basis.normalization.canonicalize import canonicalize_gpu, explain_canonicalize_gpu
from basis.normalization.commitment import explain_canonicalize_commitment
from basis.normalization.pipeline import run_normalization
from basis.normalization.region import (
    explain_normalize_region,
    normalize_region,
)


def test_pipeline_never_references_explain_identifiers() -> None:
    """ADR 0004 write-path safety invariant.

    The canonicalization pipeline must not reference any `explain_*`
    identifier. Attribution is read-path only; `pipeline.normalize_observation`
    is the write path. This test parses `pipeline.py` and fails if any
    `Name`, `Attribute`, or `ImportFrom` node references an identifier
    starting with `explain_`.
    """
    pipeline_path = (
        Path(__file__).resolve().parents[1]
        / "basis"
        / "normalization"
        / "pipeline.py"
    )
    assert pipeline_path.exists(), f"pipeline.py not found at {pipeline_path}"

    tree = ast.parse(pipeline_path.read_text())
    violations: list[str] = []

    for node in ast.walk(tree):
        if isinstance(node, ast.Name) and node.id.startswith("explain_"):
            violations.append(f"Name '{node.id}' at line {node.lineno}")
        elif isinstance(node, ast.Attribute) and node.attr.startswith("explain_"):
            violations.append(f"Attribute '.{node.attr}' at line {node.lineno}")
        elif isinstance(node, ast.ImportFrom):
            for alias in node.names:
                if alias.name.startswith("explain_"):
                    violations.append(
                        f"ImportFrom '{alias.name}' at line {node.lineno}"
                    )

    assert not violations, (
        "pipeline.py references explain_* identifiers, violating the ADR 0004 "
        f"write-path safety invariant: {violations}"
    )


# Seed for reproducible sampling in the fidelity test.
_FIDELITY_SEED = 20260421
_FIDELITY_SAMPLE_SIZE = 50


@pytest.mark.asyncio
async def test_canonicalization_fidelity_via_explain(db_session: AsyncSession) -> None:
    """ADR 0004 fidelity invariant, self-enforcing.

    Samples `_FIDELITY_SAMPLE_SIZE` canonical offers with a fixed seed, joins
    each to its source raw observation, runs the four `explain_*` functions
    against the raw inputs, and asserts that each explain-derived value
    matches the canonical value the write path stored.

    Manually verified on 2026-04-21 for a single pair (canonical_offers[4400]
    vs explain(raw_observations[8400])); this test makes that check
    automatic across a sample large enough to detect systematic drift while
    still running in under a second.

    Skips if no canonical offers exist (e.g., a fresh DB).
    """
    # Inner join — we need both sides to explain.
    stmt = select(CanonicalOffer, RawObservation).join(
        RawObservation, CanonicalOffer.raw_observation_id == RawObservation.id
    )
    rows = (await db_session.execute(stmt)).all()

    if not rows:
        pytest.skip("No canonical offers in DB; nothing to verify.")

    rng = random.Random(_FIDELITY_SEED)
    sample = rng.sample(rows, min(_FIDELITY_SAMPLE_SIZE, len(rows)))

    mismatches: list[str] = []
    for canonical, raw in sample:
        diffs = _diff_canonical_against_explain(canonical, raw)
        if diffs:
            mismatches.append(
                f"raw_observation_id={raw.id} canonical_offer_id={canonical.id}: "
                + ", ".join(diffs)
            )

    assert not mismatches, (
        f"explain_* functions diverged from the write path on {len(mismatches)} of "
        f"{len(sample)} sampled offers. First mismatches:\n  "
        + "\n  ".join(mismatches[:5])
    )


def test_tensordock_country_name_maps_to_iso2() -> None:
    """TensorDock sends full country names; normalize_region must yield ISO-2.

    Covers the 2026-04-21 fix for the region_country inconsistency between
    TensorDock (full names) and AWS/Vast (ISO-2). Five countries observed
    in live data — all must map.
    """
    cases = [
        ("Austin, Texas, United States", "US"),
        ("Montreal, Quebec, Canada", "CA"),
        ("Frankfurt, Hesse, Germany", "DE"),
        ("Prague, Czech Republic", "CZ"),
        ("Tallinn, Estonia", "EE"),
    ]
    for region_str, expected_iso2 in cases:
        result = normalize_region("tensordock", region_str)
        assert result.country == expected_iso2, (
            f"tensordock {region_str!r}: expected country={expected_iso2!r}, "
            f"got {result.country!r}"
        )


def test_tensordock_unknown_country_name_preserved() -> None:
    """Unknown country names fall through unchanged (conservative, per ADR 0002).

    Guards against adding accidental fuzzy matching. A name not in the
    lookup should round-trip as-is, not be guessed at.
    """
    result = normalize_region("tensordock", "Some City, Country That Does Not Exist")
    assert result.country == "Country That Does Not Exist"


def test_vast_iso2_passthrough_still_works() -> None:
    """Regression: Vast's ISO-2 input path must still produce ISO-2 output.

    The country-name lookup was added for TensorDock but shares the same
    helper — ensures it didn't break the Vast ISO-2 path.
    """
    assert normalize_region("vast", "Virginia, US").country == "US"
    assert normalize_region("vast", "Tokyo, JP").country == "JP"


def _diff_canonical_against_explain(
    canonical: CanonicalOffer, raw: RawObservation
) -> list[str]:
    """Return a list of field-level diffs between the stored canonical offer
    and the values that `explain_*` would produce from the raw row."""
    diffs: list[str] = []

    gpu = explain_canonicalize_gpu(raw.gpu_model_reported)
    if gpu.canonical_sku != canonical.gpu_sku_canonical:
        diffs.append(
            f"gpu_sku_canonical stored={canonical.gpu_sku_canonical!r} "
            f"explain={gpu.canonical_sku!r}"
        )
    if gpu.gpu_variant != canonical.gpu_variant:
        diffs.append(
            f"gpu_variant stored={canonical.gpu_variant!r} explain={gpu.gpu_variant!r}"
        )
    if gpu.vram_gb != canonical.vram_gb:
        diffs.append(f"vram_gb stored={canonical.vram_gb} explain={gpu.vram_gb}")

    commit = explain_canonicalize_commitment(raw.commitment_type_reported)
    if commit.canonical_type != canonical.commitment_type:
        diffs.append(
            f"commitment_type stored={canonical.commitment_type!r} "
            f"explain={commit.canonical_type!r}"
        )

    region = explain_normalize_region(raw.source, raw.region_reported)
    if region.country != canonical.region_country:
        diffs.append(
            f"region_country stored={canonical.region_country!r} "
            f"explain={region.country!r}"
        )
    if region.state != canonical.region_state:
        diffs.append(
            f"region_state stored={canonical.region_state!r} "
            f"explain={region.state!r}"
        )
    if region.city != canonical.region_city:
        diffs.append(
            f"region_city stored={canonical.region_city!r} explain={region.city!r}"
        )

    bundle = explain_extract_bundle(raw.source, raw.provider_metadata)
    if bundle.vcpus != canonical.vcpus_bundled:
        diffs.append(
            f"vcpus_bundled stored={canonical.vcpus_bundled} explain={bundle.vcpus}"
        )
    if bundle.ram_gb != canonical.ram_gb_bundled:
        diffs.append(
            f"ram_gb_bundled stored={canonical.ram_gb_bundled} "
            f"explain={bundle.ram_gb}"
        )
    if bundle.storage_gb != canonical.storage_gb_bundled:
        diffs.append(
            f"storage_gb_bundled stored={canonical.storage_gb_bundled} "
            f"explain={bundle.storage_gb}"
        )
    if bundle.verification_tier != canonical.verification_tier:
        diffs.append(
            f"verification_tier stored={canonical.verification_tier!r} "
            f"explain={bundle.verification_tier!r}"
        )

    return diffs


# Batch size small enough to force multiple iterations on the live corpus
# (~10k raw obs). Anything below the total eligible count will trigger the
# offset/filter interaction bug on pre-fix code.
_REGRESSION_BATCH_SIZE = 2000

# =============================================================================
# DANGER — DESTRUCTIVE TEST BELOW
#
# test_run_normalization_processes_all_rows_when_exceeding_batch_size DELETES
# every row in canonical_offers on whatever database settings.database_url
# points at, then rebuilds the table by re-running normalization. It is
# SKIPPED by default and only runs when BASIS_ALLOW_DESTRUCTIVE_TESTS=1 is
# set. Even then, it REFUSES to run when ENVIRONMENT=prod. Never point
# DATABASE_URL at a database you care about while opting in.
# =============================================================================
_DESTRUCTIVE_OPT_IN = os.environ.get("BASIS_ALLOW_DESTRUCTIVE_TESTS") == "1"


@pytest.mark.asyncio
@pytest.mark.skipif(
    not _DESTRUCTIVE_OPT_IN,
    reason=(
        "Destructive: deletes and rebuilds canonical_offers on the configured "
        "DB. Set BASIS_ALLOW_DESTRUCTIVE_TESTS=1 to opt in."
    ),
)
async def test_run_normalization_processes_all_rows_when_exceeding_batch_size(
    db_session: AsyncSession,
) -> None:
    """Regression for the offset/filter interaction bug in run_normalization.

    The pipeline used to advance `offset` by `batch_size` after each batch
    while simultaneously filtering out already-normalized rows. After batch 1,
    the offset skipped rows that hadn't been processed yet — on a corpus of
    ~10k rows with batch_size=1000, only the first batch of 1000 was actually
    written; the rest were silently dropped.

    This test drops the canonical table, re-runs normalization with a batch
    size smaller than the eligible corpus, and asserts the pipeline produced
    one canonical offer per eligible raw observation. The `finally` block
    restores the canonical table regardless of pass/fail — using a batch
    size larger than the corpus, which even the buggy code handles correctly
    (single-batch run, offset never matters).

    Destructive: commits to the live DB. Safe because the finally block
    restores state; any concurrent test that relies on canonical_offers
    would need to run after this one, which pytest's default ordering
    handles.
    """
    if settings.environment == "prod":
        pytest.fail(
            "REFUSING to run destructive normalization test: ENVIRONMENT=prod. "
            "This test deletes canonical_offers. Unset "
            "BASIS_ALLOW_DESTRUCTIVE_TESTS or run against a non-prod database."
        )

    raw_rows = (await db_session.execute(select(RawObservation))).scalars().all()
    eligible = sum(
        1 for r in raw_rows if canonicalize_gpu(r.gpu_model_reported) is not None
    )

    if eligible <= _REGRESSION_BATCH_SIZE:
        pytest.skip(
            f"Only {eligible} eligible raws; need > {_REGRESSION_BATCH_SIZE} "
            "to trigger the batching bug."
        )

    # Clean slate: no canonical offers.
    await db_session.execute(delete(CanonicalOffer))
    await db_session.commit()

    try:
        summary = await run_normalization(
            db_session, batch_size=_REGRESSION_BATCH_SIZE
        )
        assert summary["canonical_offers_created"] == eligible, (
            f"Pipeline with batch_size={_REGRESSION_BATCH_SIZE} created "
            f"{summary['canonical_offers_created']} canonical offers from "
            f"{eligible} eligible raws. The offset/filter bug is dropping rows."
        )
    finally:
        # Always restore, whether assertion passed or failed.
        current = (
            await db_session.execute(select(func.count(CanonicalOffer.id)))
        ).scalar_one()
        if current != eligible:
            await db_session.execute(delete(CanonicalOffer))
            await db_session.commit()
            # Batch size larger than corpus -> single-batch run, bug can't bite.
            await run_normalization(db_session, batch_size=eligible + 1000)
