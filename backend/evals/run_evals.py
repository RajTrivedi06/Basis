"""Run the Ask Basis golden set against one local API and one database.

Owner deviation (Raj, 2026-08-01): paid evals run weekly, by manual dispatch,
or when a PR receives the ``run-evals`` label. They do not run nightly.
"""

from __future__ import annotations

import argparse
import asyncio
import datetime
import json
import math
import statistics
import subprocess
import sys
import time
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Final, Literal, cast
from urllib.parse import urlparse

import httpx
import yaml
from openai import AsyncOpenAI
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from basis.config import settings  # noqa: E402
from basis.rag.answer import OPENROUTER_BASE_URL  # noqa: E402
from evals.fixtures import EvalChunker, replace_doc_chunks_from_fixture  # noqa: E402
from evals.scoring import (  # noqa: E402
    CitationCheck,
    ScoreResult,
    judge_result,
    regression_reasons,
    score_citations,
    score_tier_a,
    score_tier_c,
    skipped_result,
    weighted_overall,
)

Tier = Literal["a", "b", "c", "all"]
JUDGE_MODEL: Final = "anthropic/claude-haiku-4.5"
EVAL_MODEL_HEADER: Final = "x-ask-basis-eval-model"
QUESTION_TIME_BUDGET_SECONDS: Final = 120
COLLECTION_WINDOWS_UTC: Final = (
    (datetime.time(7, 55), datetime.time(8, 15)),
    (datetime.time(19, 55), datetime.time(20, 15)),
)

REPO_ROOT = BACKEND_DIR.parent
QUESTIONS_PATH = Path(__file__).resolve().parent / "questions.yaml"
BASELINE_PATH = Path(__file__).resolve().parent / "baseline.json"
RESULTS_DIR = Path(__file__).resolve().parent / "results"
CHUNK_FIXTURES: Final = {
    "primary": BACKEND_DIR / "tests" / "fixtures" / "rag_chunks_fixture.json.gz",
    "alternative": (
        BACKEND_DIR / "tests" / "fixtures" / "rag_chunks_fixture_alternative.json.gz"
    ),
}


class EvalAbortError(RuntimeError):
    """A clear, non-regression failure that makes the run invalid."""


@dataclass(frozen=True)
class ModelPricing:
    """OpenRouter per-token prices for scorecard cost estimates."""

    prompt: float
    completion: float


class ClaudeJudge:
    """Independent Anthropic-family judge served through OpenRouter."""

    def __init__(self, api_key: str, client: Any | None = None) -> None:
        self._client = client or AsyncOpenAI(
            api_key=api_key,
            base_url=OPENROUTER_BASE_URL,
            default_headers={
                "HTTP-Referer": "https://gpu-basis.xyz",
                "X-OpenRouter-Title": "Ask Basis Evals",
            },
        )

    async def score(self, *, question: str, answer: str, rubric: str) -> tuple[str, str]:
        """Return one structured pass/partial/fail verdict at temperature zero."""
        response = await self._client.chat.completions.create(
            model=JUDGE_MODEL,
            temperature=0,
            max_tokens=300,
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "ask_basis_eval_verdict",
                    "strict": True,
                    "schema": {
                        "type": "object",
                        "properties": {
                            "verdict": {
                                "type": "string",
                                "enum": ["pass", "partial", "fail"],
                            },
                            "reason": {"type": "string"},
                        },
                        "required": ["verdict", "reason"],
                        "additionalProperties": False,
                    },
                },
            },
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an independent deterministic evaluator. Apply only the "
                        "provided rubric. Return the requested JSON and no extra prose."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"QUESTION:\n{question}\n\nANSWER:\n{answer}\n\nRUBRIC:\n{rubric}"
                    ),
                },
            ],
        )
        content = response.choices[0].message.content or ""
        try:
            payload = json.loads(content)
        except json.JSONDecodeError as exc:
            raise EvalAbortError(f"judge returned invalid JSON: {content[:200]!r}") from exc
        return str(payload["verdict"]), str(payload["reason"])


