"""Stateless JSON and SSE endpoint for Ask Basis."""

from __future__ import annotations

import logging
import re
from collections.abc import AsyncIterator
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from openai import OpenAIError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from basis.api.deps import get_db
from basis.config import settings
from basis.db.models import RawObservation
from basis.rag.answer import AnswerResult, AnswerService, OpenRouterChatModel
from basis.rag.context import QuestionTooLongError, validate_question
from basis.rag.controls import (
    DailyCapacityReachedError,
    InProcessRateLimiter,
    RateLimitExceededError,
    consume_daily_capacity,
)
from basis.rag.indexer import Embedder, FixtureEmbedder, OpenAIEmbedder
from basis.rag.tools import ToolExecutor
from basis.rag.tracing import AskTracer
from basis.schemas.api import (
    AskCitation,
    AskRequest,
    AskResponse,
    AskToolCall,
    AskUsage,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["ask"])
_rate_limiter = InProcessRateLimiter()
_MARKER_RE = re.compile(r"\[(C|T)(\d+)\]")
# Exclude newlines from token events so each event remains valid SSE framing.
_STREAM_TOKEN_RE = re.compile(r"\S+[^\S\r\n]*")


@router.post("/ask", response_model=AskResponse)  # type: ignore[untyped-decorator]
async def ask_basis(
    payload: AskRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> AskResponse | StreamingResponse:
    """Answer one stateless, client-history-carrying question."""
    if settings.ask_basis_disabled:
        raise HTTPException(status_code=503, detail="Ask Basis is disabled")
    if not settings.openrouter_api_key:
        raise HTTPException(status_code=503, detail="Ask Basis is not configured")
    fixture_embeddings_enabled = bool(
        settings.ask_eval_mode and settings.ask_eval_query_embeddings_path
    )
    if not settings.openai_api_key and not fixture_embeddings_enabled:
        raise HTTPException(status_code=503, detail="Ask Basis embeddings are not configured")

    try:
        question = validate_question(payload.question)
    except (QuestionTooLongError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        _rate_limiter.check(_client_ip(request))
    except RateLimitExceededError as exc:
        raise HTTPException(
            status_code=429,
            detail="Too many Ask Basis questions; try again later",
            headers={"Retry-After": str(exc.retry_after)},
        ) from exc

    try:
        await consume_daily_capacity(db)
    except DailyCapacityReachedError as exc:
        raise HTTPException(status_code=429, detail="daily capacity reached") from exc

    model_override = (
        request.headers.get("x-ask-basis-eval-model")
        if settings.ask_eval_mode
        else None
    )
    service = (
        _get_answer_service(model=model_override)
        if model_override is not None
        else _get_answer_service()
    )
    try:
        result = await service.answer(
            question=question,
            history=[entry.model_dump() for entry in payload.history],
            session=db,
        )
    except OpenAIError as exc:
        logger.warning("Ask Basis model provider failed: %s", exc)
        raise HTTPException(status_code=502, detail="Ask Basis model provider unavailable") from exc

    response = _build_response(result)
    if result.trace_url:
        logger.info("Ask Basis trace: %s", result.trace_url)
    if "application/json" in request.headers.get("accept", ""):
        return response
    return StreamingResponse(
        _stream_response(response),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/ask/eval-sentinel")  # type: ignore[untyped-decorator]
async def eval_database_sentinel(db: AsyncSession = Depends(get_db)) -> dict[str, str | None]:
    """Expose one freshness value only when the local/CI eval harness is enabled."""
    if not settings.ask_eval_mode:
        raise HTTPException(status_code=404, detail="not found")
    maximum = await db.scalar(select(func.max(RawObservation.collected_at)))
    return {"max_collected_at": maximum.isoformat() if maximum is not None else None}


def _get_answer_service(*, model: str | None = None) -> AnswerService:
    selected_model = model or settings.openrouter_model
    tracer = AskTracer(
        public_key=settings.langfuse_public_key,
        secret_key=settings.langfuse_secret_key,
        base_url=settings.langfuse_base_url,
        environment=settings.environment,
    )
    if settings.ask_eval_mode and settings.ask_eval_query_embeddings_path:
        # Amendment B: CI query vectors are committed fixtures, so no OpenAI key is needed.
        embedder: Embedder = FixtureEmbedder(
            Path(settings.ask_eval_query_embeddings_path)
        )
    else:
        embedder = OpenAIEmbedder(api_key=settings.openai_api_key)
    return AnswerService(
        model=OpenRouterChatModel(
            api_key=settings.openrouter_api_key,
            model=selected_model,
        ),
        embedder=embedder,
        tool_executor=ToolExecutor(),
        tracer=tracer,
        model_name=selected_model,
    )


def _build_response(result: AnswerResult) -> AskResponse:
    chunks_by_marker = {chunk.marker: chunk for chunk in result.context.chunks}
    tools_by_marker = {f"T{tool.id}": tool for tool in result.tool_results}
    citations: list[AskCitation] = []
    seen: set[tuple[str, int]] = set()
    for kind, raw_id in _MARKER_RE.findall(result.answer):
        marker = f"{kind}{raw_id}"
        numeric_id = int(raw_id)
        identity = (kind, numeric_id)
        if identity in seen:
            continue
        if kind == "C" and marker in chunks_by_marker:
            chunk = chunks_by_marker[marker]
            citations.append(
                AskCitation(
                    id=numeric_id,
                    kind="chunk",
                    source_path=chunk.source_path,
                    heading=chunk.heading,
                )
            )
        elif kind == "T" and marker in tools_by_marker:
            tool = tools_by_marker[marker]
            citations.append(
                AskCitation(
                    id=numeric_id,
                    kind="tool",
                    tool=tool.tool,
                    as_of=tool.as_of,
                )
            )
        else:
            continue
        seen.add(identity)
    return AskResponse(
        answer=result.answer,
        citations=citations,
        tool_calls=[
            AskToolCall(id=tool.id, tool=tool.tool, as_of=tool.as_of)
            for tool in result.tool_results
        ],
        usage=AskUsage(
            input_tokens=result.usage.input_tokens,
            output_tokens=result.usage.output_tokens,
        ),
        trace_id=result.trace_id,
    )


async def _stream_response(response: AskResponse) -> AsyncIterator[str]:
    # The upstream answer is already complete; this replays it as SSE token events
    # for transport compatibility rather than streaming the model generation live.
    for match in _STREAM_TOKEN_RE.finditer(response.answer):
        yield f"data: {match.group(0)}\n\n"
    yield f"event: done\ndata: {response.model_dump_json()}\n\n"


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return str(forwarded).split(",", maxsplit=1)[0].strip()
    return str(request.client.host) if request.client else "unknown"


def _clear_rate_limits() -> None:
    """Reset the in-process limiter for deterministic endpoint tests."""
    _rate_limiter.clear()
