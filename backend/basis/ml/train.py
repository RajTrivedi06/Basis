"""Time-based cross-validation, model fitting, metrics, and SHAP.

Validation follows ``docs/analysis/ml-explainability-design.md`` §§4-5:
every split is made on ordered UTC days, never on rows. The final ten
distinct days are reserved for one holdout evaluation and never enter
cross-validation or model selection.

Categorical columns use pandas ``category`` dtype with XGBoost's
``enable_categorical=True``. Category levels are learned on each training
partition only; unseen test or holdout levels become missing values and use
XGBoost's native missing-value routing.
"""

from __future__ import annotations

import logging
import math
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Final

import numpy as np
import pandas as pd  # type: ignore[import-untyped]
import xgboost as xgb
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from basis.db.models import BasisDecomposition
from basis.ml.features import TARGET_COLUMN, TRAINED_PROVIDERS

logger = logging.getLogger(__name__)

HOLDOUT_DAY_COUNT: Final = 10
CV_FOLD_COUNT: Final = 4
MAX_CV_TEST_DAYS: Final = 15
MIN_TRAINING_DAYS: Final = 20
DEFAULT_RANDOM_SEED: Final = 20260730
DEFAULT_N_ESTIMATORS: Final = 400
MAX_N_ESTIMATORS: Final = 600
EARLY_STOPPING_ROUNDS: Final = 30
SHAP_SAMPLE_CAP: Final = 2_000
SHAP_TOP_FEATURE_COUNT: Final = 20
GAIN_TOP_FEATURE_COUNT: Final = 15
PERMUTED_R2_MAX: Final = 0.05


class InsufficientDaysError(ValueError):
    """Raised when a frame cannot support the approved day-based split."""


class LeakageDetectedError(RuntimeError):
    """Raised when a required leakage guard fails."""


@dataclass(frozen=True)
class DayFold:
    """One expanding-window cross-validation fold."""

    fold: int
    train_days: tuple[date, ...]
    test_days: tuple[date, ...]


@dataclass(frozen=True)
class DaySplits:
    """The four CV folds and untouched final holdout days."""

    folds: tuple[DayFold, ...]
    pre_holdout_days: tuple[date, ...]
    holdout_days: tuple[date, ...]


@dataclass(frozen=True)
class FeatureEncoder:
    """Training-partition feature order and categorical levels."""

    columns: tuple[str, ...]
    categories: Mapping[str, tuple[str, ...]]

    @classmethod
    def fit(cls, frame: pd.DataFrame, columns: Sequence[str]) -> FeatureEncoder:
        categories: dict[str, tuple[str, ...]] = {}
        for column in columns:
            if _is_categorical_series(frame[column]):
                populated = frame[column].dropna().astype(str)
                categories[column] = tuple(sorted(populated.unique().tolist()))
        return cls(columns=tuple(columns), categories=categories)

    def transform(self, frame: pd.DataFrame) -> pd.DataFrame:
        transformed = pd.DataFrame(index=frame.index)
        for column in self.columns:
            if column in self.categories:
                values = frame[column].astype("string")
                known_values = values.where(
                    values.isin(self.categories[column]),
                    pd.NA,
                )
                transformed[column] = pd.Categorical(
                    known_values,
                    categories=self.categories[column],
                )
            else:
                transformed[column] = pd.to_numeric(frame[column], errors="coerce")
        return transformed


@dataclass
class TrainingResult:
    """All model outputs needed by the artifact and local writer."""

    model: xgb.XGBRegressor
    encoder: FeatureEncoder
    feature_columns: tuple[str, ...]
    splits: DaySplits
    metrics: dict[str, Any]
    shap_summary: dict[str, Any]
    sanity: dict[str, Any]


@dataclass(frozen=True)
class _FitResult:
    model: xgb.XGBRegressor
    encoder: FeatureEncoder
    encoded_test: pd.DataFrame
    predictions: np.ndarray