def build_parser() -> argparse.ArgumentParser:
    """Build the documented eval CLI."""
    parser = argparse.ArgumentParser(description="Run the Ask Basis golden-set evals.")
    parser.add_argument("--model", default=settings.openrouter_model)
    parser.add_argument("--tier", choices=("a", "b", "c", "all"), default="all")
    parser.add_argument(
        "--chunker",
        choices=("primary", "alternative"),
        default="primary",
    )
    parser.add_argument("--out", type=Path, default=None)
    parser.add_argument("--api-url", default="http://127.0.0.1:8000")
    parser.add_argument("--database-url", default=settings.database_url)
    parser.add_argument("--baseline", type=Path, default=BASELINE_PATH)
    parser.add_argument("--questions", type=Path, default=QUESTIONS_PATH)
    return parser


async def run(args: argparse.Namespace) -> tuple[dict[str, Any], list[str]]:
    """Execute one complete scorecard and return any regression reasons."""
    _require_loopback_api(args.api_url)
    started_at = _utc_now()
    question_set = _load_question_set(args.questions, cast(Tier, args.tier))
    _assert_projected_timing(started_at, len(question_set))
    engine = create_async_engine(args.database_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    api_headers = {"Accept": "application/json", EVAL_MODEL_HEADER: args.model}
    judge = ClaudeJudge(settings.openrouter_api_key) if settings.openrouter_api_key else None
    if judge is None and any(question["tier"] == "b" for question in question_set):
        print(f"NOTICE: tier b SKIPPED; OPENROUTER_API_KEY is missing for {JUDGE_MODEL}.")

    try:
        async with session_factory() as session, httpx.AsyncClient(
            base_url=args.api_url.rstrip("/"), timeout=httpx.Timeout(180.0)
        ) as client:
            fixture = await replace_doc_chunks_from_fixture(
                session,
                fixture_path=CHUNK_FIXTURES[args.chunker],
                expected_chunker=cast(EvalChunker, args.chunker),
            )
            print(
                f"Loaded {fixture.strategy} chunk fixture: chunks={fixture.chunk_count}"
            )
            sentinel = await assert_same_database(session, client)
            print(f"Database invariant OK: max_collected_at={sentinel}")
            pricing = await _fetch_model_pricing(args.model)
            records: list[dict[str, Any]] = []
            for index, question in enumerate(question_set, start=1):
                remaining = len(question_set) - index + 1
                _assert_projected_timing(_utc_now(), remaining)
                record = await _run_question(
                    question,
                    question_index=index,
                    client=client,
                    session=session,
                    headers=api_headers,
                    anchors=_load_yaml(args.questions)["anchors"],
                    defaults=_load_yaml(args.questions)["defaults"],
                    judge=judge,
                    pricing=pricing,
                )
                records.append(record)
                print(
                    f"{question['id']}: {record['verdict'].upper()} "
                    f"citations={'PASS' if record['citations_ok'] else 'FAIL'} "
                    f"latency_ms={record['latency_ms']:.1f}"
                )
    finally:
        await engine.dispose()

    finished_at = _utc_now()
    scorecard = _build_scorecard(
        records=records,
        model=args.model,
        chunker=args.chunker,
        started_at=started_at,
        finished_at=finished_at,
    )
    regression = _load_regression_reasons(scorecard, args.baseline, args.tier)
    scorecard["regression"] = {
        "baseline": str(args.baseline) if args.baseline.exists() else None,
        "passed": not regression,
        "reasons": regression,
    }
    return scorecard, regression


async def _run_question(
    question: Mapping[str, Any],
    *,
    question_index: int,
    client: httpx.AsyncClient,
    session: AsyncSession,
    headers: Mapping[str, str],
    anchors: Mapping[str, Any],
    defaults: Mapping[str, Any],
    judge: ClaudeJudge | None,
    pricing: ModelPricing | None,
) -> dict[str, Any]:
    """Capture the answer and its verification inside one guarded iteration."""
    started = _utc_now()
    citation_check = CitationCheck(True, "not evaluated", 0, 0)
    if question["tier"] == "b" and judge is None:
        result = skipped_result(
            expected=question["rubric"],
            got=None,
            reason=f"{JUDGE_MODEL} skipped because OPENROUTER_API_KEY is missing",
            citations_ok=False,
        )
        return _question_record(
            question,
            result=result,
            citation_check=citation_check,
            answer=None,
            response=None,
            latency_ms=0.0,
            cost_usd=None,
        )

    request_headers = dict(headers)
    # Each eval question gets a deterministic documentation-range IP so the public
    # 10/hour control remains enabled without blocking the internal 37-question run.
    request_headers["X-Forwarded-For"] = f"192.0.2.{question_index}"
    request_started = time.perf_counter()
    response = await client.post(
        "/api/ask",
        headers=request_headers,
        json={
            "question": question["question"],
            "history": question.get("history", []),
        },
    )
    latency_ms = (time.perf_counter() - request_started) * 1_000
    if response.status_code != 200:
        raise EvalAbortError(
            f"{question['id']} POST /api/ask returned {response.status_code}: "
            f"{response.text[:300]}"
        )
    envelope = response.json()
    answer = str(envelope["answer"])
    citations = cast(list[Mapping[str, Any]], envelope.get("citations", []))
    citation_check = score_citations(answer, citations)

    # Keep this adjacent to answer capture: moving verification into a later pass can
    # straddle the 08:00/20:00 UTC collectors and compare two corpus snapshots.
    if question["tier"] == "a":
        expected = await _resolve_expected(question, session, client, anchors)
        result = score_tier_a(
            question,
            answer=answer,
            citations=citations,
            expected=expected,
            default_tolerance_pct=float(defaults["tolerance_pct"]),
        )
    elif question["tier"] == "b":
        if judge is None:
            raise AssertionError("missing judge should have returned before API capture")
        verdict, reason = await judge.score(
            question=str(question["question"]),
            answer=answer,
            rubric=str(question["rubric"]),
        )
        result = judge_result(
            verdict=verdict,
            reason=reason,
            rubric=str(question["rubric"]),
            answer=answer,
            citations_ok=citation_check.ok,
        )
    elif question["tier"] == "c":
        result = score_tier_c(question, answer=answer, citations=citations)
    else:
        raise EvalAbortError(f"unsupported question tier: {question['tier']}")
    finished = _utc_now()
    _assert_question_did_not_straddle(started, finished)
    usage = envelope.get("usage", {})
    cost_usd = _estimate_cost(usage, pricing)
    return _question_record(
        question,
        result=result,
        citation_check=citation_check,
        answer=answer,
        response=envelope,
        latency_ms=latency_ms,
        cost_usd=cost_usd,
    )


async def _resolve_expected(
    question: Mapping[str, Any],
    session: AsyncSession,
    client: httpx.AsyncClient,
    anchors: Mapping[str, Any],
) -> Any:
    if "verify_sql" in question:
        sql = str(question["verify_sql"]).replace(
            "%LATEST_FULL_DAY%",
            str(anchors["latest_full_day_sql"]).strip().rstrip(";"),
        )
        result = await session.execute(text(sql))
        row = result.first()
        if row is None or len(row) != 1:
            raise EvalAbortError(
                f"{question['id']} verify_sql must return exactly one scalar row"
            )
        return row[0]
    verify = question.get("verify")
    if verify == "api":
        spec = question["verify_api"]
        response = await client.get(str(spec["path"]), headers={"Accept": "application/json"})
        if response.status_code != 200:
            raise EvalAbortError(
                f"{question['id']} verification API returned {response.status_code}: "
                f"{response.text[:300]}"
            )
        return _jsonpath(response.json(), str(spec["jsonpath"]))
    if verify == "const":
        return question["expected"]
    raise EvalAbortError(f"{question['id']} has no supported verification method")


async def assert_same_database(session: AsyncSession, client: httpx.AsyncClient) -> str:
    """Assert Amendment B by comparing one freshness sentinel through both paths."""
    direct = await session.scalar(text("SELECT MAX(collected_at) FROM raw_observations"))
    response = await client.get("/api/ask/eval-sentinel")
    if response.status_code != 200:
        raise EvalAbortError(
            "API database sentinel is unavailable; start the local API with ASK_EVAL_MODE=1"
        )
    api_value = response.json().get("max_collected_at")
    direct_value: str | None = str(direct.isoformat()) if direct is not None else None
    if direct_value is None or api_value != direct_value:
        raise EvalAbortError(
            "database mismatch: verification SQL and the API returned different "
            f"MAX(collected_at) sentinels ({direct_value!r} != {api_value!r})"
        )
    return direct_value


def _load_question_set(path: Path, tier: Tier) -> list[dict[str, Any]]:
    payload = _load_yaml(path)
    questions = payload.get("questions")
    if not isinstance(questions, list):
        raise EvalAbortError(f"{path} has no questions list")
    selected = [
        dict(question)
        for question in questions
        if tier == "all" or question.get("tier") == tier
    ]
    if not selected:
        raise EvalAbortError(f"no questions selected for tier {tier}")
    return selected


def _load_yaml(path: Path) -> dict[str, Any]:
    payload = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise EvalAbortError(f"{path} root must be an object")
    return payload


def _question_record(
    question: Mapping[str, Any],
    *,
    result: ScoreResult,
    citation_check: CitationCheck,
    answer: str | None,
    response: Mapping[str, Any] | None,
    latency_ms: float,
    cost_usd: float | None,
) -> dict[str, Any]:
    return {
        "id": question["id"],
        "tier": question["tier"],
        "question": question["question"],
        "verdict": result.verdict,
        "score": result.score,
        "expected": result.expected,
        "got": result.got,
        "reason": result.reason,
        "answer": answer,
        "citations_ok": citation_check.ok,
        "citation_reason": citation_check.reason,
        "citations": list(response.get("citations", [])) if response else [],
        "tool_calls": list(response.get("tool_calls", [])) if response else [],
        "usage": dict(response.get("usage", {})) if response else {},
        "latency_ms": round(latency_ms, 3),
        "estimated_cost_usd": round(cost_usd, 8) if cost_usd is not None else None,
    }


def _build_scorecard(
    *,
    records: list[dict[str, Any]],
    model: str,
    chunker: str,
    started_at: datetime.datetime,
    finished_at: datetime.datetime,
) -> dict[str, Any]:
    aggregates: dict[str, dict[str, Any]] = {}
    for tier in ("a", "b", "c"):
        tier_records = [record for record in records if record["tier"] == tier]
        if not tier_records:
            continue
        scored = [record for record in tier_records if record["score"] is not None]
        aggregates[tier] = {
            "score": (
                round(sum(float(record["score"]) for record in scored) / len(scored), 6)
                if scored
                else None
            ),
            "passed": sum(record["verdict"] == "pass" for record in tier_records),
            "partial": sum(record["verdict"] == "partial" for record in tier_records),
            "failed": sum(record["verdict"] == "fail" for record in tier_records),
            "skipped": sum(record["verdict"] == "skipped" for record in tier_records),
            "total": len(tier_records),
        }
    answered = [record for record in records if record["answer"] is not None]
    citation_score = (
        sum(bool(record["citations_ok"]) for record in answered) / len(answered)
        if answered
        else None
    )
    aggregates["d"] = {
        "score": round(citation_score, 6) if citation_score is not None else None,
        "passed": sum(bool(record["citations_ok"]) for record in answered),
        "partial": 0,
        "failed": sum(not bool(record["citations_ok"]) for record in answered),
        "skipped": len(records) - len(answered),
        "total": len(records),
    }
    tier_scores = {tier: aggregate["score"] for tier, aggregate in aggregates.items()}
    latencies = [float(record["latency_ms"]) for record in answered]
    costs = [
        float(record["estimated_cost_usd"])
        for record in answered
        if record["estimated_cost_usd"] is not None
    ]
    return {
        "schema_version": 1,
        "model": model,
        "judge_model": JUDGE_MODEL,
        "chunker": chunker,
        "git_sha": _git_sha(),
        "started_at": started_at.isoformat(),
        "finished_at": finished_at.isoformat(),
        "questions": records,
        "tier_aggregates": aggregates,
        "overall": weighted_overall(tier_scores),
        "latency_ms": {
            "p50": round(_percentile(latencies, 0.50), 3) if latencies else None,
            "p95": round(_percentile(latencies, 0.95), 3) if latencies else None,
        },
        "estimated_cost_usd": {
            "total": round(sum(costs), 8) if costs else None,
            "per_query": round(statistics.mean(costs), 8) if costs else None,
        },
    }


def _load_regression_reasons(
    scorecard: Mapping[str, Any],
    baseline_path: Path,
    tier: str,
) -> list[str]:
    if tier != "all" or not baseline_path.exists():
        return []
    baseline = cast(
        dict[str, Any],
        json.loads(baseline_path.read_text(encoding="utf-8")),
    )
    return cast(list[str], regression_reasons(scorecard, baseline))


async def _fetch_model_pricing(model: str) -> ModelPricing | None:
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get("https://openrouter.ai/api/v1/models")
            response.raise_for_status()
        for item in response.json().get("data", []):
            if item.get("id") == model:
                pricing = item.get("pricing", {})
                return ModelPricing(
                    prompt=float(pricing["prompt"]),
                    completion=float(pricing["completion"]),
                )
    except (httpx.HTTPError, KeyError, TypeError, ValueError):
        return None
    return None


def _estimate_cost(usage: Mapping[str, Any], pricing: ModelPricing | None) -> float | None:
    if pricing is None:
        return None
    return (
        int(usage.get("input_tokens", 0)) * pricing.prompt
        + int(usage.get("output_tokens", 0)) * pricing.completion
    )


def _jsonpath(payload: Any, path: str) -> Any:
    if not path.startswith("$."):
        raise EvalAbortError(f"unsupported jsonpath: {path}")
    current = payload
    for part in path[2:].split("."):
        if not isinstance(current, Mapping) or part not in current:
            raise EvalAbortError(f"jsonpath {path} is missing component {part!r}")
        current = current[part]
    return current


def _require_loopback_api(api_url: str) -> None:
    hostname = urlparse(api_url).hostname
    if hostname not in {"127.0.0.1", "localhost", "::1"}:
        raise EvalAbortError("eval runner refuses non-loopback --api-url")


def _assert_projected_timing(now: datetime.datetime, remaining_questions: int) -> None:
    projected_end = now + datetime.timedelta(
        seconds=remaining_questions * QUESTION_TIME_BUDGET_SECONDS
    )
    if _overlaps_collection_window(now, projected_end):
        raise EvalAbortError(
            "timing guardrail: projected eval interval would overlap a protected "
            "07:55-08:15 or 19:55-20:15 UTC collection window"
        )


def _assert_question_did_not_straddle(
    started: datetime.datetime,
    finished: datetime.datetime,
) -> None:
    if _overlaps_collection_window(started, finished):
        raise EvalAbortError(
            "timing guardrail: answer capture and verification straddled a protected "
            "collection window; discard this run"
        )


def _overlaps_collection_window(
    started: datetime.datetime,
    finished: datetime.datetime,
) -> bool:
    if started.tzinfo is None or finished.tzinfo is None:
        raise ValueError("timing guardrail requires timezone-aware UTC datetimes")
    current_date = started.astimezone(datetime.UTC).date()
    last_date = finished.astimezone(datetime.UTC).date()
    while current_date <= last_date:
        for window_start, window_end in COLLECTION_WINDOWS_UTC:
            protected_start = datetime.datetime.combine(
                current_date, window_start, tzinfo=datetime.UTC
            )
            protected_end = datetime.datetime.combine(
                current_date, window_end, tzinfo=datetime.UTC
            )
            if started < protected_end and finished > protected_start:
                return True
        current_date += datetime.timedelta(days=1)
    return False


def _percentile(values: Sequence[float], quantile: float) -> float:
    ordered = sorted(values)
    if not ordered:
        raise ValueError("percentile requires values")
    index = (len(ordered) - 1) * quantile
    lower = math.floor(index)
    upper = math.ceil(index)
    if lower == upper:
        return ordered[lower]
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (index - lower)


def _git_sha() -> str:
    return subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()


def _utc_now() -> datetime.datetime:
    return datetime.datetime.now(datetime.UTC)


def _default_output_path() -> Path:
    timestamp = _utc_now().strftime("%Y%m%dT%H%M%SZ")
    return RESULTS_DIR / f"{timestamp}.json"


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    output_path = args.out or _default_output_path()
    try:
        scorecard, regression = asyncio.run(run(args))
    except (EvalAbortError, OSError, ValueError) as exc:
        print(f"ABORT: {exc}")
        return 2
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(scorecard, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Scorecard: {output_path}")
    print(f"Overall: {scorecard['overall']:.3f}")
    if regression:
        for reason in regression:
            print(f"REGRESSION: {reason}")
        return 1
    print("Regression gate: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
