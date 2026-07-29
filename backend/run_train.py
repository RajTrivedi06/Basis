"""Run the ML explainability pipeline scaffold.

Usage:
    uv run python run_train.py
    uv run python run_train.py --sku h100_sxm_80gb --eras C D
    uv run python run_train.py --upload
"""

import argparse
from collections.abc import Sequence

from basis.ml.features import extract_features
from basis.ml.train import train

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
        choices=("A", "B", "C", "D"),
        help="optional era filter, for example: --eras C D",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    """Parse arguments and hand off to the future extraction/training stages."""
    args = build_parser().parse_args(argv)
    try:
        features: object = extract_features(sku=args.sku, eras=args.eras)
        train(features)
    except NotImplementedError:
        print("not implemented")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