def build_day_splits(frame: pd.DataFrame) -> DaySplits:
    """Build four expanding-window folds plus the final ten-day holdout.

    The CV test window is capped at 15 days and shrinks only when the available
    history requires it. At least one initial training day is always retained.
    """
    if "collected_day" not in frame:
        raise ValueError("feature frame is missing collected_day")

    days = tuple(sorted({_as_date(value) for value in frame["collected_day"]}))
    if len(days) < MIN_TRAINING_DAYS:
        raise InsufficientDaysError(
            f"insufficient days: need at least {MIN_TRAINING_DAYS}, found {len(days)}"
        )

    pre_holdout_days = days[:-HOLDOUT_DAY_COUNT]
    holdout_days = days[-HOLDOUT_DAY_COUNT:]
    test_day_count = min(
        MAX_CV_TEST_DAYS,
        (len(pre_holdout_days) - 1) // CV_FOLD_COUNT,
    )
    if test_day_count < 1:
        raise InsufficientDaysError("insufficient pre-holdout days for four CV folds")

    initial_train_day_count = len(pre_holdout_days) - CV_FOLD_COUNT * test_day_count
    folds: list[DayFold] = []
    for fold_number in range(1, CV_FOLD_COUNT + 1):
        train_end = initial_train_day_count + (fold_number - 1) * test_day_count
        test_end = train_end + test_day_count
        train_days = pre_holdout_days[:train_end]
        test_days = pre_holdout_days[train_end:test_end]

        if not train_days or not test_days:
            raise InsufficientDaysError(f"fold {fold_number} has an empty day partition")
        assert max(train_days) < min(test_days), "time-based fold boundary violated"
        assert not set(train_days).intersection(test_days), "train/test days overlap"
        assert not set(train_days).intersection(holdout_days), "holdout entered training"
        assert not set(test_days).intersection(holdout_days), "holdout entered CV testing"

        folds.append(
            DayFold(
                fold=fold_number,
                train_days=train_days,
                test_days=test_days,
            )
        )

    return DaySplits(
        folds=tuple(folds),
        pre_holdout_days=pre_holdout_days,
        holdout_days=holdout_days,
    )


async def train(
    features: pd.DataFrame,
    session: AsyncSession,
    *,
    sku: str,
    trained_providers: Sequence[str] = TRAINED_PROVIDERS,
) -> TrainingResult:
    """Run the complete §4-§5 model pipeline and SELECT the ANOVA comparison."""
    result = fit_training_pipeline(
        features,
        trained_providers=trained_providers,
    )
    anova_explained = await _anova_explained_same_days(
        session,
        sku=sku,
        holdout_days=result.splits.holdout_days,
    )
    result.metrics["anova_explained_same_days"] = anova_explained
    result.metrics["gap"] = result.metrics["holdout"]["r2_oos"] - anova_explained
    return result


def fit_training_pipeline(
    features: pd.DataFrame,
    *,
    trained_providers: Sequence[str] = TRAINED_PROVIDERS,
    n_estimators: int = DEFAULT_N_ESTIMATORS,
) -> TrainingResult:
    """Fit CV folds, the untouched holdout model, sanity checks, and SHAP."""
    if not 1 <= n_estimators <= MAX_N_ESTIMATORS:
        raise ValueError(f"n_estimators must be between 1 and {MAX_N_ESTIMATORS}")
    feature_columns = _active_feature_columns(features)
    splits = build_day_splits(features)

    fold_metrics: list[dict[str, Any]] = []
    selected_tree_count = n_estimators
    for fold in splits.folds:
        train_frame = _rows_for_days(features, fold.train_days)
        test_frame = _rows_for_days(features, fold.test_days)
        use_early_stopping = fold.fold == CV_FOLD_COUNT
        fitted = _fit_model(
            train_frame,
            test_frame,
            feature_columns,
            n_estimators=n_estimators,
            early_stopping=use_early_stopping,
        )
        if use_early_stopping:
            selected_tree_count = _selected_tree_count(fitted.model, n_estimators)
        fold_metrics.append(
            _fold_metrics(
                fold,
                train_frame,
                test_frame,
                fitted.predictions,
            )
        )

    pre_holdout = _rows_for_days(features, splits.pre_holdout_days)
    holdout = _rows_for_days(features, splits.holdout_days)
    final_fit = _fit_model(
        pre_holdout,
        holdout,
        feature_columns,
        n_estimators=selected_tree_count,
        early_stopping=False,
    )

    holdout_metrics = _holdout_metrics(holdout, final_fit.predictions)
    by_provider = _provider_holdout_r2(
        holdout,
        final_fit.predictions,
        trained_providers=trained_providers,
    )
    robustness = _robustness_c_d(
        features,
        feature_columns,
        n_estimators=selected_tree_count,
    )
    sanity = _sanity_battery(
        pre_holdout,
        holdout,
        feature_columns,
        final_fit,
        n_estimators=selected_tree_count,
    )
    shap_summary = _shap_summary(
        final_fit.model,
        final_fit.encoded_test,
    )

    metrics: dict[str, Any] = {
        "folds": fold_metrics,
        "holdout": holdout_metrics,
        "r2_holdout_by_provider": by_provider,
        "anova_explained_same_days": 0.0,
        "gap": 0.0,
        "permuted_target_r2": sanity["permuted_target_r2"],
        "robustness_c_d": robustness,
        "sanity": sanity,
    }
    return TrainingResult(
        model=final_fit.model,
        encoder=final_fit.encoder,
        feature_columns=feature_columns,
        splits=splits,
        metrics=metrics,
        shap_summary=shap_summary,
        sanity=sanity,
    )


