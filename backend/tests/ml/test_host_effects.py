from datetime import date, timedelta

import numpy as np
import pandas as pd

from basis.ml.host_effects import analyze_host_effects


def test_host_effects_recovers_planted_icc() -> None:
    rng = np.random.default_rng(20260730)
    planted_icc = 0.7
    n_hosts = 80
    n_days = 30
    host_effects = rng.normal(0.0, np.sqrt(planted_icc), size=n_hosts)
    day_effects = rng.normal(0.0, 0.25, size=n_days)

    records: list[dict[str, object]] = []
    for host_index in range(n_hosts):
        for day_index in range(n_days):
            residual = float(rng.normal(0.0, np.sqrt(1.0 - planted_icc)))
            records.append(
                {
                    "provider": "vast",
                    "commitment_type": "on_demand",
                    "machine_id": host_index,
                    "collected_day": date(2026, 4, 1) + timedelta(days=day_index),
                    "y_log_price": (
                        float(host_effects[host_index]) + float(day_effects[day_index]) + residual
                    ),
                }
            )
            # A second slice must be averaged to the same host-day first.
            records.append({**records[-1]})

    result = analyze_host_effects(pd.DataFrame.from_records(records))

    assert result["n_hosts"] == n_hosts
    assert result["n_host_days"] == n_hosts * n_days
    assert abs(result["icc"] - planted_icc) < 0.1
    assert result["fe_r2_increment"] > 0
    assert result["tenure_days"] == {
        "min": n_days,
        "median": float(n_days),
        "max": n_days,
    }
    assert [item["threshold"] for item in result["sensitivity"]] == [5, 20]
