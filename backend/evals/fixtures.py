"""Load committed RAG fixtures into an eval database without provider calls."""

from __future__ import annotations

import gzip
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from basis.db.models import DocChunk
from basis.rag.indexer import EMBEDDING_DIMENSIONS, EMBEDDING_MODEL

EvalChunker = Literal["primary", "alternative"]


@dataclass(frozen=True)
class LoadedChunkFixture:
    """Metadata for one committed chunk fixture replacement."""

    strategy: str
    chunk_count: int
    path: str


async def replace_doc_chunks_from_fixture(
    session: AsyncSession,
    *,
    fixture_path: Path,
    expected_chunker: EvalChunker,
) -> LoadedChunkFixture:
    """Atomically replace doc_chunks with the selected pre-embedded fixture."""
    payload = _read_fixture(fixture_path)
    expected_strategy = "heading" if expected_chunker == "primary" else "fixed"
    strategy = str(payload.get("chunking_strategy"))
    if strategy != expected_strategy:
        raise ValueError(
            f"{fixture_path} uses {strategy!r}, expected {expected_strategy!r} "
            f"for --chunker {expected_chunker}"
        )
    chunks = payload.get("chunks")
    if not isinstance(chunks, list) or not chunks:
        raise ValueError(f"{fixture_path} has no chunks")

    rows: list[DocChunk] = []
    for index, raw_chunk in enumerate(chunks):
        if not isinstance(raw_chunk, dict):
            raise ValueError(f"{fixture_path} chunk {index} is not an object")
        embedding = raw_chunk.get("embedding")
        if not isinstance(embedding, list) or len(embedding) != EMBEDDING_DIMENSIONS:
            raise ValueError(f"{fixture_path} chunk {index} has invalid embedding dimensions")
        rows.append(
            DocChunk(
                source_path=str(raw_chunk["source_path"]),
                heading=(str(raw_chunk["heading"]) if raw_chunk.get("heading") else None),
                chunk_text=str(raw_chunk["chunk_text"]),
                embedding=[float(value) for value in embedding],
                token_count=int(raw_chunk["token_count"]),
            )
        )

    async with session.begin():
        await session.execute(delete(DocChunk))
        session.add_all(rows)
        await session.flush()
    return LoadedChunkFixture(
        strategy=strategy,
        chunk_count=len(rows),
        path=str(fixture_path),
    )


def _read_fixture(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(gzip.decompress(path.read_bytes()))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"invalid gzip JSON chunk fixture: {path}") from exc
    if not isinstance(payload, dict):
        raise ValueError(f"chunk fixture root must be an object: {path}")
    if payload.get("embedding_model") != EMBEDDING_MODEL:
        raise ValueError(f"chunk fixture model does not match {EMBEDDING_MODEL}: {path}")
    if payload.get("embedding_dimensions") != EMBEDDING_DIMENSIONS:
        raise ValueError(
            f"chunk fixture dimensions do not match {EMBEDDING_DIMENSIONS}: {path}"
        )
    return payload
