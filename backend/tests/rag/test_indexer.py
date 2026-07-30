"""Database behavior tests for the Ask Basis indexing pipeline."""

from __future__ import annotations

import gzip
import json
import os
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
from sqlalchemy import delete, func, select
from sqlalchemy.exc import StatementError
from sqlalchemy.ext.asyncio import AsyncSession

from basis.db.models import DocChunk
from basis.rag.indexer import (
    EMBEDDING_DIMENSIONS,
    EMBEDDING_MODEL,
    EmbeddedChunk,
    EmbeddingBatch,
    IndexedDocument,
    IndexRun,
    OpenAIEmbedder,
    corpus_paths,
    index_document,
    write_fixture,
)

TEST_SOURCE = "tests/rag/idempotency.md"
REPO_ROOT = Path(__file__).parents[3]
RUN_INDEX_PATH = REPO_ROOT / "backend" / "run_index.py"
TEST_MARKDOWN = """# Idempotent indexing

Basis indexes documentation by source path. Running the indexer again replaces the
previous chunks atomically instead of appending duplicates. This deterministic paragraph
is long enough to produce one useful chunk for the persistence contract test.
"""


class DeterministicEmbedder:
    """Return stable, nonzero vectors without making an API call."""

    async def embed(self, texts: list[str]) -> EmbeddingBatch:
        vectors = []
        for index, _text in enumerate(texts, start=1):
            vectors.append([float(index), *([0.0] * (EMBEDDING_DIMENSIONS - 1))])
        return EmbeddingBatch(vectors=vectors, input_tokens=sum(len(text) for text in texts))


class InvalidDimensionEmbedder:
    """Force persistence to fail after the transactional delete begins."""

    async def embed(self, texts: list[str]) -> EmbeddingBatch:
        return EmbeddingBatch(
            vectors=[[1.0, 0.0] for _text in texts],
            input_tokens=sum(len(text) for text in texts),
        )


class FakeEmbeddingsAPI:
    """Capture the SDK request and return deterministic response objects."""

    def __init__(self) -> None:
        self.request: dict[str, Any] | None = None

    async def create(self, **kwargs: Any) -> SimpleNamespace:
        self.request = kwargs
        return SimpleNamespace(
            data=[
                SimpleNamespace(index=1, embedding=[0.0, 1.0]),
                SimpleNamespace(index=0, embedding=[1.0, 0.0]),
            ],
            usage=SimpleNamespace(total_tokens=7),
        )


class FakeOpenAIClient:
    def __init__(self) -> None:
        self.embeddings = FakeEmbeddingsAPI()


def test_corpus_paths_match_the_approved_allowlist() -> None:
    paths = corpus_paths(REPO_ROOT)
    relative_paths = {path.relative_to(REPO_ROOT).as_posix() for path in paths}
    expected = {
        "docs/findings.md",
        "docs/methodology.md",
        "docs/project-brief.md",
        "docs/project-status.md",
        "docs/01-architecture/adr/0002-conservative-normalization.md",
        "docs/01-architecture/adr/0003-skip-lambda-labs.md",
        "docs/01-architecture/adr/0004-normalization-attribution.md",
        "docs/01-architecture/adr/0005-residual-first-ui.md",
        "docs/01-architecture/adr/0006-ml-layer-raw-payload-access.md",
        "docs/decisions/adr-log.md",
        "docs/02-reference/data-sources.md",
        "docs/02-reference/database.md",
        "docs/02-reference/api.md",
        "docs/01-architecture/system-overview.md",
        "docs/01-architecture/data-flow.md",
        "Basis_Project_Proposal.md",
    }
    expected.update(
        path.relative_to(REPO_ROOT).as_posix()
        for path in (REPO_ROOT / "docs" / "analysis").glob("*.md")
    )

    assert relative_paths == expected
    assert "docs/01-architecture/adr/0001-template.md" not in relative_paths
    assert not any(path.startswith("docs/05-llm/") for path in relative_paths)
    assert not any(path.startswith("docs/guides/") for path in relative_paths)


@pytest.mark.asyncio
async def test_openai_embedder_uses_frozen_model_and_preserves_input_order() -> None:
    client = FakeOpenAIClient()
    embedded = await OpenAIEmbedder(client=client).embed(["first", "second"])

    assert client.embeddings.request == {
        "model": EMBEDDING_MODEL,
        "input": ["first", "second"],
        "dimensions": EMBEDDING_DIMENSIONS,
    }
    assert embedded.vectors == [[1.0, 0.0], [0.0, 1.0]]
    assert embedded.input_tokens == 7


