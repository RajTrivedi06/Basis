"""GPU pricing data collectors, one per provider.

Each collector inherits from BaseCollector and implements the collect() method.
Register new collectors in the COLLECTORS list below.
"""

from basis.collectors.vast import VastCollector
from basis.collectors.runpod import RunPodCollector
from basis.collectors.aws_spot import AWSSpotCollector
from basis.collectors.lambda_labs import LambdaLabsCollector
from basis.collectors.tensordock import TensorDockCollector

COLLECTORS = [
    VastCollector,
    RunPodCollector,
    AWSSpotCollector,
    LambdaLabsCollector,
    TensorDockCollector,
]

__all__ = [
    "COLLECTORS",
    "VastCollector",
    "RunPodCollector",
    "AWSSpotCollector",
    "LambdaLabsCollector",
    "TensorDockCollector",
]
