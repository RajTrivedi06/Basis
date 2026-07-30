"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { AskCitation, AskError, TranscriptTurn } from "@/lib/askBasisTypes";
import { AskError } from "@/lib/askBasisTypes";
import { capHistory, streamAsk } from "@/lib/askBasis";
import { AskTranscript } from "@/components/ask/AskTranscript";

type AskPageClientProps = {
  initialRateLimitSeconds?: number;
};

export function AskPageClient({ initialRateLimitSeconds }: AskPageClientProps) {
  const formId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [partialAnswer, setPartialAnswer] = useState<string | null>(null);
  const [partialCitations, setPartialCitations] = useState<AskCitation[]>([]);
  const [error, setError] = useState<AskError | null>(null);
  const [sourcesExpanded, setSourcesExpanded] = useState<Record<number, boolean>>({});
  const [rateLimitSeconds, setRateLimitSeconds] = useState<number | null>(
    initialRateLimitSeconds ?? null
  );
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (rateLimitSeconds == null || rateLimitSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setRateLimitSeconds((prev) => {
        if (prev == null || prev <= 1) return null;
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [rateLimitSeconds]);

  const history = capHistory(turns.map((t) => ({ q: t.question, a: t.answer })));

  async function submitQuestion(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setError(null);
    setStreaming(true);
    setPartialAnswer("");
    setPartialCitations([]);
    setLastQuestion(trimmed);
    setQuestion("");

    let streamed = "";
    let finalTurn: TranscriptTurn | null = null;

    try {
      for await (const event of streamAsk(trimmed, history, controller.signal)) {
        if (event.type === "token") {
          streamed += event.token;
          setPartialAnswer(streamed);
        } else if (event.type === "done") {
          finalTurn = {
            question: trimmed,
            answer: event.response.answer,
            citations: event.response.citations,
            usage: event.response.usage,
          };
          setPartialAnswer(null);
          setPartialCitations([]);
        } else if (event.type === "error") {
          setError(event.error);
          if (event.error.code === "rate_limited" && event.error.retryAfterSeconds != null) {
            setRateLimitSeconds(event.error.retryAfterSeconds);
          }
          if (streamed.length > 0) {
            setPartialAnswer(streamed);
          }
          break;
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      if (streamed.length > 0) {
        setPartialAnswer(streamed);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }

    if (finalTurn) {
      setTurns((prev) => [...prev, finalTurn!]);
      setSourcesExpanded((prev) => ({
        ...prev,
        [turns.length]: finalTurn!.citations.length > 0,
      }));
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!question.trim()) {
      setError(
        new AskError("Enter a question about Basis data or methodology.", "bad_request")
      );
      return;
    }
    void submitQuestion(question);
  }

  function handleRetry() {
    if (lastQuestion) void submitQuestion(lastQuestion);
  }

  const rateLimited = rateLimitSeconds != null && rateLimitSeconds > 0;
  const offline = error?.code === "offline";
  const formDisabled = rateLimited || offline;

  return (
    <div className="page-wide fade-up ask-page">
      <header className="ask-header max-w-[760px]">
        <div className="eyebrow mb-2.5">Ask Basis</div>
        <h1 className="text-2xl font-medium text-[var(--ink-hi)] sm:text-3xl">
          Questions grounded in public data
        </h1>
        <p className="mt-4 max-w-[68ch] text-sm leading-relaxed text-[var(--ink-mid)]">
          Answers cite project documentation and live aggregates. This is a research
          interface — not procurement advice. Numbers render in monospace; sources are
          linked inline.
        </p>
      </header>

      <AskTranscript
        turns={turns}
        sourcesExpanded={sourcesExpanded}
        onToggleSources={(index) =>
          setSourcesExpanded((prev) => ({ ...prev, [index]: !prev[index] }))
        }
        partialAnswer={partialAnswer}
        partialCitations={partialCitations}
        streaming={streaming}
        error={error}
        onRetry={handleRetry}
      />

      {rateLimited ? (
        <div className="ask-alert ask-alert--rate_limited" role="status">
          <p>
            Rate limit reached. Try again in{" "}
            <span className="mono num">{rateLimitSeconds}</span>s.
          </p>
        </div>
      ) : null}

      <form className="ask-form panel" onSubmit={handleSubmit} aria-labelledby={formId}>
        <div className="panel-hd">
          <label htmlFor={`${formId}-input`} id={formId} className="ask-form__label">
            Your question
          </label>
          {streaming ? (
            <span className="ask-form__status caption">Streaming…</span>
          ) : null}
        </div>
        <div className="panel-body ask-form__body">
          <textarea
            ref={inputRef}
            id={`${formId}-input`}
            className="ask-form__input"
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. What share of H100-SXM variance is residual after normalization?"
            disabled={formDisabled}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <div className="ask-form__actions">
            <button
              type="submit"
              className="btn primary"
              disabled={formDisabled || !question.trim()}
            >
              Ask
            </button>
            {offline ? (
              <span className="caption ask-form__hint">Ask Basis is offline.</span>
            ) : null}
          </div>
        </div>
      </form>
    </div>
  );
}
