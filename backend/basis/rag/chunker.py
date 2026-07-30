"""Markdown chunking strategies approved for Ask Basis retrieval."""

from __future__ import annotations

import re
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Final, Literal

import tiktoken

PRIMARY_MIN_TOKENS: Final = 120
PRIMARY_MAX_TOKENS: Final = 450
ALTERNATIVE_WINDOW_TOKENS: Final = 400
ALTERNATIVE_OVERLAP_TOKENS: Final = 80
TOKEN_ENCODING: Final = "cl100k_base"
BREADCRUMB_SEPARATOR: Final = " \u203a "

ChunkingStrategy = Literal["heading", "fixed"]

_HEADING_RE = re.compile(r"^(#{1,3})\s+(.+?)\s*$")
_BLANK_BLOCK_RE = re.compile(r"\n[ \t]*\n+")


@dataclass(frozen=True)
class Chunk:
    """One indexable document chunk."""

    source_path: str
    heading: str | None
    chunk_text: str
    token_count: int

    @property
    def embedding_text(self) -> str:
        """Text sent to the embedding model, including heading context."""
        if self.heading:
            return f"{self.heading}\n\n{self.chunk_text}"
        return self.chunk_text


@dataclass(frozen=True)
class _Section:
    level: int
    heading_parts: tuple[str, ...]
    body: str

    @property
    def title(self) -> str:
        return self.heading_parts[-1]

    @property
    def parent(self) -> tuple[str, ...]:
        return self.heading_parts[:-1]


def chunk_markdown(
    source_path: str,
    markdown: str,
    *,
    strategy: ChunkingStrategy = "heading",
) -> list[Chunk]:
    """Chunk one Markdown document with an approved strategy."""
    if strategy == "fixed":
        return _fixed_window_chunks(source_path, markdown)
    if strategy != "heading":
        raise ValueError(f"unknown chunking strategy: {strategy}")
    return _heading_aware_chunks(source_path, markdown)


def count_tokens(text: str) -> int:
    """Count tokens using the embedding design's frozen encoding."""
    return len(_encoding().encode(text))


def _heading_aware_chunks(source_path: str, markdown: str) -> list[Chunk]:
    basename = Path(source_path).name
    sections = _merge_tiny_sections(_parse_sections(markdown))
    chunks: list[Chunk] = []
    for section in sections:
        breadcrumb = BREADCRUMB_SEPARATOR.join((basename, *section.heading_parts))
        chunks.extend(_split_section(source_path, breadcrumb, section.body))
    return chunks


def _parse_sections(markdown: str) -> list[_Section]:
    sections: list[_Section] = []
    hierarchy: list[str] = []
    current_level = 0
    current_parts: tuple[str, ...] = ()
    body_lines: list[str] = []
    in_fence = False

    def flush() -> None:
        body = "\n".join(body_lines).strip()
        if body:
            sections.append(
                _Section(
                    level=current_level,
                    heading_parts=current_parts,
                    body=body,
                )
            )

    for line in markdown.splitlines():
        if line.lstrip().startswith("```"):
            in_fence = not in_fence
        heading_match = None if in_fence else _HEADING_RE.match(line)
        if heading_match:
            flush()
            body_lines = []
            level = len(heading_match.group(1))
            title = heading_match.group(2).strip()
            hierarchy[level - 1 :] = [title]
            current_level = level
            current_parts = tuple(hierarchy)
            continue
        body_lines.append(line)
    flush()
    return sections


def _merge_tiny_sections(sections: list[_Section]) -> list[_Section]:
    merged = list(sections)
    index = 0
    while index < len(merged) - 1:
        current = merged[index]
        following = merged[index + 1]
        if (
            current.level == following.level
            and current.parent == following.parent
            and _section_token_count(current) < PRIMARY_MIN_TOKENS
        ):
            following_body = f"{current.title}\n\n{current.body}\n\n{following.body}"
            merged[index + 1] = replace(following, body=following_body)
            del merged[index]
            continue
        index += 1
    return merged


def _section_token_count(section: _Section) -> int:
    heading = BREADCRUMB_SEPARATOR.join(section.heading_parts)
    return count_tokens(f"{heading}\n\n{section.body}")


def _split_section(
    source_path: str,
    breadcrumb: str,
    body: str,
) -> list[Chunk]:
    if _embedded_token_count(breadcrumb, body) <= PRIMARY_MAX_TOKENS:
        return [_build_chunk(source_path, breadcrumb, body)]

    blocks = [block.strip() for block in _BLANK_BLOCK_RE.split(body) if block.strip()]
    pieces: list[list[str]] = []
    current: list[str] = []
    for block in blocks:
        candidate = "\n\n".join((*current, block))
        if (
            current
            and _embedded_token_count(breadcrumb, candidate) > PRIMARY_MAX_TOKENS
            and _embedded_token_count(breadcrumb, "\n\n".join(current)) >= PRIMARY_MIN_TOKENS
        ):
            pieces.append(current)
            current = [block]
        else:
            current.append(block)
    if current:
        pieces.append(current)

    if len(pieces) > 1:
        final_body = "\n\n".join(pieces[-1])
        if _embedded_token_count(breadcrumb, final_body) < PRIMARY_MIN_TOKENS:
            pieces[-2].extend(pieces[-1])
            pieces.pop()

    return [_build_chunk(source_path, breadcrumb, "\n\n".join(piece)) for piece in pieces]


def _build_chunk(source_path: str, heading: str, body: str) -> Chunk:
    body = body.strip()
    return Chunk(
        source_path=source_path,
        heading=heading,
        chunk_text=body,
        token_count=_embedded_token_count(heading, body),
    )


def _embedded_token_count(heading: str, body: str) -> int:
    return count_tokens(f"{heading}\n\n{body}")


def _fixed_window_chunks(source_path: str, markdown: str) -> list[Chunk]:
    token_ids = _encoding().encode(markdown)
    step = ALTERNATIVE_WINDOW_TOKENS - ALTERNATIVE_OVERLAP_TOKENS
    chunks: list[Chunk] = []
    for start in range(0, len(token_ids), step):
        window = token_ids[start : start + ALTERNATIVE_WINDOW_TOKENS]
        if not window:
            break
        text = _encoding().decode(window)
        chunks.append(
            Chunk(
                source_path=source_path,
                heading=None,
                chunk_text=text,
                token_count=len(window),
            )
        )
        if start + ALTERNATIVE_WINDOW_TOKENS >= len(token_ids):
            break
    return chunks


def _encoding() -> tiktoken.Encoding:
    return tiktoken.get_encoding(TOKEN_ENCODING)