def evaluate_real_and_permuted_holdout(
    features: pd.DataFrame,
    *,
    n_estimators: int = 120,
) -> tuple[float, float]:
    """Return real and permuted-target holdout R² for a synthetic guard test."""
    columns = _active_feature_columns(features)
    splits = build_day_splits(features)
    train_frame = _rows_for_days(features, splits.pre_holdout_days)
    holdout = _rows_for_days(features, splits.holdout_days)
    fitted = _fit_model(
        train_frame,
        holdout,
        columns,
        n_estimators=n_estimators,
        early_stopping=False,
    )
    real_r2 = _pooled_r2(
        holdout[TARGET_COLUMN].to_numpy(dtype=float),
        fitted.predictions,
    )
    permuted_r2 = _permuted_target_r2(
        train_frame,
        holdout,
        columns,
        fitted.encoder,
        n_estimators=n_estimators,
    )
    return real_r2, permuted_r2


def _fit_model(
    train_frame: pd.DataFrame,
    test_frame: pd.DataFrame,
    feature_columns: Sequence[str],
    *,
    n_estimators: int,
    early_stopping: bool,
) -> _FitResult:
    encoder = FeatureEncoder.fit(train_frame, feature_columns)
    encoded_train = encoder.transform(train_frame)
    encoded_test = encoder.transform(test_frame)
    model = _new_model(
        n_estimators=n_estimators,
        early_stopping=early_stopping,
    )
    fit_kwargs: dict[str, Any] = {"verbose": False}
    if early_stopping:
        # Only the final CV fold receives an eval_set. The holdout is never an
        # early-stopping set and cannot influence the chosen tree count.
        fit_kwargs["eval_set"] = [(encoded_test, test_frame[TARGET_COLUMN].to_numpy(dtype=float))]
    model.fit(
        encoded_train,
        train_frame[TARGET_COLUMN].to_numpy(dtype=float),
        **fit_kwargs,
    )
    predictions = np.asarray(model.predict(encoded_test), dtype=float)
    return _FitResult(
        model=model,
        encoder=encoder,
        encoded_test=encoded_test,
        predictions=predictions,
    )


def _new_model(*, n_estimators: int, early_stopping: bool) -> xgb.XGBRegressor:
    kwargs: dict[str, Any] = {
        "objective": "reg:squarederror",
        "max_depth": 5,
        "n_estimators": n_estimators,
        "learning_rate": 0.05,
        "subsample": 0.9,
        "colsample_bytree": 0.9,
        "min_child_weight": 3,
        "reg_lambda": 1.0,
        "tree_method": "hist",
        "enable_categorical": True,
        "random_state": DEFAULT_RANDOM_SEED,
        "n_jobs": 1,
    }
    if early_stopping:
        kwargs["early_stopping_rounds"] = EARLY_STOPPING_ROUNDS
    return xgb.XGBRegressor(**kwargs)


