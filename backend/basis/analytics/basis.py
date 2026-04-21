"""Basis decomposition.

Decomposes total price variance per (date, gpu_sku) into components
attributable to observable factors and a residual. The residual is the
headline finding of Basis: the slice of price dispersion that remains
after accounting for region, commitment type, provider identity, and
bundled resources.

Method: sequential ANOVA on log-prices.
  total_var = SS_between(region) + SS_between(commitment | region)
            + SS_between(provider | region, commitment)
            + SS_between(bundle    | region, commitment, provider)
            + residual

We use log-prices because price ratios are what matter for fungibility —
a $2/hr vs $4/hr spread is the same ratio as $1/hr vs $2/hr and shouldn't
be conflated in absolute-variance terms.

Sequential ordering (region → commitment → provider → bundle) goes
most-exogenous to most-internal. Changing the order changes attributions
but not the residual. This is documented in methodology.md.

NULL factor values are preserved as a distinct "UNKNOWN" group so offers
aren't silently dropped. A factor with <2 distinct groups contributes 0
(nothing to attribute).
"""

from __future__ import annotations

import datetime
import logging
from dataclasses import dataclass

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

MIN_OBSERVATIONS = 5  # (date, gpu_sku) with fewer offers isn't worth decomposing
NULL_GROUP = "UNKNOWN"

# Fixed attribution order — documented in methodology.md
FACTOR_ORDER: tuple[str, ...] = ("region", "commitment", "provider", "bundle")


@dataclass
class DecompositionRow:
    """A single row destined for basis_decomposition."""

    date: datetime.date
    gpu_sku: str
    total_variance: float
    variance_from_region: float
    variance_from_commitment: float
    variance_from_bundle: float
    variance_from_provider: float
    residual_variance: float


def compute_decompositions(offers: pd.DataFrame) -> list[DecompositionRow]:
    """Compute a decomposition row per (date, gpu_sku).

    Expected columns:
        date, gpu_sku_canonical, provider, commitment_type,
        region_country, vcpus_bundled, ram_gb_bundled, storage_gb_bundled,
        price_usd_per_hour
    """
    if offers.empty:
        return []

    rows: list[DecompositionRow] = []
    for (date_val, gpu_sku), group in offers.groupby(
        ["date", "gpu_sku_canonical"], dropna=False
    ):
        if len(group) < MIN_OBSERVATIONS:
            continue

        try:
            row = _decompose_one(date_val, gpu_sku, group)
            if row is not None:
                rows.append(row)
        except Exception:
            logger.warning(
                "Decomposition failed for (%s, %s)", date_val, gpu_sku, exc_info=True
            )

    return rows


def _decompose_one(
    date_val: datetime.date, gpu_sku: str, group: pd.DataFrame
) -> DecompositionRow | None:
    """Sequential ANOVA on log-prices for one (date, gpu_sku) slice."""
    log_prices = np.log(group["price_usd_per_hour"].astype(float).to_numpy())
    n = len(log_prices)
    grand_mean = log_prices.mean()
    total_ss = float(((log_prices - grand_mean) ** 2).sum())

    if total_ss == 0:
        # All offers priced identically. Every factor's attribution is 0,
        # residual is 0. Not interesting but not a bug.
        return DecompositionRow(
            date=date_val,
            gpu_sku=gpu_sku,
            total_variance=0.0,
            variance_from_region=0.0,
            variance_from_commitment=0.0,
            variance_from_bundle=0.0,
            variance_from_provider=0.0,
            residual_variance=0.0,
        )

    # Build factor columns for sequential attribution.
    factor_vals = {
        "region": _factor_values(group["region_country"]),
        "commitment": _factor_values(group["commitment_type"]),
        "provider": _factor_values(group["provider"]),
        "bundle": _bundle_quartiles(group),
    }

    # Sequential attribution: at each step, partition rows by the
    # cross-product of *all factors so far* and compute the additional SS
    # explained beyond the previous step.
    attributed: dict[str, float] = {name: 0.0 for name in FACTOR_ORDER}
    previous_ss_within = total_ss
    prior_keys: list[np.ndarray] = []

    for factor in FACTOR_ORDER:
        keys = factor_vals[factor]
        if _distinct_count(keys) < 2:
            # No variation in this factor; contributes 0.
            continue
        current_keys = [*prior_keys, keys]
        ss_within = _sum_of_squares_within(log_prices, current_keys)
        ss_explained = max(0.0, previous_ss_within - ss_within)
        attributed[factor] = ss_explained
        previous_ss_within = ss_within
        prior_keys = current_keys

    residual = max(0.0, total_ss - sum(attributed.values()))

    return DecompositionRow(
        date=date_val,
        gpu_sku=gpu_sku,
        total_variance=total_ss / max(n - 1, 1),        # convert SS → variance
        variance_from_region=attributed["region"] / max(n - 1, 1),
        variance_from_commitment=attributed["commitment"] / max(n - 1, 1),
        variance_from_provider=attributed["provider"] / max(n - 1, 1),
        variance_from_bundle=attributed["bundle"] / max(n - 1, 1),
        residual_variance=residual / max(n - 1, 1),
    )


