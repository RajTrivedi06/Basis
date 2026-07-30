"use client";

import type { AskError } from "@/lib/askBasisTypes";
import { AskAnswerBody } from "@/components/ask/AskAnswerBody";
import { AskSources } from "@/components/ask/AskSources";
import type { TranscriptTurn } from "@/lib/askBasisTypes";

type AskTranscriptProps = {
  turns: TranscriptTurn[];
  sourcesExpanded: Record<number, boolean>;
  onToggleSources: (turnIndex: number) => void;
  partialAnswer?: string | null;
  partialCitations?: TranscriptTurn["citations"];
  streaming?: boolean;
  error?: AskError | null;
  onRetry?: () => void;
};

export function AskTranscript({
  turns,
  sourcesExpanded,
  onToggleSources,
  partialAnswer,
  partialCitations = [],
  streaming,
  error,
  onRetry,
}: AskTranscriptProps) {
  return (
    <div className="ask-transcript" aria-live="polite" aria-relevant="additions text">
      {turns.map((turn, index) => (
        <article key={`turn-${index}`} className="ask-turn">
          <div className="ask-turn__question">
            <span className="ask-turn__label eyebrow">Question</span>
            <p className="ask-turn__q">{turn.question}</p>
          </div>
          <div className="ask-turn__answer">
            <span className="ask-turn__label eyebrow">Answer</span>
            <AskAnswerBody answer={turn.answer} citations={turn.citations} />
            <AskSources
              citations={turn.citations}
              expanded={sourcesExpanded[index] ?? false}
              onToggle={() => onToggleSources(index)}
            />
            {turn.usage ? (
              <p className="ask-turn__meta mono">
                <span className="num">{turn.usage.input_tokens}</span> in ·{" "}
                <span className="num">{turn.usage.output_tokens}</span> out
              </p>
            ) : null}
          </div>
        </article>
      ))}

      {partialAnswer != null && partialAnswer.length > 0 ? (
        <article className="ask-turn ask-turn--partial">
          <div className="ask-turn__answer">
            <span className="ask-turn__label eyebrow">
              {streaming ? "Answering" : "Partial answer"}
            </span>
            <AskAnswerBody
              answer={partialAnswer}
              citations={partialCitations}
              streaming={streaming}
            />
          </div>
        </article>
      ) : null}

      {error ? (
        <div
          className={`ask-alert ask-alert--${error.code}`}
          role={error.code === "rate_limited" ? "status" : "alert"}
        >
          <p>{error.message}</p>
          {error.code === "network" && onRetry ? (
            <button type="button" className="btn ghost ask-alert__retry" onClick={onRetry}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