def _fold_metrics(
    fold: DayFold,
    train_frame: pd.DataFrame,
    test_frame: pd.DataFrame,
    predictions: np.ndarray,
) -> dict[str, Any]:
    actual = test_frame[TARGET_COLUMN].to_numpy(dtype=float)
    return {
        "fold": fold.fold,
        "train_days": len(fold.train_days),
        "test_days": len(fold.test_days),
        "n_train": len(train_frame),
        "n_test": len(test_frame),
        "r2_oos": _day_demeaned_r2(actual, predictions, test_frame["collected_day"]),
        "rmse_log": _rmse(actual, predictions),
        "provider_mix_test": _provider_mix(test_frame),
    }


def _holdout_metrics(
    holdout: pd.DataFrame,
    predictions: np.ndarray,
) -> dict[str, Any]:
    actual = holdout[TARGET_COLUMN].to_numpy(dtype=float)
    return {
        "n_days": int(holdout["collected_day"].nunique()),
        "n_test": len(holdout),
        "r2_oos": _day_demeaned_r2(actual, predictions, holdout["collected_day"]),
        "r2_oos_pooled": _pooled_r2(actual, predictions),
        "rmse_log": _rmse(actual, predictions),
    }


def _provider_holdout_r2(
    holdout: pd.DataFrame,
    predictions: np.ndarray,
    *,
    trained_providers: Sequence[str],
) -> dict[str, float]:
    scores: dict[str, float] = {}
    provider_values = holdout["provider"].astype(str).to_numpy()
    actual = holdout[TARGET_COLUMN].to_numpy(dtype=float)
    for provider in trained_providers:
        mask = provider_values == provider
        if not mask.any():
            logger.warning(
                "Holdout has no rows for trained provider %s; omitting its R²",
                provider,
            )
            continue
        scores[provider] = _pooled_r2(actual[mask], predictions[mask])
    return scores


def _provider_mix(frame: pd.DataFrame) -> dict[str, float]:
    shares = frame["provider"].astype(str).value_counts(normalize=True).sort_index()
    return {provider: float(share) for provider, share in shares.items()}


def _robustness_c_d(
    features: pd.DataFrame,
    feature_columns: Sequence[str],
    *,
    n_estimators: int,
) -> dict[str, Any]:
    subset = features.loc[features["era"].isin(("C", "D"))].copy()
    days = tuple(sorted({_as_date(value) for value in subset["collected_day"]}))
    if len(days) < 2:
        logger.warning("C+D robustness fit has fewer than two days")
        return {"holdout_r2_oos": 0.0, "n_days": len(days)}

    holdout_count = min(HOLDOUT_DAY_COUNT, len(days) - 1)
    train_days = days[:-holdout_count]
    holdout_days = days[-holdout_count:]
    train_frame = _rows_for_days(subset, train_days)
    holdout = _rows_for_days(subset, holdout_days)
    fitted = _fit_model(
        train_frame,
        holdout,
        feature_columns,
        n_estimators=n_estimators,
        early_stopping=False,
    )
    return {
        "holdout_r2_oos": _day_demeaned_r2(
            holdout[TARGET_COLUMN].to_numpy(dtype=float),
            fitted.predictions,
            holdout["collected_day"],
        ),
        "n_days": len(days),
    }


def _sanity_battery(
    train_frame: pd.DataFrame,
    holdout: pd.DataFrame,
    feature_columns: Sequence[str],
    final_fit: _FitResult,
    *,
    n_estimators: int,
) -> dict[str, Any]:
    duplicate_count, duplicate_count_by_provider = _duplicate_rows_across_split(
        train_frame,
        holdout,
        feature_columns,
    )
    if duplicate_count:
        logger.warning(
            "Found %d identical feature-vector/target rows across train and "
            "holdout; by provider: %s. This can reflect persistent catalog prices.",
            duplicate_count,
            duplicate_count_by_provider,
        )

    permuted_r2 = _permuted_target_r2(
        train_frame,
        holdout,
        feature_columns,
        final_fit.encoder,
        n_estimators=n_estimators,
    )
    if permuted_r2 > PERMUTED_R2_MAX:
        raise LeakageDetectedError(
            f"LEAKAGE: permuted-target holdout R² {permuted_r2:.6f} exceeds {PERMUTED_R2_MAX:.2f}"
        )

    gain_importances = _gain_importances(final_fit.model)
    importance_warning = bool(gain_importances and gain_importances[0]["gain_share"] > 0.5)
    if importance_warning:
        logger.warning(
            "Single feature exceeds 50%% of total gain: %s",
            gain_importances[0],
        )

    prediction_summary = _prediction_summary(
        holdout[TARGET_COLUMN].to_numpy(dtype=float),
        final_fit.predictions,
    )
    return {
        "permuted_target_r2": permuted_r2,
        "duplicate_rows_across_split": duplicate_count,
        "duplicate_rows_across_split_by_provider": duplicate_count_by_provider,
        "importance_warning": importance_warning,
        "top_gain_importances": gain_importances,
        "holdout_pred_vs_actual": prediction_summary,
    }


