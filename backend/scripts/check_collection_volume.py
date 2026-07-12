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
EXPECTED_PROVIDERS: tuple[str, ...] = ("vast", "runpod", "aws_spot", "tensordock")

LOOKBACK_DAYS = 21          # window for the rolling baseline
MIN_FRACTION = 0.30         # latest < 30% of baseline median => collapse
MIN_BASELINE_RUNS = 4       # need this many prior runs to trust a baseline
LATEST_WINDOW_HOURS = 36    # a "recent" run must fall within this window

# Per (source, run) counts over the window, plus the latest run per source and a
# baseline median over the *earlier* runs (excludes the latest so a bad latest
# run can't move its own baseline).
_QUERY = text(
    """
    WITH runs AS (
        SELECT source, collected_at, count(*) AS cnt
        FROM raw_observations
        WHERE collected_at > now() - make_interval(days => :days)
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
) -> tuple[str, bool]:
    """Return (status, is_alert) for one provider's latest run.

    Pure function so the decision logic is unit-testable without a database.
    - "no_baseline": too little history to judge (info, not an alert).
    - "zero":  latest run empty against a real baseline (alert).
    - "low":   latest run below min_fraction of baseline (alert).
    - "ok":    latest run within expected range.
    """
    if baseline_median is None or baseline_runs < min_baseline_runs or baseline_median <= 0:
        return "no_baseline", False
    latest = latest_cnt or 0
    if latest == 0:
        return "zero", True
    if latest < min_fraction * baseline_median:
        return "low", True
    return "ok", False


async def _fetch_rows() -> list[dict]:
    async with async_session_factory() as session:
        result = await session.execute(
            _QUERY, {"days": LOOKBACK_DAYS, "recent_hours": LATEST_WINDOW_HOURS}
        )
        return [dict(m) for m in result.mappings().all()]


def main() -> int:
    rows = asyncio.run(_fetch_rows())
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
        status, is_alert = classify(latest_cnt, baseline, baseline_runs)

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

    if alerts:
        logger.error("VOLUME ANOMALY: %s", "; ".join(alerts))
        return 1
    logger.info("All providers within expected volume.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
