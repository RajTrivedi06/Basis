"""Tests for silent optional Ask Basis tracing."""

from __future__ import annotations

import logging

from basis.rag.tracing import AskTracer


def test_missing_langfuse_keys_use_silent_noop(caplog) -> None:
    tracer = AskTracer()

    with caplog.at_level(logging.WARNING):
        with tracer.trace("What is Basis?") as trace:
            assert len(trace.trace_id) == 32
            assert trace.trace_url is None
            with trace.span("retrieval", input={"query": "What is Basis?"}) as span:
                span.update(output={"top": []})
        tracer.flush()

    assert caplog.records == []
