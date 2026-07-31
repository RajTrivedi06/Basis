"use client";

import { useAskWidget } from "@/components/ask/AskWidgetContext";
import { AskTranscript } from "@/components/ask/AskTranscript";

export function AskPanel() {
  const {
    turns,
    sourcesExpanded,
    toggleSources,
    partialAnswer,
    partialCitations,
    streaming,
    error,
    handleRetry,
    rateLimitSeconds,
    formId,
    question,
    setQuestion,
    formDisabled,
    offline,
    handleSubmit,
  } = useAskWidget();

  const rateLimited = rateLimitSeconds != null && rateLimitSeconds > 0;

  return (
    <div className="ask-panel">
      <header className="ask-panel__header">
        <div>
          <div className="eyebrow mb-1">Ask Basis</div>
          <p className="ask-panel__lede">
            Questions grounded in public data and live aggregates. Not procurement advice.
          </p>
        </div>
      </header>

      <div className="ask-panel__transcript">
        <AskTranscript
          turns={turns}
          sourcesExpanded={sourcesExpanded}
          onToggleSources={toggleSources}
          partialAnswer={partialAnswer}
          partialCitations={partialCitations}
          streaming={streaming}
          error={error}
          onRetry={handleRetry}
        />
      </div>

      {rateLimited ? (
        <div className="ask-alert ask-alert--rate_limited" role="status">
          <p>
            Rate limit reached. Try again in{" "}
            <span className="mono num">{rateLimitSeconds}</span>s.
          </p>
        </div>
      ) : null}

      <form className="ask-form ask-form--drawer panel" onSubmit={handleSubmit} aria-labelledby={formId}>
        <div className="panel-hd">
          <label htmlFor={`${formId}-input`} id={formId} className="ask-form__label">
            Your question
          </label>
          {streaming ? <span className="ask-form__status caption">Streaming…</span> : null}
        </div>
        <div className="panel-body ask-form__body">
          <textarea
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
