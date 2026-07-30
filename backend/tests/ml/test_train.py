import subprocess
import sys
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

from basis.ml.features import ERA_LABELS
from basis.ml.train import HOLDOUT_DAY_COUNT, build_day_splits, train

BACKEND_ROOT = Path(__file__).resolve().parents[2]


def test_train_is_importable() -> None:
    assert callable(train)


def test_era_domain_includes_pre_cutover_backfill() -> None:
    assert ERA_LABELS == ("era_0_backfill", "A", "B", "C", "D")


def test_day_splits_keep_holdout_untouched_and_folds_ordered() -> None:
    first_day = date(2026, 4, 1)
    frame = pd.DataFrame(
        {
            "collected_day": [
                first_day + timedelta(days=offset) for offset in range(95) for _row in range(3)
            ]
        }
    )

    splits = build_day_splits(frame)

    assert len(splits.folds) == 4
    assert len(splits.holdout_days) == HOLDOUT_DAY_COUNT
    assert len(splits.pre_holdout_days) == 85
    assert [len(fold.train_days) for fold in splits.folds] == [25, 40, 55, 70]
    assert [len(fold.test_days) for fold in splits.folds] == [15, 15, 15, 15]

    holdout = set(splits.holdout_days)
    for fold in splits.folds:
        assert max(fold.train_days) < min(fold.test_days)
        assert not set(fold.train_days) & set(fold.test_days)
        assert not set(fold.train_days) & holdout
        assert not set(fold.test_days) & holdout


def test_run_train_help_exits_zero() -> None:
    result = subprocess.run(
        [sys.executable, str(BACKEND_ROOT / "run_train.py"), "--help"],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0
    assert "--sku" in result.stdout
    assert "--upload" in result.stdout
    assert "--eras" in result.stdout


def test_run_train_exits_not_implemented() -> None:
    result = subprocess.run(
        [sys.executable, str(BACKEND_ROOT / "run_train.py")],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 1
    assert result.stdout.strip() == "not implemented"
