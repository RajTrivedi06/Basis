"use client";

import { BracketMark, useDrawOnce } from "@/components/marks/BracketMark";

/** The diagram's reference-price gloss (variant 1b, adopted by the 1c ruling). */
export const BRACKET_REFERENCE_HINT =
  "Median quote · same SKU & collection day";

/** The diagram's single footnote line (variant 1b, adopted by the 1c ruling). */
export const BRACKET_FOOTNOTE =
  "Observed quotes only. Basis names what normalization cannot explain.";

export const BRACKET_BENCHMARK_LABEL = "REFERENCE PRICE";
export const BRACKET_PAID_LABEL = "QUOTED PRICE";

const BENCHMARK_Y = 52;
const PAID_Y = 162;
const LINE_X0 = 52;
const LINE_X1 = 308;

export interface BracketDiagramProps {
  /**
   * Live values for the two price lines. Omitted values render no figure at
   * all rather than a placeholder — nothing on this diagram is invented.
   */
  benchmarkValue?: string;
  paidValue?: string;
  /** Set false where the diagram sits under a caption that already says it. */
  showFootnote?: boolean;
  className?: string;
}

/**
 * The name-scene diagram (exploration variant 1c): the benchmark price, the
 * price actually paid, and the dimension bracket that measures the gap between
 * them — labelled *basis*.
 */
export function BracketDiagram({
  benchmarkValue,
  paidValue,
  showFootnote = true,
  className = "",
}: BracketDiagramProps) {
  const { ref, drawing } = useDrawOnce<HTMLElement>();

  return (
    <figure
      ref={ref}
      className={`bracket-diagram${drawing ? " is-bracket-drawing" : ""} ${className}`.trim()}
    >
      <svg
        className="bracket-diagram__plate"
        viewBox="0 0 452 216"
        role="img"
        aria-label="Two price lines (a reference price and a quoted price) with a dimension bracket measuring the gap between them, labelled basis."
      >
        <line
          x1={LINE_X0}
          y1={BENCHMARK_Y}
          x2={LINE_X1}
          y2={BENCHMARK_Y}
          className="bracket-mark__seg"
          style={{ "--bracket-delay": "0ms" } as React.CSSProperties}
          stroke="var(--ink)"
          strokeWidth={2.5}
          pathLength={1}
        />
        <text
          className="bracket-diagram__tag"
          x={LINE_X0}
          y={BENCHMARK_Y - 13}
        >
          {BRACKET_BENCHMARK_LABEL}
        </text>
        {benchmarkValue ? (
          <text
            className="bracket-diagram__value"
            x={LINE_X1}
            y={BENCHMARK_Y - 13}
            textAnchor="end"
          >
            {benchmarkValue}
          </text>
        ) : null}

        <line
          x1={LINE_X0}
          y1={PAID_Y}
          x2={LINE_X1}
          y2={PAID_Y}
          className="bracket-mark__seg"
          style={{ "--bracket-delay": "220ms" } as React.CSSProperties}
          stroke="var(--ink)"
          strokeWidth={2.5}
          pathLength={1}
        />
        <text className="bracket-diagram__tag" x={LINE_X0} y={PAID_Y + 20}>
          {BRACKET_PAID_LABEL}
        </text>
        {paidValue ? (
          <text
            className="bracket-diagram__value"
            x={LINE_X1}
            y={PAID_Y + 20}
            textAnchor="end"
          >
            {paidValue}
          </text>
        ) : null}

        <BracketMark
          spine={354}
          start={BENCHMARK_Y}
          length={PAID_Y - BENCHMARK_Y}
          leaderFrom={312}
          leaderTo={368}
          label="basis"
        />
      </svg>

      {showFootnote ? (
        <figcaption className="bracket-diagram__caption">
          <span className="bracket-diagram__hint">{BRACKET_REFERENCE_HINT}</span>
          <span className="bracket-diagram__footnote">{BRACKET_FOOTNOTE}</span>
        </figcaption>
      ) : null}
    </figure>
  );
}
