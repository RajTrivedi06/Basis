"""Whitelisted internal data tools for Ask Basis."""

from __future__ import annotations

import asyncio
import datetime
import logging
from collections.abc import Callable
from typing import Any, Final

from sqlalchemy import Date, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from basis.api.routes.basis import _compute_filtered_timeseries
from basis.api.routes.ml import get_explainability_artifact
from basis.api.routes.providers import list_providers
from basis.db.models import BasisDecomposition, CanonicalOffer, DailyAggregate
from basis.rag.context import ToolContextResult, count_tokens

TOOL_RESULT_TOKEN_CEILING: Final = 400
# Rule-based coverage floors per ADR-0002. Together they exclude the known
# partial-day artifact where 55 AWS-only offers otherwise looked "latest"
# despite omitting the rest of the market.
LATEST_DAY_MIN_OBSERVATIONS: Final = 30
LATEST_DAY_MIN_PROVIDERS: Final = 2
# Azure and GCP are administered-price catalogs, not continuously clearing
# market segments. The primary current residual excludes them while the pooled
# five-provider figure remains visible as the population-sensitivity check.
MARKET_PRICED_EXCLUDED_PROVIDERS: Final = ("azure", "gcp")
TOOL_NAMES: Final = (
    "get_latest_basis",
    "get_dispersion_summary",
    "get_provider_summary",
    "get_ml_explainability",
)
TOOL_DEFINITIONS: Final = tuple(
    {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
        },
    }
    for name, description in (
        (
            "get_latest_basis",
            "Get the latest H100-SXM market-priced and pooled variance decomposition.",
        ),
        ("get_dispersion_summary", "Get latest price dispersion for the eight busiest SKUs."),
        ("get_provider_summary", "Get current provider coverage and median price deviation."),
        ("get_ml_explainability", "Get the latest frozen ML explainability summary."),
    )
)

logger = logging.getLogger(__name__)


class UnknownToolError(ValueError):
    """Raised when a model requests a function outside the fixed whitelist."""


class ToolExecutor:
    """Dispatch the four approved functions without HTTP-to-self calls."""

    def __init__(
        self,
        *,
        ml_loader: Callable[[], dict[str, Any]] = get_explainability_artifact,
    ) -> None:
        self._ml_loader = ml_loader

    async def execute(
        self,
        name: str,
        *,
        result_id: int,
        session: AsyncSession,
    ) -> ToolContextResult:
        """Execute one whitelisted tool and enforce its standalone token cap."""
        if name == "get_latest_basis":
            result = await _get_latest_basis(session, result_id)
        elif name == "get_dispersion_summary":
            result = await _get_dispersion_summary(session, result_id)
        elif name == "get_provider_summary":
            result = await _get_provider_summary(session, result_id)
        elif name == "get_ml_explainability":
            artifact = await asyncio.to_thread(self._ml_loader)
            result = _compact_ml_explainability(artifact, result_id)
        else:
            raise UnknownToolError(name)
        if _result_token_count(result) > TOOL_RESULT_TOKEN_CEILING:
            raise ValueError(
                f"{name} result exceeds the {TOOL_RESULT_TOKEN_CEILING}-token tool cap"
            )
        return result


