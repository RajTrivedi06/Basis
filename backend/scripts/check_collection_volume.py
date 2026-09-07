"""Per-provider collection-volume anomaly check.

Guards against *silent* collection collapses — the failure mode that let the
Vast H100 outage (Vast fell ~6,400 -> ~220 offers/day) and the TensorDock
`0 locations` outage go unnoticed for weeks. The existing healthchecks.io
probes only confirm the collector *ran*, not that it returned a healthy volume.

For each expected provider it compares the latest collection run's row count to
that provider's rolling median run size, and flags a run that has collapsed
(dropped below a fraction of baseline) or gone to zero despite a real baseline.

Exit code: 0 if all healthy (or only known-steady-state gaps), 1 if any
provider shows a sudden drop. `collect_cron.sh` maps the exit code to a
healthchecks.io ping so a collapse pages within one collection cycle.

Read-only. Run after collection:
    uv run python scripts/check_collection_volume.py
"""

from __future__ import annotations

import asyncio
import logging
import sys
from pathlib import Path

# collect_cron.sh invokes this as `uv run python scripts/check_collection_volume.py`,
# which puts backend/scripts/ (not backend/) at sys.path[0] — `import basis` then
# fails. Bootstrap the backend dir onto the path so the script works regardless of
# how it is invoked. (This crash silently killed the volume alert in production
# from 2026-07-13 to 2026-07-26.)
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text

from basis.db.engine import async_session_factory

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("check_collection_volume")

# Providers we expect to be collecting. A provider absent from this set is
# ignored; one listed here but missing from recent data is surfaced.
# TensorDock is intentionally excluded: its public /locations feed drained to
# empty and inventory moved behind an API key (parked 2026-07-13, ~0.8% of
# offers — see docs/02-reference/data-sources.md). Re-add it here if restored.
EXPECTED_PROVIDERS: tuple[str, ...] = ("vast", "runpod", "aws_spot", "azure", "gcp")

# Absolute per-run floors that no rolling baseline can lower. A censored Vast
# run of 512 rows sat inside the adaptive baseline for weeks in Aug-Sep 2026
# because the baseline had already adapted to it. These are deliberately
# below any healthy run and must be revisited after the API is re-characterised.
ABSOLUTE_FLOOR: dict[str, int] = {
    "vast": 1500,
    "runpod": 20,
    "aws_spot": 15,
    "azure": 100,
    "gcp": 150,
}

# The headline SKU. Provider-level counts missed its disappearance entirely.
HEADLINE_SKU = "h100_sxm_80gb"
HEADLINE_FLOOR: dict[str, int] = {"vast": 20}

LOOKBACK_DAYS = 21          # window for the rolling baseline
MIN_FRACTION = 0.30         # latest < 30% of baseline median => collapse
MIN_BASELINE_RUNS = 4       # need this many prior runs to trust a baseline
LATEST_WINDOW_HOURS = 36    # a "recent" run must fall within this window

# Per (source, run) counts over the window, plus the latest run per source and a
# baseline median over the *earlier* runs (excludes the latest so a bad latest
# run can't move its own baseline).
#
# Backfill rows (provider_metadata.backfill truthy) carry historical collected_at
# stamps and must not count as collection runs — otherwise a one-shot AWS history
# backfill looks like hundreds of tiny runs and drags the baseline median down.
_BACKFILL_EXCLUSION = """
    AND NOT (
        COALESCE(lower(provider_metadata->>'backfill'), '') IN ('true', 't', '1', 'yes')
        OR COALESCE(provider_metadata->'backfill', 'false'::jsonb) = 'true'::jsonb
    )
"""

_QUERY = text(
    f"""
    WITH runs AS (
        SELECT source, collected_at, count(*) AS cnt
        FROM raw_observations
        WHERE collected_at > now() - make_interval(days => :days)
        {_BACKFILL_EXCLUSION}
        GROUP BY source, collected_at
    ),
    latest AS (
        SELECT DISTINCT ON (source) source, collected_at AS last_run, cnt AS latest_cnt
        FROM runs
        ORDER BY source, collected_at DESC
    )
    SELECT
        l.source,
        l.latest_cnt,
        l.last_run,
        (l.last_run > now() - make_interval(hours => :recent_hours)) AS is_recent,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY r.cnt)
            FILTER (WHERE r.collected_at < l.last_run) AS baseline_median,
        count(*) FILTER (WHERE r.collected_at < l.last_run) AS baseline_runs
    FROM runs r
    JOIN latest l ON r.source = l.source
    GROUP BY l.source, l.latest_cnt, l.last_run
    ORDER BY l.source
    """
)


def classify(
    latest_cnt: int | None,
    baseline_median: float | None,
    baseline_runs: int,
    *,
    min_fraction: float = MIN_FRACTION,
    min_baseline_runs: int = MIN_BASELINE_RUNS,
    absolute_floor: int | None = None,
) -> tuple[str, bool]:
    """Return (status, is_alert) for one provider's latest run.

    Pure function so the decision logic is unit-testable without a database.
    - "below_floor": latest run under the provider's absolute floor (alert),
      regardless of baseline.
    - "no_baseline": too little history to judge (info, not an alert).
    - "zero":  latest run empty against a real baseline (alert).
    - "low":   latest run below min_fraction of baseline (alert).
    - "ok":    latest run within expected range.
    """
    latest = latest_cnt or 0
    # The floor is checked first so "no_baseline" can never mask a collapse.
    if absolute_floor is not None and latest < absolute_floor:
        return "below_floor", True
    if baseline_median is None or baseline_runs < min_baseline_runs or baseline_median <= 0:
        return "no_baseline", False
    if latest == 0:
        return "zero", True
    if latest < min_fraction * baseline_median:
        return "low", True
    return "ok", False


