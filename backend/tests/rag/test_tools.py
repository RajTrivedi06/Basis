"""Integration tests for compact internal Ask Basis tools."""

from __future__ import annotations

import datetime
import json
import logging
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from basis.analytics.basis import DecompositionRow
from basis.db.models import BasisDecomposition, DailyAggregate
from basis.rag.context import assemble
from basis.rag.tools import (
    LATEST_DAY_MIN_OBSERVATIONS,
    LATEST_DAY_MIN_PROVIDERS,
    MARKET_PRICED_EXCLUDED_PROVIDERS,
    TOOL_NAMES,
    ToolExecutor,
    UnknownToolError,
)

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


@pytest.mark.asyncio
async def test_latest_basis_skips_and_logs_partial_days(
    db_session: AsyncSession,
    caplog: pytest.LogCaptureFixture,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    qualified_day = datetime.date(2098, 1, 1)
    partial_day = datetime.date(2098, 1, 2)
    for day, count, residual in (
        (qualified_day, LATEST_DAY_MIN_OBSERVATIONS, 0.6),
        (partial_day, LATEST_DAY_MIN_OBSERVATIONS - 1, 0.1),
    ):
        db_session.add(
            DailyAggregate(
                date=day,
                gpu_sku="h100_sxm_80gb",
                provider=None,
                region=None,
                observation_count=count,
                median_price=2.0,
                p25_price=1.5,
                p75_price=2.5,
                normalized_median_price=None,
            )
        )
        provider_names = (
            ("aws_spot", "vast")
            if day == qualified_day
            else ("aws_spot",)
        )
        for provider in provider_names:
            db_session.add(
                DailyAggregate(
                    date=day,
                    gpu_sku="h100_sxm_80gb",
                    provider=provider,
                    region=None,
                    observation_count=count // len(provider_names),
                    median_price=2.0,
                    p25_price=1.5,
                    p75_price=2.5,
                    normalized_median_price=None,
                )
            )
        db_session.add(
            BasisDecomposition(
                date=day,
                gpu_sku="h100_sxm_80gb",
                total_variance=1.0,
                variance_from_region=0.1,
                variance_from_commitment=0.1,
                variance_from_bundle=0.1,
                variance_from_provider=0.1,
                residual_variance=residual,
            )
        )
    await db_session.flush()
    filtered_calls: list[tuple[datetime.date, datetime.date, list[str]]] = []

    async def fake_filtered_timeseries(
        _session: AsyncSession,
        _sku: str,
        since: datetime.date,
        until: datetime.date,
        excluded: list[str],
    ) -> list[DecompositionRow]:
        filtered_calls.append((since, until, excluded))
        return [
            DecompositionRow(
                date=qualified_day,
                gpu_sku="h100_sxm_80gb",
                total_variance=1.0,
                variance_from_region=0.05,
                variance_from_commitment=0.05,
                variance_from_bundle=0.05,
                variance_from_provider=0.05,
                residual_variance=0.8,
            )
        ]

    monkeypatch.setattr(
        "basis.rag.tools._compute_filtered_timeseries",
        fake_filtered_timeseries,
    )
    try:
        with caplog.at_level(logging.WARNING, logger="basis.rag.tools"):
            result = await ToolExecutor().execute(
                "get_latest_basis",
                result_id=1,
                session=db_session,
            )

        assert result.as_of == qualified_day.isoformat()
        assert result.columns == ("metric", "share", "as_of")
        assert result.rows[:2] == (
            (
                "market-priced segment residual (primary; excludes azure,gcp)",
                "80.0%",
                qualified_day.isoformat(),
            ),
            (
                "pooled five-provider residual",
                "60.0%",
                qualified_day.isoformat(),
            ),
        )
        assert filtered_calls == [
            (
                qualified_day,
                qualified_day,
                list(MARKET_PRICED_EXCLUDED_PROVIDERS),
            )
        ]
        assert partial_day.isoformat() in caplog.text
        assert "29 observations" in caplog.text
        assert "1 contributing providers" in caplog.text
    finally:
        await db_session.rollback()


@pytest.mark.asyncio
async def test_latest_basis_real_corpus_rejects_aws_only_final_day(
    db_session: AsyncSession,
    caplog: pytest.LogCaptureFixture,
) -> None:
    qualified_day = datetime.date(2026, 7, 28)
    partial_day = datetime.date(2026, 7, 29)
    rows = (
        await db_session.execute(
            select(
                DailyAggregate.date,
                DailyAggregate.provider,
                DailyAggregate.observation_count,
            ).where(
                DailyAggregate.gpu_sku == "h100_sxm_80gb",
                DailyAggregate.date.in_(
                    (qualified_day, partial_day)
                ),
            )
        )
    ).all()
    rollups = {
        row.date: int(row.observation_count)
        for row in rows
        if row.provider is None
    }
    providers = {
        day: {
            row.provider
            for row in rows
            if row.date == day and row.provider is not None
        }
        for day in rollups
    }
    has_local_corpus_boundary = (
        rollups.get(qualified_day) == 233
        and len(providers.get(qualified_day, set())) == 4
        and rollups.get(partial_day) == 55
        and providers.get(partial_day) == {"aws_spot"}
    )
    if not has_local_corpus_boundary:
        pytest.skip("full local corpus 2026-07-28/29 boundary is not loaded")

    executor = ToolExecutor()
    with caplog.at_level(logging.WARNING, logger="basis.rag.tools"):
        result = await executor.execute(
            "get_latest_basis",
            result_id=1,
            session=db_session,
        )

    assert LATEST_DAY_MIN_OBSERVATIONS == 30
    assert LATEST_DAY_MIN_PROVIDERS == 2
    assert rollups[partial_day] == 55
    assert providers[partial_day] == {"aws_spot"}
    assert rollups[qualified_day] == 233
    assert len(providers[qualified_day]) == 4
    assert result.as_of == qualified_day.isoformat()
    assert result.rows[0][0] == (
        "market-priced segment residual (primary; excludes azure,gcp)"
    )
    assert result.rows[0][2] == qualified_day.isoformat()
    assert result.rows[1][0] == "pooled five-provider residual"
    assert result.rows[1][2] == qualified_day.isoformat()
    assert partial_day.isoformat() in caplog.text
    assert "55 observations" in caplog.text
    assert "1 contributing providers" in caplog.text
