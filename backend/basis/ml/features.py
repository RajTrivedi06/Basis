"""Feature extraction governed by ``docs/analysis/ml-explainability-design.md`` §3.

Extraction will be SELECT-only and will read provider payloads through the
canonical-offer foreign-key join required by ADR-0006. Stage 3.2 will implement
the approved inventory; this scaffold intentionally contains no queries or
feature logic.
"""

from collections.abc import Sequence
from typing import NoReturn


def extract_features(*, sku: str, eras: Sequence[str] | None = None) -> NoReturn:
    """Extract the approved feature matrix for one SKU."""
    raise NotImplementedError("Feature extraction is not implemented until Stage 3.2")
