"""Optional Langfuse tracing with a silent disabled path."""

from __future__ import annotations

import logging
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
logger = logging.getLogger(__name__)


def _warn_tracing_failure(operation: str, exc: Exception) -> None:
    logger.warning("Ask Basis tracing failed during %s: %s", operation, exc)


@contextmanager
def _safe_observation(
    client: Any,
    *,
    operation: str,
    kwargs: dict[str, Any],
) -> Iterator[Any | None]:
    """Enter and exit an SDK observation without masking application work."""
    try:
        manager = client.start_as_current_observation(**kwargs)
        observation = manager.__enter__()
    except Exception as exc:
        _warn_tracing_failure(operation, exc)
        yield None
        return

    try:
        yield observation
    except BaseException as application_error:
        try:
            manager.__exit__(
                type(application_error),
                application_error,
                application_error.__traceback__,
            )
        except Exception as exc:
            _warn_tracing_failure(f"{operation} cleanup", exc)
        raise
    else:
        try:
            manager.__exit__(None, None, None)
        except Exception as exc:
            _warn_tracing_failure(f"{operation} cleanup", exc)


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
            try:
                self._observation.update(
                    output=output,
                    metadata=metadata,
                    usage_details=usage_details,
                )
            except Exception as exc:
                _warn_tracing_failure("observation update", exc)


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
        with _safe_observation(
            self._client,
            operation=f"{name} observation",
            kwargs={
                "name": name,
                "as_type": as_type,
                "input": input,
                "model": model,
            },
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
        self._client: Langfuse | None = None
        if public_key and secret_key:
            try:
                self._client = Langfuse(
                    public_key=public_key,
                    secret_key=secret_key,
                    base_url=base_url,
                    environment=environment,
                )
            except Exception as exc:
                _warn_tracing_failure("client initialization", exc)

    @contextmanager
    def trace(self, question: str) -> Iterator[TraceSession]:
        if self._client is None:
            yield TraceSession(
                trace_id=uuid4().hex[:_TRACE_ID_HEX_LENGTH],
                trace_url=None,
                _client=None,
            )
            return
        with _safe_observation(
            self._client,
            operation="root observation",
            kwargs={
                "name": "ask-basis",
                "as_type": "agent",
                "input": {"question": question},
            },
        ) as root:
            if root is None:
                yield TraceSession(
                    trace_id=uuid4().hex[:_TRACE_ID_HEX_LENGTH],
                    trace_url=None,
                    _client=None,
                )
                return
            try:
                trace_id = str(root.trace_id)
            except Exception as exc:
                _warn_tracing_failure("trace id lookup", exc)
                yield TraceSession(
                    trace_id=uuid4().hex[:_TRACE_ID_HEX_LENGTH],
                    trace_url=None,
                    _client=None,
                )
                return
            try:
                trace_url = self._client.get_trace_url(trace_id=trace_id)
            except Exception as exc:
                _warn_tracing_failure("trace URL lookup", exc)
                trace_url = None
            yield TraceSession(
                trace_id=trace_id,
                trace_url=trace_url,
                _client=self._client,
            )

    def flush(self) -> None:
        if self._client is not None:
            try:
                self._client.flush()
            except Exception as exc:
                _warn_tracing_failure("flush", exc)
