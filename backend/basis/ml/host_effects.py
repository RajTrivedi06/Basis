"""Persistent Vast host-effect analysis specified by design §6.

The analysis is pure pandas/numpy over the already extracted, daily-deduped
feature frame. It never queries or writes the database.
"""

from __future__ import annotations

import logging
from collections.abc import Sequence
from typing import Any, Final

import numpy as np
import pandas as pd  # type: ignore[import-untyped]

from basis.ml.features import TARGET_COLUMN

logger = logging.getLogger(__name__)

PRIMARY_MIN_DAYS: Final = 10
SENSITIVITY_THRESHOLDS: Final = (5, 20)
ICC_SWING_WARNING: Final = 0.15


def analyze_host_effects(features: pd.DataFrame) -> dict[str, Any]:
    """Estimate day-first fixed effects and host ICC for Vast on-demand rows."""
    required = {
        "provider",
        "commitment_type",
        "machine_id",
        "collected_day",
        TARGET_COLUMN,
    }
    missing = sorted(required.difference(features.columns))
    if missing:
        raise ValueError(f"host analysis is missing required columns: {missing}")

    vast = features.loc[
        (features["provider"] == "vast")
        & (features["commitment_type"] == "on_demand")
        & features["machine_id"].notna(),
        ["machine_id", "collected_day", TARGET_COLUMN],
    ].copy()
    if vast.empty:
        return _empty_result()

    # Design §6: multiple slices from one machine on one day become one
    # host-day observation before any tenure threshold or fixed effect.
    panel = (
        vast.groupby(["machine_id", "collected_day"], as_index=False, dropna=False)[TARGET_COLUMN]
        .mean()
        .sort_values(["machine_id", "collected_day"], kind="stable")
        .reset_index(drop=True)
    )
    tenure = panel.groupby("machine_id")["collected_day"].nunique()
    tenure_summary = {
        "min": int(tenure.min()),
        "median": float(tenure.median()),
        "max": int(tenure.max()),
    }

    primary = _analyze_threshold(panel, PRIMARY_MIN_DAYS)
    sensitivity_results = [
        _analyze_threshold(panel, threshold) for threshold in SENSITIVITY_THRESHOLDS
    ]
    sensitivity = [
        {
            "threshold": result["threshold"],
            "icc": result["icc"],
            "n_hosts": result["n_hosts"],
        }
        for result in sensitivity_results
    ]

    available_iccs = [
        float(result["icc"])
        for result in [primary, *sensitivity_results]
        if int(result["n_hosts"]) > 0
    ]
    if available_iccs and max(available_iccs) - min(available_iccs) > ICC_SWING_WARNING:
        logger.warning(
            "Host ICC sensitivity swing exceeds %.2f: %s",
            ICC_SWING_WARNING,
            available_iccs,
        )

    return {
        "icc": primary["icc"],
        "fe_r2_increment": primary["fe_r2_increment"],
        "n_hosts": primary["n_hosts"],
        "n_host_days": primary["n_host_days"],
        "min_days_threshold": PRIMARY_MIN_DAYS,
        "sensitivity": sensitivity,
        "tenure_days": tenure_summary,
    }


def _analyze_threshold(
    panel: pd.DataFrame,
    threshold: int,
) -> dict[str, int | float]:
    tenure = panel.groupby("machine_id")["collected_day"].nunique()
    eligible_hosts = tenure.loc[tenure >= threshold].index
    eligible = panel.loc[panel["machine_id"].isin(eligible_hosts)].copy()
    if eligible.empty:
        return {
            "threshold": threshold,
            "icc": 0.0,
            "fe_r2_increment": 0.0,
            "n_hosts": 0,
            "n_host_days": 0,
        }

    values = eligible[TARGET_COLUMN].to_numpy(dtype=float)
    day_means = eligible.groupby("collected_day")[TARGET_COLUMN].transform("mean")
    day_demeaned = eligible[TARGET_COLUMN] - day_means
    host_effects = day_demeaned.groupby(eligible["machine_id"]).transform("mean")
    residuals = day_demeaned - host_effects

    total_ss = float(np.square(values - values.mean()).sum())
    day_only_ss = float(np.square(day_demeaned.to_numpy(dtype=float)).sum())
    day_host_ss = float(np.square(residuals.to_numpy(dtype=float)).sum())
    fe_r2_increment = 0.0 if total_ss <= 0 else max(0.0, (day_only_ss - day_host_ss) / total_ss)

    host_variance = _sample_variance(host_effects.to_numpy(dtype=float))
    residual_variance = _sample_variance(residuals.to_numpy(dtype=float))
    variance_total = host_variance + residual_variance
    icc = host_variance / variance_total if variance_total > 0 else 0.0

    return {
        "threshold": threshold,
        "icc": float(icc),
        "fe_r2_increment": float(fe_r2_increment),
        "n_hosts": len(eligible_hosts),
        "n_host_days": len(eligible),
    }


def _sample_variance(values: Sequence[float] | np.ndarray) -> float:
    array = np.asarray(values, dtype=float)
    if len(array) < 2:
        return 0.0
    return float(np.var(array, ddof=1))


def _empty_result() -> dict[str, Any]:
    return {
        "icc": 0.0,
        "fe_r2_increment": 0.0,
        "n_hosts": 0,
        "n_host_days": 0,
        "min_days_threshold": PRIMARY_MIN_DAYS,
        "sensitivity": [
            {"threshold": threshold, "icc": 0.0, "n_hosts": 0}
            for threshold in SENSITIVITY_THRESHOLDS
        ],
        "tenure_days": {"min": 0, "median": 0.0, "max": 0},
    }
