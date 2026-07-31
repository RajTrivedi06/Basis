"""Hybrid pgvector + Postgres FTS retrieval with reciprocal-rank fusion."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from basis.db.models import DocChunk

VECTOR_CANDIDATE_LIMIT: Final = 20
FTS_CANDIDATE_LIMIT: Final = 20
RETRIEVAL_RESULT_LIMIT: Final = 6
RRF_K: Final = 60
# Provisional design value: tune once against the golden set, then freeze here.
LOW_RELEVANCE_COSINE_FLOOR: Final = 0.25


@dataclass(frozen=True)
class RetrievedChunk:
    """One fused retrieval result with leg-level diagnostics."""

    id: int
    source_path: str
    heading: str | None
    chunk_text: str
    token_count: int
    rrf_score: float
    vector_rank: int | None
    fts_rank: int | None
    cosine_similarity: float | None
    fts_score: float | None


@dataclass(frozen=True)
class RetrievalResult:
    """Hybrid retrieval output and low-relevance disposition."""

    chunks: tuple[RetrievedChunk, ...]
    below_floor: bool
    best_vector_similarity: float | None
    vector_candidate_count: int
    fts_candidate_count: int


@dataclass
class _Candidate:
    chunk: DocChunk
    vector_rank: int | None = None
    fts_rank: int | None = None
    cosine_similarity: float | None = None
    fts_score: float | None = None

    @property
    def rrf_score(self) -> float:
        score = 0.0
        if self.vector_rank is not None:
            score += 1 / (RRF_K + self.vector_rank)
        if self.fts_rank is not None:
            score += 1 / (RRF_K + self.fts_rank)
        return score

    @property
    def best_rank(self) -> int:
        ranks = [rank for rank in (self.vector_rank, self.fts_rank) if rank is not None]
        return min(ranks)


async def retrieve(
    session: AsyncSession,
    *,
    question: str,
    query_embedding: list[float],
) -> RetrievalResult:
    """Run both retrieval legs, fuse their ranks, and apply the design floor."""
    cosine_distance = DocChunk.embedding.cosine_distance(query_embedding)
    cosine_similarity = (1 - cosine_distance).label("cosine_similarity")
    vector_rows = (
        await session.execute(
            select(DocChunk, cosine_similarity)
            .order_by(cosine_distance.asc(), DocChunk.id.asc())
            .limit(VECTOR_CANDIDATE_LIMIT)
        )
    ).all()

    ts_query = func.websearch_to_tsquery("english", question)
    lexical_score = func.ts_rank(DocChunk.chunk_tsv, ts_query).label("fts_score")
    fts_rows = (
        await session.execute(
            select(DocChunk, lexical_score)
            .where(DocChunk.chunk_tsv.op("@@")(ts_query))
            .order_by(lexical_score.desc(), DocChunk.id.asc())
            .limit(FTS_CANDIDATE_LIMIT)
        )
    ).all()

    best_vector_similarity = float(vector_rows[0].cosine_similarity) if vector_rows else None
    if not fts_rows and (
        best_vector_similarity is None or best_vector_similarity < LOW_RELEVANCE_COSINE_FLOOR
    ):
        return RetrievalResult(
            chunks=(),
            below_floor=True,
            best_vector_similarity=best_vector_similarity,
            vector_candidate_count=len(vector_rows),
            fts_candidate_count=0,
        )

    candidates: dict[int, _Candidate] = {}
    for rank, row in enumerate(vector_rows, start=1):
        candidate = candidates.setdefault(row.DocChunk.id, _Candidate(row.DocChunk))
        candidate.vector_rank = rank
        candidate.cosine_similarity = float(row.cosine_similarity)
    for rank, row in enumerate(fts_rows, start=1):
        candidate = candidates.setdefault(row.DocChunk.id, _Candidate(row.DocChunk))
        candidate.fts_rank = rank
        candidate.fts_score = float(row.fts_score)

    ordered = sorted(
        candidates.values(),
        key=lambda candidate: (
            -candidate.rrf_score,
            candidate.best_rank,
            candidate.chunk.id,
        ),
    )[:RETRIEVAL_RESULT_LIMIT]
    return RetrievalResult(
        chunks=tuple(
            RetrievedChunk(
                id=candidate.chunk.id,
                source_path=candidate.chunk.source_path,
                heading=candidate.chunk.heading,
                chunk_text=candidate.chunk.chunk_text,
                token_count=candidate.chunk.token_count,
                rrf_score=candidate.rrf_score,
                vector_rank=candidate.vector_rank,
                fts_rank=candidate.fts_rank,
                cosine_similarity=candidate.cosine_similarity,
                fts_score=candidate.fts_score,
            )
            for candidate in ordered
        ),
        below_floor=False,
        best_vector_similarity=best_vector_similarity,
        vector_candidate_count=len(vector_rows),
        fts_candidate_count=len(fts_rows),
    )
