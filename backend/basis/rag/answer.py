"""Grounded Ask Basis retrieval, tool, and model orchestration."""

from __future__ import annotations

import time
from collections.abc import Sequence
from dataclasses import asdict, dataclass
from typing import Any, Final, Protocol

from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession

from basis.rag.context import (
    AssembledContext,
    HistoryExchange,
    ToolContextResult,
    assemble,
)
from basis.rag.indexer import Embedder
from basis.rag.retrieve import RetrievalResult, retrieve
from basis.rag.tools import TOOL_DEFINITIONS, TOOL_NAMES, ToolExecutor
from basis.rag.tracing import AskTracer

OPENROUTER_BASE_URL: Final = "https://openrouter.ai/api/v1"
MAX_OUTPUT_TOKENS: Final = 1_200
MAX_TOOL_CALLS: Final = 3
TOOL_LIMIT_NOTE: Final = (
    "Tool-call limit reached after 3 calls; this answer uses the results already returned."
)


@dataclass(frozen=True)
class RequestedToolCall:
    call_id: str
    name: str


@dataclass(frozen=True)
class ModelUsage:
    input_tokens: int = 0
    output_tokens: int = 0

    def __add__(self, other: ModelUsage) -> ModelUsage:
        return ModelUsage(
            input_tokens=self.input_tokens + other.input_tokens,
            output_tokens=self.output_tokens + other.output_tokens,
        )


@dataclass(frozen=True)
class ModelReply:
    content: str
    tool_calls: tuple[RequestedToolCall, ...]
    usage: ModelUsage


class ChatModel(Protocol):
    async def complete(
        self,
        *,
        context: AssembledContext,
        allow_tools: bool,
    ) -> ModelReply:
        """Return one answer or tool-request turn."""
        ...


class OpenRouterChatModel:
    """OpenRouter adapter using its documented OpenAI-compatible endpoint."""

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        client: Any | None = None,
    ) -> None:
        self.model = model
        self._client = client or AsyncOpenAI(
            api_key=api_key,
            base_url=OPENROUTER_BASE_URL,
            default_headers={
                "HTTP-Referer": "https://gpu-basis.xyz",
                "X-OpenRouter-Title": "Ask Basis",
            },
        )

    async def complete(
        self,
        *,
        context: AssembledContext,
        allow_tools: bool,
    ) -> ModelReply:
        kwargs: dict[str, Any] = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": context.system_prompt},
                {"role": "user", "content": context.user_content},
            ],
            "max_tokens": MAX_OUTPUT_TOKENS,
            "temperature": 0,
        }
        if allow_tools:
            kwargs["tools"] = TOOL_DEFINITIONS
            kwargs["tool_choice"] = "auto"
            kwargs["parallel_tool_calls"] = True
        response = await self._client.chat.completions.create(**kwargs)
        message = response.choices[0].message
        tool_calls = tuple(
            RequestedToolCall(call_id=call.id, name=call.function.name)
            for call in (message.tool_calls or ())
        )
        usage = response.usage
        return ModelReply(
            content=message.content or "",
            tool_calls=tool_calls,
            usage=ModelUsage(
                input_tokens=int(usage.prompt_tokens) if usage else 0,
                output_tokens=int(usage.completion_tokens) if usage else 0,
            ),
        )


@dataclass(frozen=True)
class AnswerResult:
    answer: str
    retrieval: RetrievalResult
    context: AssembledContext
    tool_results: tuple[ToolContextResult, ...]
    usage: ModelUsage
    trace_id: str
    trace_url: str | None
    tool_limit_reached: bool


