"""Golden behavior tests for both approved Ask Basis chunkers."""

from itertools import pairwise
from pathlib import Path

import tiktoken

from basis.rag.chunker import (
    ALTERNATIVE_OVERLAP_TOKENS,
    ALTERNATIVE_WINDOW_TOKENS,
    BREADCRUMB_SEPARATOR,
    PRIMARY_MAX_TOKENS,
    PRIMARY_MIN_TOKENS,
    chunk_markdown,
)

FIXTURE_PATH = Path(__file__).parents[1] / "fixtures" / "rag_chunker_golden.md"
SOURCE_PATH = "backend/tests/fixtures/rag_chunker_golden.md"


def test_heading_chunker_preserves_golden_boundaries_and_context() -> None:
    chunks = chunk_markdown(SOURCE_PATH, FIXTURE_PATH.read_text(encoding="utf-8"))

    assert len(chunks) == 5
    assert [chunk.heading for chunk in chunks] == [
        BREADCRUMB_SEPARATOR.join(("rag_chunker_golden.md", "GPU Basis Study")),
        BREADCRUMB_SEPARATOR.join(("rag_chunker_golden.md", "GPU Basis Study", "Long Analysis")),
        BREADCRUMB_SEPARATOR.join(("rag_chunker_golden.md", "GPU Basis Study", "Long Analysis")),
        BREADCRUMB_SEPARATOR.join(("rag_chunker_golden.md", "GPU Basis Study", "Following Detail")),
        BREADCRUMB_SEPARATOR.join(("rag_chunker_golden.md", "GPU Basis Study", "Table Evidence")),
    ]
    assert "P1_START" in chunks[1].chunk_text
    assert "P4_END" in chunks[1].chunk_text
    assert "P5_START" not in chunks[1].chunk_text
    assert "P5_START" in chunks[2].chunk_text
    assert "P5_END" in chunks[2].chunk_text
    assert "TINY_MARKER" in chunks[3].chunk_text
    assert "FOLLOWING_START" in chunks[3].chunk_text
    assert all(PRIMARY_MIN_TOKENS <= chunk.token_count <= PRIMARY_MAX_TOKENS for chunk in chunks)

    table_chunks = [chunk for chunk in chunks if "| era |" in chunk.chunk_text]
    assert len(table_chunks) == 1
    assert "| A |" in table_chunks[0].chunk_text
    assert "| D |" in table_chunks[0].chunk_text
    assert "TABLE_END" in table_chunks[0].chunk_text


def test_fixed_window_chunker_uses_400_tokens_with_80_token_overlap() -> None:
    encoding = tiktoken.get_encoding("cl100k_base")
    chunks = chunk_markdown(
        SOURCE_PATH,
        FIXTURE_PATH.read_text(encoding="utf-8"),
        strategy="fixed",
    )

    assert len(chunks) >= 3
    assert all(chunk.heading is None for chunk in chunks)
    assert all(chunk.token_count == ALTERNATIVE_WINDOW_TOKENS for chunk in chunks[:-1])
    for left, right in pairwise(chunks):
        left_tokens = encoding.encode(left.chunk_text)
        right_tokens = encoding.encode(right.chunk_text)
        assert (
            left_tokens[-ALTERNATIVE_OVERLAP_TOKENS:] == right_tokens[:ALTERNATIVE_OVERLAP_TOKENS]
        )
