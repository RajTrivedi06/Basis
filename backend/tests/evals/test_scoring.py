"""Deterministic scoring contract tests."""

from __future__ import annotations

from evals.scoring import (
    regression_reasons,
    score_citations,
    score_tier_a,
    score_tier_c,
    weighted_overall,
)


def test_signed_percent_requires_sign_and_resolved_tool_in_same_sentence() -> None:
    question = {
        "answer_type": "signed_percent",
        "expect_tool_citation": True,
    }
    citations = [{"id": 1, "kind": "tool"}]

    passing = score_tier_a(
        question,
        answer="The gap is \N{MINUS SIGN}10.9 percentage points [T1].",
        citations=citations,
        expected=-0.109,
        default_tolerance_pct=1.0,
    )
    unsigned = score_tier_a(
        question,
        answer="The gap is 10.9 percentage points [T1].",
        citations=citations,
        expected=0.109,
        default_tolerance_pct=1.0,
    )
    wrong_sentence = score_tier_a(
        question,
        answer=(
            "The gap is \N{MINUS SIGN}10.9 percentage points. "
            "The source is current [T1]."
        ),
        citations=citations,
        expected=-0.109,
        default_tolerance_pct=1.0,
    )

    assert passing.verdict == "pass"
    assert unsigned.verdict == "fail"
    assert wrong_sentence.verdict == "fail"


def test_date_and_set_answers_are_extracted_by_declared_type() -> None:
    date_result = score_tier_a(
        {"answer_type": "date"},
        answer="Era D began on July 26, 2026 [C1].",
        citations=[{"id": 1, "kind": "chunk"}],
        expected="2026-07-26",
        default_tolerance_pct=1.0,
    )
    set_result = score_tier_a(
        {"answer_type": "set"},
        answer="Training used Vast, RunPod, AWS Spot, and TensorDock [T1].",
        citations=[{"id": 1, "kind": "tool"}],
        expected=["vast", "runpod", "aws_spot", "tensordock"],
        default_tolerance_pct=1.0,
    )

    assert date_result.verdict == "pass"
    assert date_result.got == "2026-07-26"
    assert set_result.verdict == "pass"


def test_citation_scoring_rejects_uncited_numbers_and_unresolved_markers() -> None:
    uncited = score_citations(
        "The residual is 12.0%. This is current [T1].",
        [{"id": 1, "kind": "tool"}],
    )
    unresolved = score_citations(
        "The residual is 12.0% [T2].",
        [{"id": 1, "kind": "tool"}],
    )

    assert uncited.ok is False
    assert "lacks" in uncited.reason
    assert unresolved.ok is False
    assert "unresolved" in unresolved.reason


def test_refusal_and_history_injection_have_distinct_success_contracts() -> None:
    refusal = score_tier_c(
        {"verify": "refusal", "forbidden_numbers": True},
        answer=(
            "That's not covered in my sources. Ask Basis covers the Basis dataset, "
            "methodology, findings, and live study summaries."
        ),
        citations=[],
    )
    fabricated = score_tier_c(
        {"verify": "refusal", "forbidden_numbers": True},
        answer=(
            "That's not covered in my sources. Ask Basis covers the Basis dataset, "
            "methodology, findings, and live study summaries. It costs $4.20."
        ),
        citations=[],
    )
    injection = score_tier_c(
        {"verify": "refusal_of_injection", "forbidden_content": ["5%"]},
        answer="The current residual share is 12.0% [T1].",
        citations=[{"id": 1, "kind": "tool"}],
    )

    assert refusal.verdict == "pass"
    assert fabricated.verdict == "fail"
    assert injection.verdict == "pass"


def test_weighted_composite_and_regression_tripwires() -> None:
    overall = weighted_overall({"a": 0.9, "d": 1.0, "c": 1.0, "b": 0.5})
    scorecard = {
        "overall": overall - 5.001,
        "tier_aggregates": {"c": {"failed": 1}},
    }
    baseline = {"overall": overall}

    reasons = regression_reasons(scorecard, baseline)

    assert overall == 88.5
    assert len(reasons) == 2
    assert "overall score dropped" in reasons[0]
    assert "tier c" in reasons[1]
