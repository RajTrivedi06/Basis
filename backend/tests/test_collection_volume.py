"""Unit tests for the collection-volume anomaly classifier.

Covers the pure decision logic (no database) that decides whether a provider's
latest collection run counts as a healthy volume, a collapse, or too-little-
history-to-judge.
"""

from scripts.check_collection_volume import classify


def test_healthy_run_is_not_an_alert():
    assert classify(3000, 3200, 28) == ("ok", False)


def test_vast_style_collapse_is_low_alert():
    # ~110 offers against a ~3200 baseline — the real Vast outage signature.
    status, is_alert = classify(110, 3200, 28)
    assert status == "low"
    assert is_alert is True


def test_zero_against_real_baseline_is_alert():
    status, is_alert = classify(0, 3200, 28)
    assert status == "zero"
    assert is_alert is True


def test_just_below_threshold_alerts():
    # 30% of 3000 is 900; 899 must trip.
    assert classify(899, 3000, 28)[0] == "low"


def test_just_above_threshold_is_ok():
    assert classify(900, 3000, 28) == ("ok", False)


def test_insufficient_history_is_not_an_alert():
    # A brand-new provider with too few prior runs shouldn't page.
    assert classify(5, 100, 2) == ("no_baseline", False)


def test_missing_baseline_is_not_an_alert():
    assert classify(5, None, 50) == ("no_baseline", False)


def test_zero_baseline_median_is_not_an_alert():
    # A provider dead long enough that its baseline is also zero is old news.
    assert classify(0, 0, 30) == ("no_baseline", False)
