"""Feature extraction governed by ``docs/analysis/ml-explainability-design.md`` §3.

Extraction will be SELECT-only and will read provider payloads through the
canonical-offer foreign-key join required by ADR-0006. Stage 3.2 will implement
the approved inventory; this scaffold intentionally contains no queries or
feature logic. The approved era domain is ``{era_0_backfill, A, B, C, D}``;
future derivation must map every date before 2026-04-26 to ``era_0_backfill``.
"""

from collections.abc import Sequence
from typing import NoReturn

ERA_LABELS = ("era_0_backfill", "A", "B", "C", "D")


def extract_features(*, sku: str, eras: Sequence[str] | None = None) -> NoReturn:
    """Extract the approved feature matrix for one SKU."""
    raise NotImplementedError("Feature extraction is not implemented until Stage 3.2")
