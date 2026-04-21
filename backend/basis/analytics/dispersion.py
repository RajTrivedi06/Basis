"""Price dispersion metrics.

Per (date, gpu_sku) and per (date, gpu_sku, provider):
  observation_count, median, p25, p75, IQR, coefficient of variation

Input is a pandas DataFrame of canonical offers; output is a list of
DispersionRow records ready to upsert into daily_aggregates.

A (date, gpu_sku[, provider]) bucket with fewer than MIN_OBSERVATIONS
offers is skipped (not enough signal to report a meaningful distribution).
"""

from __future__ import annotations

import datetime
import logging
from dataclasses import dataclass

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

MIN_OBSERVATIONS = 3


@dataclass
class DispersionRow:
    """A single row destined for daily_aggregates."""

    date: datetime.date
    gpu_sku: str
    provider: str | None          # None = all-providers rollup
    region: str | None            # None = all-regions rollup (always None for now)
    observation_count: int
    median_price: float
    p25_price: float
    p75_price: float
    normalized_median_price: float | None  # populated only when available


def compute_dispersion(offers: pd.DataFrame) -> list[DispersionRow]:
    """Compute dispersion rows for a DataFrame of canonical offers.

    Expected columns:
        date, gpu_sku_canonical, provider, price_usd_per_hour,
        normalized_price_usd_per_hour (optional, nullable)

    Returns one row per (date, gpu_sku) all-providers rollup plus one row
    per (date, gpu_sku, provider) slice.
    """
    if offers.empty:
        return []

    rows: list[DispersionRow] = []

    # All-providers rollup
    rows.extend(_summarize(offers, provider_slice=False))

    # Per-provider slice
    rows.extend(_summarize(offers, provider_slice=True))

    return rows


def _summarize(offers: pd.DataFrame, provider_slice: bool) -> list[DispersionRow]:
    group_cols = ["date", "gpu_sku_canonical"]
    if provider_slice:
        group_cols.append("provider")

    out: list[DispersionRow] = []
    for keys, group in offers.groupby(group_cols, dropna=False):
        if len(group) < MIN_OBSERVATIONS:
            continue

        prices = group["price_usd_per_hour"].astype(float).to_numpy()
        median_p = float(np.median(prices))
        p25 = float(np.percentile(prices, 25))
        p75 = float(np.percentile(prices, 75))

        normalized_median = None
        if "normalized_price_usd_per_hour" in group.columns:
            norm = group["normalized_price_usd_per_hour"].dropna().astype(float)
            if len(norm) > 0:
                normalized_median = float(norm.median())

        if provider_slice:
            date_val, gpu_sku, provider = keys
        else:
            date_val, gpu_sku = keys
            provider = None

        out.append(
            DispersionRow(
                date=date_val,
                gpu_sku=gpu_sku,
                provider=provider,
                region=None,
                observation_count=len(group),
                median_price=median_p,
                p25_price=p25,
                p75_price=p75,
                normalized_median_price=normalized_median,
            )
        )

    return out


def coefficient_of_variation(prices: np.ndarray) -> float | None:
    """Standard deviation divided by mean. Returns None if mean is 0."""
    mean = float(prices.mean())
    if mean == 0:
        return None
    return float(prices.std(ddof=1) / mean) if len(prices) > 1 else None


def iqr(p25: float, p75: float) -> float:
    """Interquartile range, always non-negative."""
    return max(0.0, p75 - p25)
