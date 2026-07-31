"""Behavioral tests for Ask Basis model/tool orchestration."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from basis.rag.answer import (
    MAX_OUTPUT_TOKENS,
    AnswerService,
    ModelReply,
    ModelUsage,
    OpenRouterChatModel,
    RequestedToolCall,
)
from basis.rag.context import assemble
from basis.rag.indexer import EmbeddingBatch
from basis.rag.tools import ToolExecutor


class FakeEmbedder:
    async def embed(self, texts: list[str]) -> EmbeddingBatch:
        assert len(texts) == 1
        return EmbeddingBatch(vectors=[[0.01] * 1536], input_tokens=4)


class FourToolModel:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    async def complete(self, **kwargs: Any) -> ModelReply:
        self.calls.append(kwargs)
        if len(self.calls) == 1:
            return ModelReply(
                content="",
                tool_calls=tuple(
                    RequestedToolCall(call_id=f"call-{index}", name=name)
                    for index, name in enumerate(
                        (
                            "get_latest_basis",
                            "get_dispersion_summary",
                            "get_provider_summary",
                            "get_ml_explainability",
                        ),
                        start=1,
                    )
                ),
                usage=ModelUsage(input_tokens=500, output_tokens=20),
            )
        return ModelReply(
            content="The available live summaries are included [T1].",
            tool_calls=(),
            usage=ModelUsage(input_tokens=600, output_tokens=30),
        )


@pytest.mark.asyncio
async def test_four_requested_tools_execute_only_three_and_answer_notes_stop(
    db_session: AsyncSession,
) -> None:
    model = FourToolModel()
    service = AnswerService(
        model=model,
        embedder=FakeEmbedder(),
        tool_executor=ToolExecutor(ml_loader=lambda: pytest.fail("fourth tool executed")),
    )

    result = await service.answer(
        question="Give me every current summary.",
        history=(),
        session=db_session,
    )

    assert [tool.tool for tool in result.tool_results] == [
        "get_latest_basis",
        "get_dispersion_summary",
        "get_provider_summary",
    ]
    assert len(model.calls) == 2
    assert model.calls[1]["allow_tools"] is False
    assert "Tool-call limit reached after 3 calls" in result.answer
    assert result.usage == ModelUsage(input_tokens=1_100, output_tokens=50)


@pytest.mark.asyncio
async def test_openrouter_adapter_enforces_output_ceiling() -> None:
    class Completions:
        def __init__(self) -> None:
            self.kwargs: dict[str, Any] = {}

        async def create(self, **kwargs: Any) -> Any:
            self.kwargs = kwargs
            return SimpleNamespace(
                choices=[
                    SimpleNamespace(
                        message=SimpleNamespace(content="Grounded answer.", tool_calls=None)
                    )
                ],
                usage=SimpleNamespace(prompt_tokens=100, completion_tokens=20),
            )

    completions = Completions()
    client = SimpleNamespace(chat=SimpleNamespace(completions=completions))
    model = OpenRouterChatModel(
        api_key="test",
        model="deepseek/deepseek-chat",
        client=client,
    )

    reply = await model.complete(
        context=assemble("What is Basis?", (), (), ()),
        allow_tools=False,
    )

    assert completions.kwargs["max_tokens"] == MAX_OUTPUT_TOKENS == 1_200
    assert "tools" not in completions.kwargs
    assert reply.content == "Grounded answer."