async def _get_latest_basis(
    session: AsyncSession,
    result_id: int,
) -> ToolContextResult:
    latest_day = await _latest_qualified_date(
        session,
        gpu_sku="h100_sxm_80gb",
    )
    if latest_day is None:
        return _empty_result(result_id, "get_latest_basis")
    row = (
        await session.execute(
            select(BasisDecomposition)
            .where(
                BasisDecomposition.gpu_sku == "h100_sxm_80gb",
                BasisDecomposition.date == latest_day,
            )
            .limit(1)
        )
    ).scalar_one_or_none()
    if row is None:
        return _empty_result(result_id, "get_latest_basis")

    market_rows = await _compute_filtered_timeseries(
        session,
        "h100_sxm_80gb",
        latest_day,
        latest_day,
        list(MARKET_PRICED_EXCLUDED_PROVIDERS),
    )
    if not market_rows:
        logger.warning(
            "market-priced latest-basis decomposition unavailable for %s",
            latest_day,
        )
        return _empty_result(result_id, "get_latest_basis")
    market_row = market_rows[-1]

    def share(value: float, total: float) -> str:
        return f"{(value / total * 100.0) if total > 0 else 0.0:.1f}%"

    return ToolContextResult(
        id=result_id,
        tool="get_latest_basis",
        as_of=row.date.isoformat(),
        columns=("metric", "share", "as_of"),
        rows=(
            (
                "market-priced segment residual (primary; excludes azure,gcp)",
                share(market_row.residual_variance, market_row.total_variance),
                market_row.date.isoformat(),
            ),
            (
                "pooled five-provider residual",
                share(row.residual_variance, row.total_variance),
                row.date.isoformat(),
            ),
            (
                "pooled provider",
                share(row.variance_from_provider, row.total_variance),
                row.date.isoformat(),
            ),
            (
                "pooled commitment",
                share(row.variance_from_commitment, row.total_variance),
                row.date.isoformat(),
            ),
            (
                "pooled region",
                share(row.variance_from_region, row.total_variance),
                row.date.isoformat(),
            ),
            (
                "pooled bundle",
                share(row.variance_from_bundle, row.total_variance),
                row.date.isoformat(),
            ),
        ),
    )


async def _get_dispersion_summary(
    session: AsyncSession,
    result_id: int,
) -> ToolContextResult:
    provider_counts = (
        select(
            DailyAggregate.date.label("date"),
            DailyAggregate.gpu_sku.label("gpu_sku"),
            func.count(func.distinct(DailyAggregate.provider)).label("provider_count"),
        )
        .where(
            DailyAggregate.provider.is_not(None),
            DailyAggregate.observation_count > 0,
        )
        .group_by(DailyAggregate.date, DailyAggregate.gpu_sku)
        .subquery()
    )
    latest_day = (
        await session.execute(
            select(func.max(DailyAggregate.date))
            .join(
                provider_counts,
                (provider_counts.c.date == DailyAggregate.date)
                & (provider_counts.c.gpu_sku == DailyAggregate.gpu_sku),
            )
            .where(
                DailyAggregate.provider.is_(None),
                DailyAggregate.region.is_(None),
                DailyAggregate.observation_count >= LATEST_DAY_MIN_OBSERVATIONS,
                provider_counts.c.provider_count >= LATEST_DAY_MIN_PROVIDERS,
            )
        )
    ).scalar_one_or_none()
    if latest_day is None:
        return _empty_result(result_id, "get_dispersion_summary")
    qualifying_skus = (
        await session.execute(
            select(DailyAggregate.gpu_sku)
            .join(
                provider_counts,
                (provider_counts.c.date == DailyAggregate.date)
                & (provider_counts.c.gpu_sku == DailyAggregate.gpu_sku),
            )
            .where(
                DailyAggregate.date == latest_day,
                DailyAggregate.provider.is_(None),
                DailyAggregate.region.is_(None),
                DailyAggregate.observation_count >= LATEST_DAY_MIN_OBSERVATIONS,
                provider_counts.c.provider_count >= LATEST_DAY_MIN_PROVIDERS,
            )
        )
    ).scalars().all()
    median = func.percentile_cont(0.5).within_group(CanonicalOffer.price_usd_per_hour)
    rows = (
        await session.execute(
            select(
                CanonicalOffer.gpu_sku_canonical.label("sku"),
                func.min(CanonicalOffer.price_usd_per_hour).label("minimum"),
                median.label("median"),
                func.max(CanonicalOffer.price_usd_per_hour).label("maximum"),
                func.count(CanonicalOffer.id).label("n"),
            )
            .where(
                cast(CanonicalOffer.collected_at, Date) == latest_day,
                CanonicalOffer.gpu_sku_canonical.in_(qualifying_skus),
            )
            .group_by(CanonicalOffer.gpu_sku_canonical)
            .order_by(func.count(CanonicalOffer.id).desc(), CanonicalOffer.gpu_sku_canonical)
            .limit(8)
        )
    ).all()
    return ToolContextResult(
        id=result_id,
        tool="get_dispersion_summary",
        as_of=latest_day.isoformat(),
        columns=("sku", "min", "median", "max", "n"),
        rows=tuple(
            (
                str(row.sku),
                f"${float(row.minimum):.4f}",
                f"${float(row.median):.4f}",
                f"${float(row.maximum):.4f}",
                f"{int(row.n):,}",
            )
            for row in rows
        ),
    )


