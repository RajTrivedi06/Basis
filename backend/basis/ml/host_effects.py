"""Persistent Vast host-effect analysis specified by the ML design document §6.

The future implementation will estimate day and machine fixed effects plus the
documented ICC sensitivities. This scaffold deliberately performs no analysis.
"""

from typing import NoReturn


def analyze_host_effects(features: object) -> NoReturn:
    """Estimate persistent host effects from an already-extracted panel."""
    raise NotImplementedError("Host-effect analysis is not implemented until Stage 3.3")
