"use client";

import Link from "next/link";
import type { AskCitation } from "@/lib/askBasisTypes";
import {
  citationMarkerLabel,
  citationMarkerPrefix,
  formatAsOf,
  resolveDocHref,
} from "@/lib/askCitations";

type AskSourcesProps = {
  citations: AskCitation[];
  expanded: boolean;
  onToggle: () => void;
};

export function AskSources({ citations, expanded, onToggle }: AskSourcesProps) {
  if (citations.length === 0) return null;

  return (
    <section className="ask-sources" aria-label="Sources">
      <button
        type="button"
        className="ask-sources__toggle"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span className="ask-sources__label">Sources</span>
        <span className="ask-sources__count mono">{citations.length}</span>
        <span className="ask-sources__chevron" aria-hidden>
          {expanded ? "−" : "+"}
        </span>
      </button>

      {expanded ? (
        <ol className="ask-sources__list">
          {citations.map((citation) => {
            const label = citationMarkerLabel(citation.kind, citation.id);
            const href =
              citation.kind === "chunk" ? resolveDocHref(citation.source_path) : null;

            return (
              <li
                key={`${citation.kind}-${citation.id}-${citation.source_path ?? citation.tool}`}
                id={`ask-source-${citationMarkerPrefix(citation.kind)}${citation.id}`}
                className="ask-source"
              >
                <span className="ask-source__marker mono">{label}</span>

                {citation.kind === "chunk" ? (
                  <div className="ask-source__body">
                    {href ? (
                      <Link href={href} className="ask-source__link">
                        {citation.source_path}
                      </Link>
                    ) : (
                      <span className="ask-source__path mono">{citation.source_path}</span>
                    )}
                    {citation.heading ? (
                      <span className="ask-source__heading">{citation.heading}</span>
                    ) : null}
                  </div>
                ) : (
                  <div className="ask-source__body">
                    <span className="ask-source__tool mono">{citation.tool}</span>
                    <span className="ask-source__badge">live data</span>
                    {citation.as_of ? (
                      <span className="ask-source__as-of mono">
                        as of {formatAsOf(citation.as_of)}
                      </span>
                    ) : null}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}
