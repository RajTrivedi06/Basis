"""Transactional document indexing for Ask Basis."""

from __future__ import annotations

import gzip
import json
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Final, Protocol

from openai import AsyncOpenAI
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from basis.db.models import DocChunk
from basis.rag.chunker import ChunkingStrategy, chunk_markdown

EMBEDDING_MODEL: Final = "text-embedding-3-small"
EMBEDDING_DIMENSIONS: Final = 1536
MAX_EMBEDDING_BATCH_SIZE: Final = 100
# Official model-card price verified 2026-07-30. Recheck before changing this estimate.
EMBEDDING_PRICE_PER_MILLION_TOKENS_USD: Final = 0.02

_NARRATIVE_PATHS: Final = (
    "docs/findings.md",
    "docs/methodology.md",
    "docs/project-brief.md",
    "docs/project-status.md",
)
_ADR_PATHS: Final = (
    "docs/01-architecture/adr/0002-conservative-normalization.md",
    "docs/01-architecture/adr/0003-skip-lambda-labs.md",
    "docs/01-architecture/adr/0004-normalization-attribution.md",
    "docs/01-architecture/adr/0005-residual-first-ui.md",
    "docs/01-architecture/adr/0006-ml-layer-raw-payload-access.md",
    "docs/decisions/adr-log.md",
)
_REFERENCE_PATHS: Final = (
    "docs/02-reference/data-sources.md",
    "docs/02-reference/database.md",
    "docs/02-reference/api.md",
)
_ARCHITECTURE_PATHS: Final = (
    "docs/01-architecture/system-overview.md",
    "docs/01-architecture/data-flow.md",
)
_ROOT_PATHS: Final = ("Basis_Project_Proposal.md",)


@dataclass(frozen=True)
class EmbeddingBatch:
    """One embedding provider response."""

    vectors: list[list[float]]
    input_tokens: int


class Embedder(Protocol):
    """Minimal embedding interface shared by OpenAI and deterministic tests."""

    async def embed(self, texts: list[str]) -> EmbeddingBatch:
        """Embed a batch of at most 100 texts."""
        ...


class OpenAIEmbedder:
    """Hosted OpenAI embedding adapter used at index and query time."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        client: Any | None = None,
    ) -> None:
        self._client = client or AsyncOpenAI(api_key=api_key)

    async def embed(self, texts: list[str]) -> EmbeddingBatch:
        """Embed one bounded batch and restore response input order."""
        if len(texts) > MAX_EMBEDDING_BATCH_SIZE:
            raise ValueError(f"embedding batch exceeds {MAX_EMBEDDING_BATCH_SIZE} inputs")
        response = await self._client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=texts,
            dimensions=EMBEDDING_DIMENSIONS,
        )
        ordered = sorted(response.data, key=lambda item: item.index)
        return EmbeddingBatch(
            vectors=[list(item.embedding) for item in ordered],
            input_tokens=int(response.usage.total_tokens),
        )


class FixtureEmbedder:
    """Exact-text query embeddings for keyless eval environments only."""

    def __init__(self, fixture_path: Path) -> None:
        payload = json.loads(gzip.decompress(fixture_path.read_bytes()))
        if payload.get("embedding_model") != EMBEDDING_MODEL:
            raise ValueError("query fixture embedding model does not match the frozen model")
        if payload.get("embedding_dimensions") != EMBEDDING_DIMENSIONS:
            raise ValueError("query fixture embedding dimensions do not match the schema")
        raw_embeddings = payload.get("embeddings")
        if not isinstance(raw_embeddings, dict):
            raise ValueError("query fixture embeddings must be an object keyed by exact text")
        self._embeddings = {
            str(text): [float(value) for value in vector]
            for text, vector in raw_embeddings.items()
        }
        if any(len(vector) != EMBEDDING_DIMENSIONS for vector in self._embeddings.values()):
            raise ValueError("query fixture contains a vector with the wrong dimensions")

    async def embed(self, texts: list[str]) -> EmbeddingBatch:
        """Return only pre-approved exact-text embeddings; never call a provider."""
        missing = [text for text in texts if text not in self._embeddings]
        if missing:
            raise ValueError(f"query embedding fixture has no entry for: {missing[0]!r}")
        return EmbeddingBatch(
            vectors=[self._embeddings[text] for text in texts],
            input_tokens=0,
        )


@dataclass(frozen=True)
class IndexedDocument:
    """Indexing result for one source document."""

    source_path: str
    chunk_count: int
    input_tokens: int
    estimated_cost_usd: float
    chunks: tuple[EmbeddedChunk, ...]


@dataclass(frozen=True)
class EmbeddedChunk:
    """Chunk content paired with its persisted embedding."""

    source_path: str
    heading: str | None
    chunk_text: str
    token_count: int
    embedding: tuple[float, ...]


@dataclass(frozen=True)
class IndexRun:
    """Complete corpus indexing result."""

    strategy: ChunkingStrategy
    documents: tuple[IndexedDocument, ...]

    @property
    def total_chunks(self) -> int:
        return sum(document.chunk_count for document in self.documents)

    @property
    def total_input_tokens(self) -> int:
        return sum(document.input_tokens for document in self.documents)

    @property
    def estimated_cost_usd(self) -> float:
        return sum(document.estimated_cost_usd for document in self.documents)


def corpus_paths(repo_root: Path) -> tuple[Path, ...]:
    """Return the exact curated corpus approved in the design."""
    explicit_paths = (
        *_NARRATIVE_PATHS,
        *_ADR_PATHS,
        *_REFERENCE_PATHS,
        *_ARCHITECTURE_PATHS,
        *_ROOT_PATHS,
    )
    paths = [repo_root / relative_path for relative_path in explicit_paths]
    paths.extend(sorted((repo_root / "docs" / "analysis").glob("*.md")))
    missing = [path for path in paths if not path.is_file()]
    if missing:
        formatted = ", ".join(str(path) for path in missing)
        raise FileNotFoundError(f"approved RAG corpus files are missing: {formatted}")
    return tuple(paths)


async def index_document(
    session: AsyncSession,
    *,
    source_path: str,
    markdown: str,
    embedder: Embedder,
    strategy: ChunkingStrategy = "heading",
) -> IndexedDocument:
    """Replace one source path's chunks atomically."""
    chunks = chunk_markdown(source_path, markdown, strategy=strategy)
    vectors: list[list[float]] = []
    input_tokens = 0
    for start in range(0, len(chunks), MAX_EMBEDDING_BATCH_SIZE):
        batch_chunks = chunks[start : start + MAX_EMBEDDING_BATCH_SIZE]
        embedded = await embedder.embed([chunk.embedding_text for chunk in batch_chunks])
        if len(embedded.vectors) != len(batch_chunks):
            raise ValueError(
                "embedding provider returned "
                f"{len(embedded.vectors)} vectors for {len(batch_chunks)} inputs"
            )
        vectors.extend(embedded.vectors)
        input_tokens += embedded.input_tokens

    embedded_chunks = tuple(
        EmbeddedChunk(
            source_path=chunk.source_path,
            heading=chunk.heading,
            chunk_text=chunk.chunk_text,
            token_count=chunk.token_count,
            embedding=tuple(vector),
        )
        for chunk, vector in zip(chunks, vectors, strict=True)
    )

    async with session.begin():
        await session.execute(delete(DocChunk).where(DocChunk.source_path == source_path))
        session.add_all(
            [
                DocChunk(
                    source_path=chunk.source_path,
                    heading=chunk.heading,
                    chunk_text=chunk.chunk_text,
                    embedding=list(chunk.embedding),
                    token_count=chunk.token_count,
                )
                for chunk in embedded_chunks
            ]
        )
        await session.flush()

    return IndexedDocument(
        source_path=source_path,
        chunk_count=len(chunks),
        input_tokens=input_tokens,
        estimated_cost_usd=(input_tokens * EMBEDDING_PRICE_PER_MILLION_TOKENS_USD / 1_000_000),
        chunks=embedded_chunks,
    )