@pytest.mark.asyncio
async def test_openai_embedder_rejects_more_than_100_inputs() -> None:
    client = FakeOpenAIClient()
    with pytest.raises(ValueError, match="exceeds 100 inputs"):
        await OpenAIEmbedder(client=client).embed(["text"] * 101)
    assert client.embeddings.request is None


def test_fixture_writer_is_deterministic_gzip_json(tmp_path: Path) -> None:
    embedded_chunk = EmbeddedChunk(
        source_path="docs/example.md",
        heading="example.md \u203a Example",
        chunk_text="Fixture text",
        token_count=2,
        embedding=tuple([1.0, *([0.0] * (EMBEDDING_DIMENSIONS - 1))]),
    )
    run = IndexRun(
        strategy="heading",
        documents=(
            IndexedDocument(
                source_path=embedded_chunk.source_path,
                chunk_count=1,
                input_tokens=2,
                estimated_cost_usd=0.0,
                chunks=(embedded_chunk,),
            ),
        ),
    )
    first_path = tmp_path / "first.json.gz"
    second_path = tmp_path / "second.json.gz"

    write_fixture(run, first_path)
    write_fixture(run, second_path)
    payload = json.loads(gzip.decompress(first_path.read_bytes()))

    assert first_path.read_bytes() == second_path.read_bytes()
    assert payload["embedding_model"] == EMBEDDING_MODEL
    assert payload["embedding_dimensions"] == EMBEDDING_DIMENSIONS
    assert payload["chunks"][0]["source_path"] == "docs/example.md"
    assert len(payload["chunks"][0]["embedding"]) == EMBEDDING_DIMENSIONS


def test_run_index_without_openai_key_exits_cleanly() -> None:
    environment = os.environ.copy()
    environment["OPENAI_API_KEY"] = ""
    result = subprocess.run(
        [sys.executable, str(RUN_INDEX_PATH)],
        cwd=RUN_INDEX_PATH.parent,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )

    combined = result.stdout + result.stderr
    assert result.returncode == 2
    assert "OPENAI_API_KEY is not configured" in combined
    assert "Traceback" not in combined


@pytest.mark.asyncio
async def test_index_document_is_idempotent_per_source_path(
    db_session: AsyncSession,
) -> None:
    await db_session.rollback()
    try:
        first = await index_document(
            db_session,
            source_path=TEST_SOURCE,
            markdown=TEST_MARKDOWN,
            embedder=DeterministicEmbedder(),
        )
        second = await index_document(
            db_session,
            source_path=TEST_SOURCE,
            markdown=TEST_MARKDOWN,
            embedder=DeterministicEmbedder(),
        )
        persisted_count = await db_session.scalar(
            select(func.count(DocChunk.id)).where(DocChunk.source_path == TEST_SOURCE)
        )

        assert first.chunk_count == 1
        assert second.chunk_count == first.chunk_count
        assert persisted_count == first.chunk_count
    finally:
        await db_session.rollback()
        await db_session.execute(delete(DocChunk).where(DocChunk.source_path == TEST_SOURCE))
        await db_session.commit()


@pytest.mark.asyncio
async def test_index_document_failure_preserves_prior_source_state(
    db_session: AsyncSession,
) -> None:
    await db_session.rollback()
    try:
        await index_document(
            db_session,
            source_path=TEST_SOURCE,
            markdown=TEST_MARKDOWN,
            embedder=DeterministicEmbedder(),
        )
        prior_text = await db_session.scalar(
            select(DocChunk.chunk_text).where(DocChunk.source_path == TEST_SOURCE)
        )
        await db_session.rollback()

        with pytest.raises(StatementError, match="expected 1536 dimensions"):
            await index_document(
                db_session,
                source_path=TEST_SOURCE,
                markdown="# Replacement\n\nThis replacement must roll back.",
                embedder=InvalidDimensionEmbedder(),
            )

        persisted_text = await db_session.scalar(
            select(DocChunk.chunk_text).where(DocChunk.source_path == TEST_SOURCE)
        )
        persisted_count = await db_session.scalar(
            select(func.count(DocChunk.id)).where(DocChunk.source_path == TEST_SOURCE)
        )
        assert persisted_count == 1
        assert persisted_text == prior_text
    finally:
        await db_session.rollback()
        await db_session.execute(delete(DocChunk).where(DocChunk.source_path == TEST_SOURCE))
        await db_session.commit()
