"""Run the ML explainability pipeline scaffold.

Usage:
    uv run python run_train.py
    uv run python run_train.py --sku h100_sxm_80gb --eras C D
    uv run python run_train.py --upload
"""

import argparse
from collections.abc import Sequence

from basis.ml.features import ERA_LABELS

DEFAULT_SKU = "h100_sxm_80gb"


def build_parser() -> argparse.ArgumentParser:
    """Build the command-line parser without starting any analysis."""
    parser = argparse.ArgumentParser(
        description="Train the Basis ML explainability model (scaffold only)."
    )
    parser.add_argument(
        "--sku",
        default=DEFAULT_SKU,
        help=f"canonical GPU SKU to analyze (default: {DEFAULT_SKU})",
    )
    parser.add_argument(
        "--upload",
        action="store_true",
        help="upload completed artifacts to S3 when training is implemented",
    )
    parser.add_argument(
        "--eras",
        nargs="+",
        choices=ERA_LABELS,
        help="optional era filter, for example: --eras C D",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    """Validate arguments; Stage 3.3 will wire extraction into training."""
    build_parser().parse_args(argv)
    print("not implemented")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
