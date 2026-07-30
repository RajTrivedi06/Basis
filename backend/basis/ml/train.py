"""Time-based cross-validation, model fitting, and SHAP analysis.

Validation follows ``docs/analysis/ml-explainability-design.md`` §4: every
split is made on ordered UTC days, never on rows. The final ten distinct days
are reserved for one holdout evaluation and never enter cross-validation.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Final

import pandas as pd  # type: ignore[import-untyped]

HOLDOUT_DAY_COUNT: Final = 10
CV_FOLD_COUNT: Final = 4
MAX_CV_TEST_DAYS: Final = 15
MIN_TRAINING_DAYS: Final = 20


class InsufficientDaysError(ValueError):
    """Raised when a frame cannot support the approved day-based split."""


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


def _as_date(value: object) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        return date.fromisoformat(value)
    raise TypeError(f"collected_day must contain dates, got {type(value).__name__}")


def train(features: object) -> None:
    """Run time-based CV, final fitting, sanity checks, and SHAP.

    The full implementation lands in the next Task 3.3 milestone.
    """
    raise NotImplementedError("Training pipeline milestone is not implemented yet")
