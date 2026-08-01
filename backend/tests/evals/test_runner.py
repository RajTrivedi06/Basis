"""Eval orchestration invariants that do not make model calls."""

from __future__ import annotations

import datetime
import json
from decimal import Decimal
from pathlib import Path
from typing import Any, cast

import pytest
from evals.run_evals import (
    QUESTIONS_PATH,
    EvalAbortError,
    _assert_projected_timing,
    _json_safe,
    _jsonpath,
    _load_question_set,
    _load_regression_reasons,
    _overlaps_collection_window,
    assert_same_database,
)


def _utc(hour: int, minute: int) -> datetime.datetime:
    return datetime.datetime(2026, 8, 5, hour, minute, tzinfo=datetime.UTC)


def test_golden_set_counts_and_latest_full_day_rule_are_loaded() -> None:
    assert len(_load_question_set(QUESTIONS_PATH, "a")) == 20
    assert len(_load_question_set(QUESTIONS_PATH, "b")) == 10
    assert len(_load_question_set(QUESTIONS_PATH, "c")) == 7
    assert len(_load_question_set(QUESTIONS_PATH, "all")) == 37

    text = Path(QUESTIONS_PATH).read_text(encoding="utf-8")
    assert "d.observation_count >= 30" in text
    assert "COUNT(DISTINCT p.provider)" in text
    assert "MAX(collected_at) FROM raw_observations) - INTERVAL '7 days'" in text


def test_timing_guard_rejects_projected_or_actual_collection_overlap() -> None:
    assert _overlaps_collection_window(_utc(3, 40), _utc(4, 55)) is False
    assert _overlaps_collection_window(_utc(7, 54), _utc(7, 56)) is True
    assert _overlaps_collection_window(_utc(19, 56), _utc(20, 1)) is True

    _assert_projected_timing(_utc(3, 40), 37)
    with pytest.raises(EvalAbortError, match="timing guardrail"):
        _assert_projected_timing(_utc(7, 54), 1)


@pytest.mark.asyncio
async def test_database_sentinel_mismatch_aborts_before_questions() -> None:
    class FakeSession:
        async def scalar(self, _statement: object) -> datetime.datetime:
            return _utc(12, 0)

    class FakeResponse:
        status_code = 200

        def json(self) -> dict[str, str]:
            return {"max_collected_at": _utc(12, 1).isoformat()}

    class FakeClient:
        async def get(self, _path: str) -> FakeResponse:
            return FakeResponse()

    with pytest.raises(EvalAbortError, match="database mismatch"):
        await assert_same_database(
            cast(Any, FakeSession()),
            cast(Any, FakeClient()),
        )


def test_jsonpath_is_deliberately_bounded_to_object_components() -> None:
    payload = {"metrics": {"holdout": {"r2_oos": 0.58}}}

    assert _jsonpath(payload, "$.metrics.holdout.r2_oos") == 0.58
    with pytest.raises(EvalAbortError, match="missing component"):
        _jsonpath(payload, "$.metrics.missing")


def test_database_scalars_are_json_safe_in_scorecards() -> None:
    payload = {
        "decimal": Decimal("0.5629086139386911"),
        "date": datetime.date(2026, 6, 12),
    }

    normalized = _json_safe(payload)

    assert normalized == {
        "decimal": 0.5629086139386911,
        "date": "2026-06-12",
    }
    json.dumps(normalized)


def test_tier_c_failure_gates_without_a_baseline(tmp_path: Path) -> None:
    scorecard = {"tier_aggregates": {"c": {"failed": 1}}}

    assert _load_regression_reasons(scorecard, tmp_path / "missing.json", "c") == [
        "tier c has 1 failure(s)"
    ]
    assert _load_regression_reasons(scorecard, tmp_path / "missing.json", "all") == [
        "tier c has 1 failure(s)"
    ]
