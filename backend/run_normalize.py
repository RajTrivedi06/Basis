"""Run the normalization pipeline.

Processes all raw observations that haven't been normalized yet,
creating canonical offers in the database.

Usage:
    uv run python run_normalize.py           # normalize all pending observations
    uv run python run_normalize.py --reset   # delete all canonical offers and re-normalize
"""

import asyncio
import logging
import sys

from sqlalchemy import delete

from basis.db.engine import async_session_factory
from basis.db.models import CanonicalOffer
from basis.normalization.pipeline import run_normalization

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


async def main() -> None:
    args = sys.argv[1:]
    reset = "--reset" in args

    async with async_session_factory() as session:
        if reset:
            logger.info("Resetting: deleting all canonical offers...")
            await session.execute(delete(CanonicalOffer))
            await session.commit()
            logger.info("All canonical offers deleted.")

        summary = await run_normalization(session)

    print()
    print("=== Normalization Summary ===")
    print(f"  Processed:  {summary['total_processed']}")
    print(f"  Created:    {summary['canonical_offers_created']}")
    print(f"  Skipped:    {summary['skipped_unknown_gpu']} (unknown GPU names)")
    print()

    if summary["skipped_unknown_gpu"] > 0:
        print("  Skipped observations have GPU names not in our mapping table.")
        print("  To see them: SELECT DISTINCT gpu_model_reported FROM raw_observations")
        print("  WHERE id NOT IN (SELECT raw_observation_id FROM canonical_offers);")


if __name__ == "__main__":
    asyncio.run(main())
