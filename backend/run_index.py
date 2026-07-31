"""Index the approved Ask Basis document corpus."""

from __future__ import annotations

import argparse
import asyncio
from collections.abc import Sequence
from pathlib import Path

from basis.config import settings
from basis.db.engine import async_session_factory, engine
from basis.rag.indexer import OpenAIEmbedder, index_corpus, write_fixture

REPO_ROOT = Path(__file__).resolve().parent.parent
FIXTURE_PATH = REPO_ROOT / "backend" / "tests" / "fixtures" / "rag_chunks_fixture.json.gz"


def build_parser() -> argparse.ArgumentParser:
    """Build the indexing CLI parser."""
    parser = argparse.ArgumentParser(description="Index the Ask Basis document corpus.")
    parser.add_argument(
        "--chunker",
        choices=("heading", "fixed"),
        default="heading",
        help="chunking strategy (default: heading)",
    )
    parser.add_argument(
        "--emit-fixture",
        action="store_true",
        help="write the deterministic pre-embedded CI chunk fixture",
    )
    return parser


async def run_pipeline(args: argparse.Namespace) -> int:
    """Run indexing after configuration validation."""
    if not settings.openai_api_key:
        print("OPENAI_API_KEY is not configured; no documents were indexed.")
        return 2

    embedder = OpenAIEmbedder(api_key=settings.openai_api_key)
    async with async_session_factory() as session:
        run = await index_corpus(
            session,
            repo_root=REPO_ROOT,
            embedder=embedder,
            strategy=args.chunker,
        )

    for document in run.documents:
        print(
            f"{document.source_path}: chunks={document.chunk_count} "
            f"tokens={document.input_tokens} "
            f"cost=${document.estimated_cost_usd:.6f}"
        )
    print(
        f"TOTAL: documents={len(run.documents)} chunks={run.total_chunks} "
        f"tokens={run.total_input_tokens} cost=${run.estimated_cost_usd:.6f}"
    )

    if args.emit_fixture:
        write_fixture(run, FIXTURE_PATH)
        print(f"Wrote fixture: {FIXTURE_PATH}")
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    """CLI entry point."""
    args = build_parser().parse_args(argv)
    return asyncio.run(_run_and_dispose(args))


async def _run_and_dispose(args: argparse.Namespace) -> int:
    try:
        return await run_pipeline(args)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
