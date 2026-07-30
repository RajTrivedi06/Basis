"use client";

import type { AskCitation } from "@/lib/askBasisTypes";
import { parseAnswerWithCitations } from "@/lib/askCitations";

type AskAnswerBodyProps = {
  answer: string;
  citations: AskCitation[];
  streaming?: boolean;
};

export function AskAnswerBody({ answer, citations, streaming }: AskAnswerBodyProps) {
  const segments = parseAnswerWithCitations(answer);

  return (
    <div className="ask-answer__body">
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          return <span key={`t-${index}`}>{segment.value}</span>;
        }

        const targetId = `ask-source-${segment.kind === "chunk" ? "C" : "T"}${segment.id}`;
        const resolved = citations.find(
          (c) => c.kind === segment.kind && c.id === segment.id
        );

        return (
          <sup key={`c-${index}`} className="ask-cite-wrap">
            <a
              href={`#${targetId}`}
              className="ask-cite mono"
              title={
                resolved?.kind === "chunk"
                  ? `${resolved.source_path ?? ""} — ${resolved.heading ?? ""}`
                  : resolved?.tool
                    ? `${resolved.tool} (live data)`
                    : segment.label
              }
            >
              {segment.label.replace(/[\[\]]/g, "")}
            </a>
          </sup>
        );
      })}
      {streaming ? <span className="ask-cursor" aria-hidden /> : null}
    </div>
  );
}