async def index_corpus(
    session: AsyncSession,
    *,
    repo_root: Path,
    embedder: Embedder,
    strategy: ChunkingStrategy = "heading",
) -> IndexRun:
    """Index every approved corpus file, committing once per source path."""
    documents: list[IndexedDocument] = []
    for path in corpus_paths(repo_root):
        source_path = path.relative_to(repo_root).as_posix()
        document = await index_document(
            session,
            source_path=source_path,
            markdown=path.read_text(encoding="utf-8"),
            embedder=embedder,
            strategy=strategy,
        )
        documents.append(document)
    return IndexRun(strategy=strategy, documents=tuple(documents))


def write_fixture(run: IndexRun, fixture_path: Path) -> None:
    """Write deterministic gzip-compressed JSON embeddings for CI."""
    payload = {
        "schema_version": 1,
        "embedding_model": EMBEDDING_MODEL,
        "embedding_dimensions": EMBEDDING_DIMENSIONS,
        "chunking_strategy": run.strategy,
        "chunks": [
            {
                "source_path": chunk.source_path,
                "heading": chunk.heading,
                "chunk_text": chunk.chunk_text,
                "token_count": chunk.token_count,
                "embedding": chunk.embedding,
            }
            for document in run.documents
            for chunk in document.chunks
        ],
    }
    serialized = json.dumps(
        payload,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    fixture_path.parent.mkdir(parents=True, exist_ok=True)
    fixture_path.write_bytes(gzip.compress(serialized, compresslevel=9, mtime=0))


def write_query_fixture(
    embeddings: Mapping[str, list[float]],
    fixture_path: Path,
) -> None:
    """Write deterministic exact-question embeddings for keyless eval API runs."""
    if any(len(vector) != EMBEDDING_DIMENSIONS for vector in embeddings.values()):
        raise ValueError("query embedding fixture contains a vector with the wrong dimensions")
    payload = {
        "schema_version": 1,
        "embedding_model": EMBEDDING_MODEL,
        "embedding_dimensions": EMBEDDING_DIMENSIONS,
        "embeddings": dict(embeddings),
    }
    serialized = json.dumps(
        payload,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    fixture_path.parent.mkdir(parents=True, exist_ok=True)
    fixture_path.write_bytes(gzip.compress(serialized, compresslevel=9, mtime=0))
