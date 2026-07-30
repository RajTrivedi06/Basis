"""Database contract tests for the Ask Basis document-chunk schema."""

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from basis.db.models import DocChunk


@pytest.mark.asyncio
async def test_doc_chunks_migration_objects_exist(db_session: AsyncSession) -> None:
    """The migration installs pgvector and all required retrieval indexes."""
    extension = await db_session.scalar(
        text("SELECT extname FROM pg_extension WHERE extname = 'vector'")
    )
    table = await db_session.scalar(text("SELECT to_regclass('public.doc_chunks')"))
    indexes = (
        await db_session.execute(
            text(
                """
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE schemaname = 'public'
                  AND tablename = 'doc_chunks'
                """
            )
        )
    ).all()
    index_definitions = {name: definition for name, definition in indexes}

    assert extension == "vector"
    assert table == "doc_chunks"
    assert "ix_doc_chunks_source_path" in index_definitions
    assert "USING btree (source_path)" in index_definitions["ix_doc_chunks_source_path"]
    assert "ix_doc_chunks_chunk_tsv" in index_definitions
    assert "USING gin (chunk_tsv)" in index_definitions["ix_doc_chunks_chunk_tsv"]
    assert "ix_doc_chunks_embedding_hnsw" in index_definitions
    assert (
        "USING hnsw (embedding vector_cosine_ops)"
        in index_definitions["ix_doc_chunks_embedding_hnsw"]
    )


@pytest.mark.asyncio
async def test_doc_chunk_vector_roundtrip_and_generated_tsvector(
    db_session: AsyncSession,
) -> None:
    """A 1536-d vector round-trips and chunk text populates the search vector."""
    embedding = [1.0, *([0.0] * 1535)]
    chunk = DocChunk(
        source_path="docs/test-only.md",
        heading="Fungibility",
        chunk_text="GPU fungibility leaves measurable residual basis risk.",
        embedding=embedding,
        token_count=9,
    )

    try:
        db_session.add(chunk)
        await db_session.flush()

        stored = (
            await db_session.execute(
                text(
                    """
                    SELECT embedding, chunk_tsv::text AS chunk_tsv,
                           chunk_tsv @@ plainto_tsquery('english', 'fungibility') AS matches,
                           created_at
                    FROM doc_chunks
                    WHERE id = :id
                    """
                ),
                {"id": chunk.id},
            )
        ).one()

        roundtripped_embedding = stored.embedding
        if isinstance(roundtripped_embedding, str):
            roundtripped_embedding = [
                float(value) for value in roundtripped_embedding.strip("[]").split(",")
            ]

        assert len(roundtripped_embedding) == 1536
        assert roundtripped_embedding == pytest.approx(embedding)
        assert "'fungibl'" in stored.chunk_tsv
        assert stored.matches is True
        assert stored.created_at.tzinfo is not None
    finally:
        await db_session.rollback()