_HEADLINE_QUERY = text(
    f"""
    SELECT c.provider, count(*) AS cnt
    FROM canonical_offers c
    JOIN raw_observations r ON r.id = c.raw_observation_id
    WHERE c.gpu_sku_canonical = :sku
      AND c.collected_at > now() - make_interval(hours => :recent_hours)
      {_BACKFILL_EXCLUSION.replace("provider_metadata", "r.provider_metadata")}
    GROUP BY c.provider
    """
)

_HEALTH_QUERY = text(
    """
    SELECT DISTINCT ON (source, commitment_type)
        source, commitment_type, collected_at, exhaustive,
        bands_incomplete, desc_check_missing, probe_missing
    FROM collection_health
    ORDER BY source, commitment_type, collected_at DESC
    """
)


async def fetch_headline_rows(session) -> dict[str, int]:
    result = await session.execute(
        _HEADLINE_QUERY, {"sku": HEADLINE_SKU, "recent_hours": LATEST_WINDOW_HOURS}
    )
    return {m["provider"]: int(m["cnt"]) for m in result.mappings().all()}


async def fetch_health_rows(session) -> list[dict]:
    """Latest completeness verdict per (source, commitment).

    Tolerates a database that predates the ``collection_health`` table: the
    volume checks must keep running even if this migration has not landed —
    a crashing alert is a silent alert (see the 2026-07-13 incident above).
    """
    try:
        result = await session.execute(_HEALTH_QUERY)
    except Exception as exc:  # any DB error must not kill the alert
        await session.rollback()
        logger.error("collection_health unavailable (%s); completeness state not checked", exc)
        return []
    return [dict(m) for m in result.mappings().all()]


async def fetch_volume_rows(session) -> list[dict]:
    """Run the volume baseline query. Exposed for integration tests."""
    result = await session.execute(
        _QUERY, {"days": LOOKBACK_DAYS, "recent_hours": LATEST_WINDOW_HOURS}
    )
    return [dict(m) for m in result.mappings().all()]


async def _fetch_rows() -> tuple[list[dict], dict[str, int], list[dict]]:
    async with async_session_factory() as session:
        volume = await fetch_volume_rows(session)
        headline = await fetch_headline_rows(session)
        health = await fetch_health_rows(session)
        return volume, headline, health


def main() -> int:
    rows, headline, health = asyncio.run(_fetch_rows())
    by_source = {r["source"]: r for r in rows}

    alerts: list[str] = []
    logger.info("Collection-volume check (%d-day baseline):", LOOKBACK_DAYS)

    for source in EXPECTED_PROVIDERS:
        row = by_source.get(source)
        if row is None:
            # No runs at all in the window: a known steady-state gap (e.g. a
            # provider dead for weeks). Surface it, but don't page on old news.
            logger.warning("  %-11s no runs in the last %d days", source, LOOKBACK_DAYS)
            continue

        latest_cnt = row["latest_cnt"] or 0
        baseline = row["baseline_median"]
        baseline_runs = row["baseline_runs"] or 0
        status, is_alert = classify(
            latest_cnt, baseline, baseline_runs, absolute_floor=ABSOLUTE_FLOOR.get(source)
        )

        base_str = f"{baseline:.0f}" if baseline is not None else "n/a"
        recent = "" if row["is_recent"] else "  (stale: no recent run!)"
        line = (
            f"  {source:<11} latest={latest_cnt:<6} baseline_median={base_str:<6} "
            f"runs={baseline_runs:<3} status={status}{recent}"
        )

        # A provider whose latest run is old is itself suspicious.
        stale = not row["is_recent"]
        if is_alert or stale:
            logger.error(line.rstrip())
            alerts.append(f"{source}: {status}{' + stale' if stale else ''}")
        else:
            logger.info(line.rstrip())

    # Headline SKU: provider-level totals hid the loss of every H100 SXM row.
    for source, floor in HEADLINE_FLOOR.items():
        cnt = headline.get(source, 0)
        if cnt < floor:
            logger.error("  %-11s %s rows in last %dh: %d < floor %d", source, HEADLINE_SKU,
                         LATEST_WINDOW_HOURS, cnt, floor)
            alerts.append(f"{source}: {HEADLINE_SKU} {cnt} < {floor}")
        else:
            logger.info("  %-11s %s rows in last %dh: %d", source, HEADLINE_SKU,
                        LATEST_WINDOW_HOURS, cnt)

    # Persistent completeness state: the latest verdict per (source, commitment)
    # stays alerting until a later exhaustive run replaces it. Not adaptive.
    for h in health:
        label = f"{h['source']}/{h['commitment_type']}"
        problems = []
        if not h["exhaustive"]:
            problems.append(f"{h['bands_incomplete']} incomplete band(s)")
        if (h["desc_check_missing"] or 0) > 0:
            problems.append(f"desc check missed {h['desc_check_missing']}")
        for name, n in (h.get("probe_missing") or {}).items():
            if n:
                problems.append(f"probe {name!r} missed {n}")
        if problems:
            logger.error("  %-20s NOT COMPLETE since %s: %s", label, h["collected_at"], "; ".join(problems))
            alerts.append(f"{label}: incomplete ({'; '.join(problems)})")
        else:
            logger.info("  %-20s complete as of %s", label, h["collected_at"])

    if alerts:
        logger.error("VOLUME ANOMALY: %s", "; ".join(alerts))
        return 1
    logger.info("All providers within expected volume.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
