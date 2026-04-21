"""Run the analytics pipeline.

Computes daily aggregates and basis decompositions from canonical offers
and upserts them into the database. Idempotent: re-running replaces
existing rows for the affected (date, gpu_sku) pairs.

Usage:
    uv run python run_analytics.py                   # all canonical offers
    uv run python run_analytics.py --reset           # wipe tables first
    uv run python run_analytics.py --date 2026-04-20 # restrict to one date
    uv run python run_analytics.py --gpu-sku h100_sxm_80gb
    uv run python run_analytics.py --date 2026-04-20 --gpu-sku h100_sxm_80gb
"""

from __future__ import annotations

import argparse
import asyncio
import datetime
import logging

from sqlalchemy import delete

from basis.analytics.aggregates import run_analytics
from basis.db.engine import async_session_factory
from basis.db.models import BasisDecomposition, DailyAggregate

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the Basis analytics pipeline.")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Wipe daily_aggregates and basis_decomposition before running.",
    )
    parser.add_argument(
        "--date",
        type=datetime.date.fromisoformat,
        help="Restrict processing to one collection date (YYYY-MM-DD).",
    )
    parser.add_argument(
        "--gpu-sku",
        type=str,
        help="Restrict processing to one canonical SKU (e.g., h100_sxm_80gb).",
    )
    return parser.parse_args()


async def main() -> None:
    args = parse_args()

    async with async_session_factory() as session:
        if args.reset:
            logger.info("Resetting: deleting daily_aggregates and basis_decomposition...")
            await session.execute(delete(DailyAggregate))
            await session.execute(delete(BasisDecomposition))
            await session.commit()
            logger.info("Analytics tables cleared.")

        summary = await run_analytics(
            session,
            only_date=args.date,
            only_gpu_sku=args.gpu_sku,
        )

    print()
    print("=== Analytics Summary ===")
    print(f"  Canonical offers loaded:  {summary['offers_loaded']}")
    print(f"  Daily aggregate rows:     {summary['aggregates_written']}")
    print(f"  Decomposition rows:       {summary['decompositions_written']}")
    print()


if __name__ == "__main__":
    asyncio.run(main())
