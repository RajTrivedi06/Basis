"""Index the approved Ask Basis document corpus."""

from __future__ import annotations

import argparse
import asyncio
from collections.abc import Sequence
from pathlib import Path

import yaml

from basis.config import settings
from basis.db.engine import async_session_factory, engine
from basis.rag.data_card import DATA_CARD_PATH, generate_data_card, write_data_card
from basis.rag.indexer import (
    OpenAIEmbedder,
    index_corpus,
    write_fixture,
    write_query_fixture,
)

REPO_ROOT = Path(__file__).resolve().parent.parent
FIXTURE_DIR = REPO_ROOT / "backend" / "tests" / "fixtures"
CHUNK_FIXTURE_PATHS = {
    "heading": FIXTURE_DIR / "rag_chunks_fixture.json.gz",
    "fixed": FIXTURE_DIR / "rag_chunks_fixture_alternative.json.gz",
}
QUERY_FIXTURE_PATH = FIXTURE_DIR / "rag_eval_query_embeddings.json.gz"
QUESTIONS_PATH = REPO_ROOT / "backend" / "evals" / "questions.yaml"


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
        data_card = await generate_data_card(session)
    write_data_card(data_card)

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
    print(f"Wrote data card: {DATA_CARD_PATH}")

    if args.emit_fixture:
        chunk_fixture_path = CHUNK_FIXTURE_PATHS[args.chunker]
        write_fixture(run, chunk_fixture_path)
        print(f"Wrote fixture: {chunk_fixture_path}")
        questions = _load_eval_questions()
        query_batch = await embedder.embed(questions)
        if len(query_batch.vectors) != len(questions):
            raise ValueError("embedding provider returned the wrong eval query vector count")
        write_query_fixture(
            dict(zip(questions, query_batch.vectors, strict=True)),
            QUERY_FIXTURE_PATH,
        )
        print(
            f"Wrote eval query fixture: {QUERY_FIXTURE_PATH} "
            f"questions={len(questions)} tokens={query_batch.input_tokens}"
        )
    return 0


def _load_eval_questions() -> list[str]:
    payload = yaml.safe_load(QUESTIONS_PATH.read_text(encoding="utf-8"))
    return [str(question["question"]) for question in payload["questions"]]


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
