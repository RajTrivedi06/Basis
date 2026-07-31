"""Integration tests for compact internal Ask Basis tools."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from basis.rag.context import assemble
from basis.rag.tools import TOOL_NAMES, ToolExecutor, UnknownToolError

ARTIFACT_FIXTURE = Path(__file__).parents[1] / "fixtures" / "explainability_artifact.json"


@pytest.mark.asyncio
async def test_whitelisted_tools_return_bounded_dated_tables(
    db_session: AsyncSession,
) -> None:
    artifact = json.loads(ARTIFACT_FIXTURE.read_text(encoding="utf-8"))
    executor = ToolExecutor(ml_loader=lambda: artifact)

    results = [
        await executor.execute(name, result_id=index, session=db_session)
        for index, name in enumerate(TOOL_NAMES, start=1)
    ]

    for result in results:
        assembled = assemble("Summarize the current study.", (), (result,), ())
        assert result.as_of
        assert result.rows
        assert assembled.section_tokens.tool_results <= 400

    with pytest.raises(UnknownToolError):
        await executor.execute("fetch_url", result_id=5, session=db_session)
