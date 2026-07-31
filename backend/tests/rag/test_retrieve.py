"""Synthetic-database tests for hybrid Ask Basis retrieval."""

from __future__ import annotations

import math

import pytest
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from basis.db.models import DocChunk
from basis.rag.indexer import EMBEDDING_DIMENSIONS
from basis.rag.retrieve import LOW_RELEVANCE_COSINE_FLOOR, RRF_K, retrieve


def _vector(first: float, second: float) -> list[float]:
    return [first, second, *([0.0] * (EMBEDDING_DIMENSIONS - 2))]


@pytest.mark.asyncio
async def test_hybrid_retrieval_rrf_order_matches_hand_computed_ranks(
    db_session: AsyncSession,
) -> None:
    await db_session.rollback()
    transaction = await db_session.begin()
    try:
        await db_session.execute(delete(DocChunk))
        vector_only = DocChunk(
            source_path="synthetic/vector.md",
            heading="Vector only",
            chunk_text="Residual variance without the lexical query terms.",
            embedding=_vector(1.0, 0.0),
            token_count=8,
        )
        lexical_first = DocChunk(
            source_path="synthetic/bid.md",
            heading="Bid offers",
            chunk_text="bid offers bid offers bid offers bid offers bid offers",
            embedding=_vector(0.9, math.sqrt(1.0 - 0.9**2)),
            token_count=10,
        )
        lexical_third = DocChunk(
            source_path="synthetic/short.md",
            heading="One mention",
            chunk_text="bid offers",
            embedding=_vector(0.8, 0.6),
            token_count=2,
        )
        lexical_second = DocChunk(
            source_path="synthetic/mid.md",
            heading="Several mentions",
            chunk_text="bid offers bid offers bid offers",
            embedding=_vector(0.1, math.sqrt(1.0 - 0.1**2)),
            token_count=6,
        )
        db_session.add_all([vector_only, lexical_first, lexical_third, lexical_second])
        await db_session.flush()

        result = await retrieve(
            db_session,
            question="bid offers",
            query_embedding=_vector(1.0, 0.0),
        )

        assert result.below_floor is False
        assert [chunk.id for chunk in result.chunks] == [
            lexical_first.id,
            lexical_second.id,
            lexical_third.id,
            vector_only.id,
        ]
        assert [(chunk.vector_rank, chunk.fts_rank) for chunk in result.chunks] == [
            (2, 1),
            (4, 2),
            (3, 3),
            (1, None),
        ]
        assert result.chunks[0].rrf_score == pytest.approx(1 / (RRF_K + 2) + 1 / (RRF_K + 1))
        assert result.chunks[1].rrf_score == pytest.approx(1 / (RRF_K + 4) + 1 / (RRF_K + 2))
    finally:
        await transaction.rollback()


@pytest.mark.asyncio
async def test_retrieval_returns_empty_when_both_legs_are_below_floor(
    db_session: AsyncSession,
) -> None:
    await db_session.rollback()
    transaction = await db_session.begin()
    try:
        await db_session.execute(delete(DocChunk))
        db_session.add(
            DocChunk(
                source_path="synthetic/unrelated.md",
                heading="Unrelated",
                chunk_text="GPU pricing methodology and regional variance.",
                embedding=_vector(0.1, math.sqrt(1.0 - 0.1**2)),
                token_count=7,
            )
        )
        await db_session.flush()

        result = await retrieve(
            db_session,
            question="quantum medicine",
            query_embedding=_vector(1.0, 0.0),
        )

        assert result.below_floor is True
        assert result.chunks == ()
        assert result.fts_candidate_count == 0
        assert result.best_vector_similarity is not None
        assert result.best_vector_similarity < LOW_RELEVANCE_COSINE_FLOOR
    finally:
        await transaction.rollback()