def _factor_values(series: pd.Series) -> np.ndarray:
    """Replace NULL with a distinct 'UNKNOWN' label so rows aren't dropped."""
    return series.fillna(NULL_GROUP).astype(str).to_numpy()


def _distinct_count(arr: np.ndarray) -> int:
    return int(pd.Series(arr).nunique())


def _sum_of_squares_within(values: np.ndarray, keys_list: list[np.ndarray]) -> float:
    """Sum of squared deviations from the within-group mean.

    Groups are defined by the cross-product of keys_list. This is how
    sequential ANOVA accumulates conditioning on multiple factors.
    """
    if not keys_list:
        grand_mean = values.mean()
        return float(((values - grand_mean) ** 2).sum())

    combined = pd.DataFrame({f"k{i}": k for i, k in enumerate(keys_list)})
    combined["_v"] = values

    group_means = combined.groupby(list(combined.columns[:-1]))["_v"].transform("mean")
    residuals = values - group_means.to_numpy()
    return float((residuals ** 2).sum())


def _bundle_quartiles(group: pd.DataFrame) -> np.ndarray:
    """Build a bundle-quartile label per row.

    Composite score = z-normalized sum of (vcpus, ram_gb, storage_gb)
    across the group. Rows where ALL three bundle fields are NULL get the
    'UNKNOWN' label. Rows with partial data contribute what they have.
    """
    bundle_cols = ["vcpus_bundled", "ram_gb_bundled", "storage_gb_bundled"]
    sub = group[bundle_cols].astype(float)
    all_null = sub.isna().all(axis=1)

    # Z-normalize each column independently, treating NaN as 0 contribution.
    score = pd.Series(0.0, index=sub.index)
    for col in bundle_cols:
        vals = sub[col]
        if vals.dropna().nunique() < 2:
            continue
        mean = vals.mean(skipna=True)
        std = vals.std(skipna=True, ddof=0)
        if std == 0 or np.isnan(std):
            continue
        score = score + ((vals - mean) / std).fillna(0.0)

    # If no column had variation, every non-null row gets the same label.
    labels = pd.Series(NULL_GROUP, index=group.index, dtype=object)
    known = ~all_null
    if known.any():
        known_score = score[known]
        if known_score.nunique() >= 2:
            # qcut may fail if there are duplicate bin edges — fall back to rank buckets.
            try:
                bins = pd.qcut(known_score, q=4, duplicates="drop", labels=False)
                labels.loc[known] = bins.astype("Int64").astype(str)
            except ValueError:
                ranks = known_score.rank(method="dense")
                labels.loc[known] = ranks.astype(int).astype(str)
        else:
            labels.loc[known] = "BUNDLE_FLAT"

    return labels.to_numpy()