class AnswerService:
    """Coordinate retrieval, bounded tools, reassembly, and final answering."""

    def __init__(
        self,
        *,
        model: ChatModel,
        embedder: Embedder,
        tool_executor: ToolExecutor,
        tracer: AskTracer | None = None,
        model_name: str = "configured-model",
    ) -> None:
        self._model = model
        self._embedder = embedder
        self._tool_executor = tool_executor
        self._tracer = tracer or AskTracer()
        self._model_name = model_name

    async def answer(
        self,
        *,
        question: str,
        history: Sequence[HistoryExchange | dict[str, str]],
        session: AsyncSession,
    ) -> AnswerResult:
        """Produce one grounded response and all server-resolved source inputs."""
        completed: AnswerResult
        with self._tracer.trace(question) as trace:
            with trace.span(
                "retrieval",
                as_type="retriever",
                input={"query": question},
            ) as observation:
                embedding = await self._embedder.embed([question])
                retrieval = await retrieve(
                    session,
                    question=question,
                    query_embedding=embedding.vectors[0],
                )
                observation.update(
                    output={
                        "top": [
                            {"id": chunk.id, "score": chunk.rrf_score}
                            for chunk in retrieval.chunks
                        ],
                        "below_floor": retrieval.below_floor,
                    }
                )

            tool_results: list[ToolContextResult] = []
            usage = ModelUsage()
            tool_limit_reached = False
            force_final = False
            final_context = assemble(question, retrieval.chunks, tool_results, history)
            answer = ""

            while True:
                final_context = assemble(question, retrieval.chunks, tool_results, history)
                with trace.span("assembly", input=asdict(final_context.section_tokens)) as span:
                    span.update(output={"evictions": [asdict(x) for x in final_context.evictions]})

                allow_tools = not force_final and len(tool_results) < MAX_TOOL_CALLS
                started = time.perf_counter()
                with trace.span(
                    "model-call",
                    as_type="generation",
                    input={"allow_tools": allow_tools},
                    model=self._model_name,
                ) as model_span:
                    reply = await self._model.complete(
                        context=final_context,
                        allow_tools=allow_tools,
                    )
                    latency_ms = round((time.perf_counter() - started) * 1_000, 1)
                    model_span.update(
                        output={"content": reply.content, "tool_calls": [x.name for x in reply.tool_calls]},
                        metadata={"latency_ms": latency_ms},
                        usage_details={
                            "input": reply.usage.input_tokens,
                            "output": reply.usage.output_tokens,
                        },
                    )
                usage += reply.usage

                if not reply.tool_calls or not allow_tools:
                    answer = reply.content.strip()
                    break

                executed_this_round = 0
                for request in reply.tool_calls:
                    if len(tool_results) >= MAX_TOOL_CALLS:
                        tool_limit_reached = True
                        break
                    if request.name not in TOOL_NAMES:
                        continue
                    result_id = len(tool_results) + 1
                    with trace.span(
                        request.name,
                        as_type="tool",
                        input={"tool_call_id": request.call_id},
                    ) as tool_span:
                        result = await self._tool_executor.execute(
                            request.name,
                            result_id=result_id,
                            session=session,
                        )
                        tool_span.update(
                            output={"as_of": result.as_of, "rows": len(result.rows)}
                        )
                    tool_results.append(result)
                    executed_this_round += 1
                if len(reply.tool_calls) > executed_this_round:
                    tool_limit_reached = len(tool_results) >= MAX_TOOL_CALLS
                if executed_this_round == 0 or len(tool_results) >= MAX_TOOL_CALLS:
                    tool_limit_reached = len(tool_results) >= MAX_TOOL_CALLS
                    force_final = True

            if not answer:
                answer = "That's not covered in my sources."
            if tool_limit_reached and TOOL_LIMIT_NOTE not in answer:
                answer = f"{answer} {TOOL_LIMIT_NOTE}"
            final_context = assemble(question, retrieval.chunks, tool_results, history)
            completed = AnswerResult(
                answer=answer,
                retrieval=retrieval,
                context=final_context,
                tool_results=tuple(tool_results),
                usage=usage,
                trace_id=trace.trace_id,
                trace_url=trace.trace_url,
                tool_limit_reached=tool_limit_reached,
            )
        self._tracer.flush()
        return completed
