import subprocess
import sys
from pathlib import Path

from basis.ml.train import train

BACKEND_ROOT = Path(__file__).resolve().parents[2]


def test_train_is_importable() -> None:
    assert callable(train)


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