def _permuted_target_r2(
    train_frame: pd.DataFrame,
    holdout: pd.DataFrame,
    feature_columns: Sequence[str],
    encoder: FeatureEncoder,
    *,
    n_estimators: int,
) -> float:
    rng = np.random.default_rng(DEFAULT_RANDOM_SEED)
    shuffled_target = rng.permutation(train_frame[TARGET_COLUMN].to_numpy(dtype=float))
    model = _new_model(n_estimators=n_estimators, early_stopping=False)
    model.fit(
        encoder.transform(train_frame),
        shuffled_target,
        verbose=False,
    )
    predictions = np.asarray(model.predict(encoder.transform(holdout)), dtype=float)
    return _pooled_r2(
        holdout[TARGET_COLUMN].to_numpy(dtype=float),
        predictions,
    )


def _duplicate_rows_across_split(
    train_frame: pd.DataFrame,
    holdout: pd.DataFrame,
    feature_columns: Sequence[str],
) -> tuple[int, dict[str, int]]:
    columns = [*feature_columns, TARGET_COLUMN]
    train_hashes = set(
        pd.util.hash_pandas_object(
            train_frame.loc[:, columns],
            index=False,
        ).astype("uint64")
    )
    holdout_hashes = pd.util.hash_pandas_object(
        holdout.loc[:, columns],
        index=False,
    ).astype("uint64")
    duplicate_mask = holdout_hashes.isin(train_hashes)
    duplicate_count = int(duplicate_mask.sum())
    by_provider = holdout.loc[duplicate_mask, "provider"].astype(str).value_counts().sort_index()
    duplicate_count_by_provider = {provider: int(count) for provider, count in by_provider.items()}
    return duplicate_count, duplicate_count_by_provider


def _gain_importances(model: xgb.XGBRegressor) -> list[dict[str, Any]]:
    raw = model.get_booster().get_score(importance_type="gain")
    total = float(sum(raw.values()))
    if total <= 0:
        return []
    ranked = sorted(raw.items(), key=lambda item: (-item[1], item[0]))
    return [
        {"feature": feature, "gain_share": float(gain / total)}
        for feature, gain in ranked[:GAIN_TOP_FEATURE_COUNT]
    ]


def _prediction_summary(actual: np.ndarray, predicted: np.ndarray) -> dict[str, float]:
    if len(actual) >= 2 and np.std(actual) > 0 and np.std(predicted) > 0:
        correlation = float(np.corrcoef(actual, predicted)[0, 1])
    else:
        correlation = 0.0
    residuals = actual - predicted
    p10, p50, p90 = np.quantile(residuals, [0.1, 0.5, 0.9])
    return {
        "corr": correlation,
        "residual_p10": float(p10),
        "residual_p50": float(p50),
        "residual_p90": float(p90),
    }


