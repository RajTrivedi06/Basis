"""Commitment type normalization.

Maps provider-specific commitment/pricing tier labels to canonical types.
Our canonical types:
  on_demand    — pay as you go, no interruption risk
  spot         — interruptible, discounted
  reserved_1w  — 1 week commitment
  reserved_1m  — 1 month commitment
  reserved_3m  — 3 month commitment
  reserved_6m  — 6 month commitment
  reserved_1y  — 1 year commitment
  reserved_3y  — 3 year commitment
"""

from dataclasses import dataclass

# Most commitment types from our collectors are already clean.
# This table handles any that need remapping.
COMMITMENT_TYPE_MAP: dict[str, str] = {
    # Already canonical (pass through)
    "on_demand": "on_demand",
    "spot": "spot",
    "reserved_1w": "reserved_1w",
    "reserved_1m": "reserved_1m",
    "reserved_3m": "reserved_3m",
    "reserved_6m": "reserved_6m",
    "reserved_1y": "reserved_1y",
    "reserved_3y": "reserved_3y",

    # Alternate forms
    "on-demand": "on_demand",
    "interruptible": "spot",
    "bid": "spot",
    "preemptible": "spot",
}


def canonicalize_commitment(reported_type: str | None) -> str:
    """Map a provider-reported commitment type to a canonical type.

    Defaults to 'on_demand' if the type is None or unrecognized.
    """
    if not reported_type:
        return "on_demand"
    return COMMITMENT_TYPE_MAP.get(reported_type, reported_type)


@dataclass
class CommitmentCanonicalizationExplanation:
    """Attribution for commitment-type normalization (read-path only).

    Produced by `explain_canonicalize_commitment`. Never consumed by the
    write path; see ADR 0004.
    """

    reported_type: str | None
    canonical_type: str
    # One of: "null_default" (None/empty input), "table_match" (in map),
    # "passthrough" (not in map but non-null — returned as-is).
    rule: str
    matched_key: str | None


def explain_canonicalize_commitment(
    reported_type: str | None,
) -> CommitmentCanonicalizationExplanation:
    """Return attribution for the canonicalize_commitment decision."""
    if not reported_type:
        return CommitmentCanonicalizationExplanation(
            reported_type=reported_type,
            canonical_type="on_demand",
            rule="null_default",
            matched_key=None,
        )
    if reported_type in COMMITMENT_TYPE_MAP:
        return CommitmentCanonicalizationExplanation(
            reported_type=reported_type,
            canonical_type=COMMITMENT_TYPE_MAP[reported_type],
            rule="table_match",
            matched_key=reported_type,
        )
    return CommitmentCanonicalizationExplanation(
        reported_type=reported_type,
        canonical_type=reported_type,
        rule="passthrough",
        matched_key=None,
    )
