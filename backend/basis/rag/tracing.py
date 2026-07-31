"""Optional Langfuse tracing with a silent disabled path."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any, Final, Literal
from uuid import uuid4

from langfuse import Langfuse

ObservationType = Literal[
    "span",
    "agent",
    "tool",
    "chain",
    "retriever",
    "generation",
]
_TRACE_ID_HEX_LENGTH: Final = 32


class TraceObservation:
    """Small update facade shared by real and no-op observations."""

    def __init__(self, observation: Any | None = None) -> None:
        self._observation = observation

    def update(
        self,
        *,
        output: Any | None = None,
        metadata: dict[str, Any] | None = None,
        usage_details: dict[str, int] | None = None,
    ) -> None:
        if self._observation is not None:
            self._observation.update(
                output=output,
                metadata=metadata,
                usage_details=usage_details,
            )


@dataclass(frozen=True)
class TraceSession:
    """One root trace and helpers for nested observations."""

    trace_id: str
    trace_url: str | None
    _client: Langfuse | None

    @contextmanager
    def span(
        self,
        name: str,
        *,
        as_type: ObservationType = "span",
        input: Any | None = None,
        model: str | None = None,
    ) -> Iterator[TraceObservation]:
        if self._client is None:
            yield TraceObservation()
            return
        with self._client.start_as_current_observation(
            name=name,
            as_type=as_type,
            input=input,
            model=model,
        ) as observation:
            yield TraceObservation(observation)


class AskTracer:
    """Create one Ask Basis trace when both Langfuse keys are configured."""

    def __init__(
        self,
        *,
        public_key: str = "",
        secret_key: str = "",
        base_url: str = "https://cloud.langfuse.com",
        environment: str = "dev",
    ) -> None:
        self._client = (
            Langfuse(
                public_key=public_key,
                secret_key=secret_key,
                base_url=base_url,
                environment=environment,
            )
            if public_key and secret_key
            else None
        )

    @contextmanager
    def trace(self, question: str) -> Iterator[TraceSession]:
        if self._client is None:
            yield TraceSession(
                trace_id=uuid4().hex[:_TRACE_ID_HEX_LENGTH],
                trace_url=None,
                _client=None,
            )
            return
        with self._client.start_as_current_observation(
            name="ask-basis",
            as_type="agent",
            input={"question": question},
        ) as root:
            trace_id = root.trace_id
            yield TraceSession(
                trace_id=trace_id,
                trace_url=self._client.get_trace_url(trace_id=trace_id),
                _client=self._client,
            )

    def flush(self) -> None:
        if self._client is not None:
            self._client.flush()
