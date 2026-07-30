"""Time-based cross-validation, model fitting, and SHAP analysis.

The implementation is deferred to Stage 3.3 and must follow
``docs/analysis/ml-explainability-design.md`` §4: validation splits are based
only on ordered UTC days, never random row splits.
"""

from typing import NoReturn


def train(features: object) -> NoReturn:
    """Run time-based CV, fit the final model, and compute SHAP values."""
    raise NotImplementedError("Model training is not implemented until Stage 3.3")