def _shap_summary(
    model: xgb.XGBRegressor,
    encoded_holdout: pd.DataFrame,
) -> dict[str, Any]:
    import shap  # type: ignore[import-untyped]

    sample_count = min(len(encoded_holdout), SHAP_SAMPLE_CAP)
    sample = encoded_holdout.sample(
        n=sample_count,
        random_state=DEFAULT_RANDOM_SEED,
    )
    explainer = shap.TreeExplainer(model)
    values = np.asarray(explainer.shap_values(sample), dtype=float)
    mean_absolute = np.abs(values).mean(axis=0)
    ranked = sorted(
        zip(sample.columns, mean_absolute, strict=True),
        key=lambda item: (-item[1], item[0]),
    )[:SHAP_TOP_FEATURE_COUNT]
    return {
        "n_sample": sample_count,
        "top_features": [
            {
                "rank": rank,
                "feature": feature,
                "mean_abs_shap": float(value),
            }
            for rank, (feature, value) in enumerate(ranked, start=1)
        ],
    }


async def _anova_explained_same_days(
    session: AsyncSession,
    *,
    sku: str,
    holdout_days: Sequence[date],
) -> float:
    rows = (
        await session.execute(
            select(
                BasisDecomposition.date,
                BasisDecomposition.total_variance,
                BasisDecomposition.residual_variance,
            ).where(
                BasisDecomposition.gpu_sku == sku,
                BasisDecomposition.date.in_(holdout_days),
            )
        )
    ).all()
    by_day = {row.date: (float(row.total_variance), float(row.residual_variance)) for row in rows}
    missing_days = [day for day in holdout_days if day not in by_day]
    if missing_days:
        logger.warning(
            "ANOVA comparison missing holdout days; excluded from mean: %s",
            ", ".join(day.isoformat() for day in missing_days),
        )

    explained: list[float] = []
    for day in holdout_days:
        values = by_day.get(day)
        if values is None:
            continue
        total_variance, residual_variance = values
        if total_variance <= 0:
            logger.warning(
                "ANOVA comparison excludes zero-variance holdout day %s",
                day.isoformat(),
            )
            continue
        explained.append(1.0 - residual_variance / total_variance)
    if not explained:
        raise InsufficientDaysError("no usable ANOVA decomposition rows on holdout days")
    return float(np.mean(explained))


def _active_feature_columns(features: pd.DataFrame) -> tuple[str, ...]:
    from_attrs = features.attrs.get("feature_columns")
    if not isinstance(from_attrs, tuple) or not from_attrs:
        raise ValueError("feature frame is missing non-empty attrs['feature_columns']")
    missing = [column for column in from_attrs if column not in features]
    if missing:
        raise ValueError(f"active feature columns missing from frame: {missing}")
    if TARGET_COLUMN not in features:
        raise ValueError(f"feature frame is missing {TARGET_COLUMN}")
    return from_attrs


def _rows_for_days(frame: pd.DataFrame, days: Sequence[date]) -> pd.DataFrame:
    return frame.loc[frame["collected_day"].isin(days)].copy()


def _is_categorical_series(series: pd.Series) -> bool:
    dtype_name = str(series.dtype)
    return dtype_name in {"object", "str", "string", "bool", "boolean", "category"}


def _selected_tree_count(model: xgb.XGBRegressor, fallback: int) -> int:
    best_iteration = getattr(model, "best_iteration", None)
    if isinstance(best_iteration, int):
        return min(best_iteration + 1, fallback)
    return fallback


def _day_demeaned_r2(
    actual: np.ndarray,
    predicted: np.ndarray,
    days: pd.Series,
) -> float:
    actual_series = pd.Series(actual, index=days.index, dtype=float)
    day_means = actual_series.groupby(days).transform("mean").to_numpy(dtype=float)
    denominator = float(np.square(actual - day_means).sum())
    numerator = float(np.square(actual - predicted).sum())
    if denominator <= 0:
        return 1.0 if numerator <= 0 else 0.0
    return 1.0 - numerator / denominator


def _pooled_r2(actual: np.ndarray, predicted: np.ndarray) -> float:
    denominator = float(np.square(actual - actual.mean()).sum())
    numerator = float(np.square(actual - predicted).sum())
    if denominator <= 0:
        return 1.0 if numerator <= 0 else 0.0
    return 1.0 - numerator / denominator


def _rmse(actual: np.ndarray, predicted: np.ndarray) -> float:
    return math.sqrt(float(np.square(actual - predicted).mean()))


def _as_date(value: object) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        return date.fromisoformat(value)
    raise TypeError(f"collected_day must contain dates, got {type(value).__name__}")
