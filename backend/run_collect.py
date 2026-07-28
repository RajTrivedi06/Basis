"""Run a single collection cycle for one or all collectors.

Usage:
    uv run python run_collect.py              # run all collectors
    uv run python run_collect.py vast         # run only Vast.ai
    uv run python run_collect.py --dry-run    # fetch but don't save to DB
"""

import asyncio
import logging
import statistics
import sys

from basis.collectors.azure import AzureCollector
from basis.collectors.vast import VastCollector
from basis.collectors.runpod import RunPodCollector
from basis.collectors.aws_spot import AWSSpotCollector
from basis.collectors.lambda_labs import LambdaLabsCollector
from basis.collectors.persist import save_observations
from basis.db.engine import async_session_factory

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# Map of collector name -> class. Add new collectors here as they're implemented.
# Lambda Labs requires a payment method for API access — excluded to keep costs at $0.
# TensorDock parked 2026-07-13 (feed drained; collector + tests kept, see
# docs/02-reference/data-sources.md for the restore recipe).
AVAILABLE = {
    "vast": VastCollector,
    "runpod": RunPodCollector,
    "aws_spot": AWSSpotCollector,
    "azure": AzureCollector,
}


async def main() -> None:
    args = sys.argv[1:]
    dry_run = "--dry-run" in args
    targets = [a for a in args if not a.startswith("--")]

    # If no targets specified, run all available collectors
    if not targets:
        targets = list(AVAILABLE.keys())

    for name in targets:
        collector_cls = AVAILABLE.get(name)
        if collector_cls is None:
            logger.error("Unknown collector: %s (available: %s)", name, list(AVAILABLE.keys()))
            continue

        collector = collector_cls()
        observations = await collector.run()

        if not observations:
            logger.warning("No observations returned from %s", name)
            continue

        # Print a summary
        gpu_counts: dict[str, int] = {}
        gpu_prices: dict[str, list[float]] = {}
        gpu_commitment_prices: dict[tuple[str, str], list[float]] = {}
        commitment_counts: dict[str, int] = {}
        for obs in observations:
            gpu_counts[obs.gpu_model_reported] = gpu_counts.get(obs.gpu_model_reported, 0) + 1
            gpu_prices.setdefault(obs.gpu_model_reported, []).append(obs.price_hourly)
            commitment = obs.commitment_type_reported or "unknown"
            commitment_counts[commitment] = commitment_counts.get(commitment, 0) + 1
            gpu_commitment_prices.setdefault(
                (obs.gpu_model_reported, commitment), []
            ).append(obs.price_hourly)

        logger.info(
            "%s: %d observations across %d GPU types", name, len(observations), len(gpu_counts)
        )
        for gpu, count in sorted(gpu_counts.items(), key=lambda x: -x[1]):
            prices = gpu_prices[gpu]
            logger.info(
                "  %-25s %d offers | $%.2f-$%.2f/GPU-hr (median $%.2f)",
                gpu,
                count,
                min(prices),
                max(prices),
                statistics.median(prices),
            )
            for commitment in sorted(commitment_counts):
                commitment_prices = gpu_commitment_prices.get((gpu, commitment))
                if commitment_prices:
                    logger.info(
                        "    %-13s %4d | $%.2f-$%.2f/GPU-hr (median $%.2f)",
                        commitment,
                        len(commitment_prices),
                        min(commitment_prices),
                        max(commitment_prices),
                        statistics.median(commitment_prices),
                    )
        logger.info(
            "  commitment mix: %s",
            ", ".join(
                f"{commitment}={count}"
                for commitment, count in sorted(commitment_counts.items())
            ),
        )

        if dry_run:
            logger.info("Dry run — skipping database save")
        else:
            async with async_session_factory() as session:
                saved = await save_observations(session, observations)
                logger.info("Saved %d rows to raw_observations", saved)


if __name__ == "__main__":
    asyncio.run(main())