async def _get_provider_summary(
    session: AsyncSession,
    result_id: int,
) -> ToolContextResult:
    response = await list_providers(session)
    dated = [item.latest_collection for item in response.items if item.latest_collection]
    as_of = max(dated).date().isoformat() if dated else "unavailable"
    return ToolContextResult(
        id=result_id,
        tool="get_provider_summary",
        as_of=as_of,
        columns=("provider", "n", "median deviation", "latest"),
        rows=tuple(
            (
                item.provider,
                f"{item.offer_count:,}",
                (
                    f"{item.median_deviation_pct:.1f}%"
                    if item.median_deviation_pct is not None
                    else "n/a"
                ),
                item.latest_collection.date().isoformat() if item.latest_collection else "n/a",
            )
            for item in response.items
        ),
    )


def _compact_ml_explainability(
    artifact: dict[str, Any],
    result_id: int,
) -> ToolContextResult:
    metadata = artifact["metadata"]
    metrics = artifact["metrics"]
    shap_features = artifact["shap_summary"]["top_features"][:5]
    host = artifact["host_analysis"]
    rows = [
        ("holdout R²", f"{float(metrics['holdout']['r2_oos']):.3f}"),
        ("ANOVA share", f"{float(metrics['anova_explained_same_days']) * 100:.1f}%"),
        ("GBM-ANOVA gap", f"{float(metrics['gap']) * 100:.1f} pp"),
        ("host ICC", f"{float(host['icc']):.3f}"),
    ]
    rows.extend(
        (
            f"SHAP {feature['rank']}: {feature['feature']}",
            f"{float(feature['mean_abs_shap']):.4f}",
        )
        for feature in shap_features
    )
    return ToolContextResult(
        id=result_id,
        tool="get_ml_explainability",
        as_of=str(metadata["corpus_through"]),
        columns=("metric", "value"),
        rows=tuple(rows),
    )


def _empty_result(result_id: int, tool: str) -> ToolContextResult:
    return ToolContextResult(
        id=result_id,
        tool=tool,
        as_of="unavailable",
        columns=("status",),
        rows=(("no data",),),
    )


async def _latest_qualified_date(
    session: AsyncSession,
    *,
    gpu_sku: str,
) -> datetime.date | None:
    provider_counts = {
        row.date: int(row.provider_count)
        for row in (
            await session.execute(
                select(
                    DailyAggregate.date,
                    func.count(func.distinct(DailyAggregate.provider)).label(
                        "provider_count"
                    ),
                )
                .where(
                    DailyAggregate.gpu_sku == gpu_sku,
                    DailyAggregate.provider.is_not(None),
                    DailyAggregate.observation_count > 0,
                )
                .group_by(DailyAggregate.date)
            )
        ).all()
    }
    daily_rows = (
        await session.execute(
            select(DailyAggregate.date, DailyAggregate.observation_count)
            .where(
                DailyAggregate.gpu_sku == gpu_sku,
                DailyAggregate.provider.is_(None),
                DailyAggregate.region.is_(None),
            )
            .order_by(DailyAggregate.date.desc())
        )
    ).all()
    for row in daily_rows:
        observation_count = int(row.observation_count)
        provider_count = provider_counts.get(row.date, 0)
        if (
            observation_count >= LATEST_DAY_MIN_OBSERVATIONS
            and provider_count >= LATEST_DAY_MIN_PROVIDERS
        ):
            selected_date: datetime.date = row.date
            return selected_date
        logger.warning(
            (
                "skipping partial latest day %s for %s: %s observations, "
                "%s contributing providers (requires >= %s and >= %s)"
            ),
            row.date,
            gpu_sku,
            observation_count,
            provider_count,
            LATEST_DAY_MIN_OBSERVATIONS,
            LATEST_DAY_MIN_PROVIDERS,
        )
    return None


def _result_token_count(result: ToolContextResult) -> int:
    header = "| " + " | ".join(result.columns) + " |"
    rows = "\n".join("| " + " | ".join(row) + " |" for row in result.rows)
    return int(
        count_tokens(f"[T{result.id}] {result.tool} as_of={result.as_of}\n{header}\n{rows}")
    )
