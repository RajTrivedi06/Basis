"""Public-contract tests for POST /api/ask."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from basis.api.routes import ask as ask_route
from basis.config import settings
from basis.db.models import AskDailyUsage
from basis.rag import answer as answer_module
from basis.rag.answer import AnswerResult, AnswerService, ModelReply, ModelUsage
from basis.rag.context import ToolContextResult, assemble
from basis.rag.indexer import EmbeddingBatch
from basis.rag.retrieve import RetrievalResult, RetrievedChunk
from basis.rag.tools import ToolExecutor
from basis.rag.tracing import AskTracer


class StubAnswerService:
    def __init__(self, answer: str = "Document fact [C1]; live fact [T1].") -> None:
        self.answer_text = answer
        self.context = None
        self.calls = 0

    async def answer(
        self,
        *,
        question: str,
        history: list[dict[str, str]],
        session: AsyncSession,
    ) -> AnswerResult:
        self.calls += 1
        chunk = RetrievedChunk(
            id=41,
            source_path="docs/findings.md",
            heading="Main finding",
            chunk_text="Basis measures residual GPU price variance.",
            token_count=8,
            rrf_score=0.03,
            vector_rank=1,
            fts_rank=1,
            cosine_similarity=0.8,
            fts_score=0.5,
        )
        retrieval = RetrievalResult(
            chunks=(chunk,),
            below_floor=False,
            best_vector_similarity=0.8,
            vector_candidate_count=1,
            fts_candidate_count=1,
        )
        tool = ToolContextResult(
            id=1,
            tool="get_latest_basis",
            as_of="2026-07-31",
            columns=("metric", "value"),
            rows=(("residual", "60.0%"),),
        )
        self.context = assemble(question, retrieval.chunks, (tool,), history)
        return AnswerResult(
            answer=self.answer_text,
            retrieval=retrieval,
            context=self.context,
            tool_results=(tool,),
            usage=ModelUsage(input_tokens=321, output_tokens=45),
            trace_id="0123456789abcdef0123456789abcdef",
            trace_url=None,
            tool_limit_reached=False,
        )


class FinalAnswerModel:
    async def complete(self, **_kwargs: object) -> ModelReply:
        return ModelReply(
            content="The answer still succeeds.",
            tool_calls=(),
            usage=ModelUsage(input_tokens=10, output_tokens=5),
        )


class FakeEmbedder:
    async def embed(self, texts: list[str]) -> EmbeddingBatch:
        assert texts == ["Does tracing affect answers?"]
        return EmbeddingBatch(vectors=[[0.01] * 1536], input_tokens=4)


class RaisingLangfuseClient:
    def start_as_current_observation(self, **_kwargs: object) -> object:
        raise RuntimeError("401 Unauthorized")


@pytest.fixture(autouse=True)
async def clean_ask_controls(db_session: AsyncSession) -> None:
    today = datetime.now(UTC).date()
    ask_route._clear_rate_limits()
    await db_session.execute(delete(AskDailyUsage).where(AskDailyUsage.day == today))
    await db_session.commit()
    yield
    ask_route._clear_rate_limits()
    await db_session.execute(delete(AskDailyUsage).where(AskDailyUsage.day == today))
    await db_session.commit()


@pytest.fixture
def configured_ask(
    monkeypatch: pytest.MonkeyPatch,
) -> StubAnswerService:
    service = StubAnswerService()
    monkeypatch.setattr(settings, "ask_basis_disabled", False)
    monkeypatch.setattr(settings, "openrouter_api_key", "test-openrouter")
    monkeypatch.setattr(settings, "openai_api_key", "test-openai")
    monkeypatch.setattr(ask_route, "_get_answer_service", lambda: service)
    return service


@pytest.mark.asyncio
async def test_ask_returns_503_when_openrouter_is_not_configured(
    api_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ask_basis_disabled", False)
    monkeypatch.setattr(settings, "openrouter_api_key", "")

    response = await api_client.post(
        "/api/ask",
        headers={"Accept": "application/json"},
        json={"question": "What does Basis measure?"},
    )

    assert response.status_code == 503
    assert response.json() == {"detail": "Ask Basis is not configured"}


@pytest.mark.asyncio
async def test_kill_switch_returns_503_before_capacity_or_service_work(
    api_client: AsyncClient,
    db_session: AsyncSession,
    configured_ask: StubAnswerService,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ask_basis_disabled", True)

    response = await api_client.post(
        "/api/ask",
        headers={"Accept": "application/json"},
        json={"question": "What does Basis measure?"},
    )

    assert response.status_code == 503
    assert response.json() == {"detail": "Ask Basis is disabled"}
    assert configured_ask.calls == 0
    assert (
        await db_session.execute(
            select(AskDailyUsage).where(AskDailyUsage.day == datetime.now(UTC).date())
        )
    ).scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_eleventh_request_returns_429_and_retry_after(
    api_client: AsyncClient,
    configured_ask: StubAnswerService,
) -> None:
    headers = {
        "Accept": "application/json",
        "X-Forwarded-For": "203.0.113.10",
    }
    for index in range(10):
        response = await api_client.post(
            "/api/ask",
            headers=headers,
            json={"question": f"Question {index}?"},
        )
        assert response.status_code == 200

    rejected = await api_client.post(
        "/api/ask",
        headers=headers,
        json={"question": "Question 11?"},
    )

    assert rejected.status_code == 429
    assert rejected.headers["retry-after"]
    assert configured_ask.calls == 10


@pytest.mark.asyncio
async def test_daily_capacity_returns_429(
    api_client: AsyncClient,
    db_session: AsyncSession,
    configured_ask: StubAnswerService,
) -> None:
    db_session.add(
        AskDailyUsage(day=datetime.now(UTC).date(), question_count=200)
    )
    await db_session.commit()

    response = await api_client.post(
        "/api/ask",
        headers={"Accept": "application/json", "X-Forwarded-For": "203.0.113.11"},
        json={"question": "What does Basis measure?"},
    )

    assert response.status_code == 429
    assert response.json() == {"detail": "daily capacity reached"}
    assert configured_ask.calls == 0


@pytest.mark.asyncio
async def test_history_is_restripped_and_recapped_server_side(
    api_client: AsyncClient,
    configured_ask: StubAnswerService,
) -> None:
    history = [
        {
            "q": f"Question {index}",
            "a": f"First sentence {index}. " + ("untrusted " * 300) + f"[C{index}]",
        }
        for index in range(1, 6)
    ]

    response = await api_client.post(
        "/api/ask",
        headers={"Accept": "application/json", "X-Forwarded-For": "203.0.113.12"},
        json={"question": "Follow up?", "history": history},
    )

    assert response.status_code == 200
    assert configured_ask.context is not None
    assert [item.q for item in configured_ask.context.history] == [
        "Question 4",
        "Question 5",
    ]
    assert [item.a for item in configured_ask.context.history] == [
        "First sentence 4. [C4]",
        "First sentence 5. [C5]",
    ]


@pytest.mark.asyncio
async def test_json_response_resolves_chunk_and_tool_citations(
    api_client: AsyncClient,
    configured_ask: StubAnswerService,
) -> None:
    response = await api_client.post(
        "/api/ask",
        headers={"Accept": "application/json", "X-Forwarded-For": "203.0.113.13"},
        json={"question": "Give me a sourced summary."},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["citations"] == [
        {
            "id": 1,
            "kind": "chunk",
            "source_path": "docs/findings.md",
            "heading": "Main finding",
            "tool": None,
            "as_of": None,
        },
        {
            "id": 1,
            "kind": "tool",
            "source_path": None,
            "heading": None,
            "tool": "get_latest_basis",
            "as_of": "2026-07-31",
        },
    ]
    assert body["usage"] == {"input_tokens": 321, "output_tokens": 45}


@pytest.mark.asyncio
async def test_tracer_failure_warns_and_request_still_returns_answer(
    api_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    async def empty_retrieval(*_args: object, **_kwargs: object) -> RetrievalResult:
        return RetrievalResult(
            chunks=(),
            below_floor=True,
            best_vector_similarity=None,
            vector_candidate_count=0,
            fts_candidate_count=0,
        )

    tracer = AskTracer()
    monkeypatch.setattr(tracer, "_client", RaisingLangfuseClient())
    service = AnswerService(
        model=FinalAnswerModel(),
        embedder=FakeEmbedder(),
        tool_executor=ToolExecutor(),
        tracer=tracer,
    )
    monkeypatch.setattr(settings, "ask_basis_disabled", False)
    monkeypatch.setattr(settings, "openrouter_api_key", "test-openrouter")
    monkeypatch.setattr(settings, "openai_api_key", "test-openai")
    monkeypatch.setattr(answer_module, "retrieve", empty_retrieval)
    monkeypatch.setattr(ask_route, "_get_answer_service", lambda: service)

    with caplog.at_level("WARNING", logger="basis.rag.tracing"):
        response = await api_client.post(
            "/api/ask",
            headers={
                "Accept": "application/json",
                "X-Forwarded-For": "203.0.113.16",
            },
            json={"question": "Does tracing affect answers?"},
        )

    assert response.status_code == 200
    assert response.json()["answer"] == "The answer still succeeds."
    assert "401 Unauthorized" in caplog.text


@pytest.mark.asyncio
async def test_sse_stream_emits_token_events_and_final_envelope(
    api_client: AsyncClient,
    configured_ask: StubAnswerService,
) -> None:
    configured_ask.answer_text = "First paragraph.\n\nSecond paragraph."
    response = await api_client.post(
        "/api/ask",
        headers={"Accept": "text/event-stream", "X-Forwarded-For": "203.0.113.14"},
        json={"question": "Stream a sourced summary."},
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert response.text.startswith("data:")
    assert "\nevent: done\n" in response.text
    assert '"trace_id":"0123456789abcdef0123456789abcdef"' in response.text
    assert all(
        line.startswith(("data:", "event:")) or not line
        for line in response.text.splitlines()
    )


@pytest.mark.asyncio
async def test_over_budget_question_returns_400_before_service(
    api_client: AsyncClient,
    configured_ask: StubAnswerService,
) -> None:
    response = await api_client.post(
        "/api/ask",
        headers={"Accept": "application/json", "X-Forwarded-For": "203.0.113.15"},
        json={"question": " ".join(["basis"] * 201)},
    )

    assert response.status_code == 400
    assert configured_ask.calls == 0
