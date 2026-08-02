"use client";

import { Reveal } from "./Reveal";

interface Stage {
  num: string;
  title: string;
  body: string;
  tag: string;
}

const STAGES: Stage[] = [
  {
    num: "01",
    title: "Collect",
    body: "Async pulls from Vast.ai, RunPod, AWS EC2 Spot, and the Azure and GCP list catalogs — twice daily on a fixed cadence.",
    tag: "providers · 4",
  },
  {
    num: "02",
    title: "Store raw",
    body: "Each collector writes its full provider response as a JSONB blob. Rows are immutable and never deleted.",
    tag: "raw_observations",
  },
  {
    num: "03",
    title: "Normalize",
    body: "Project each row to a canonical_offer with standardized GPU SKU, region, commitment, and bundle.",
    tag: "canonical_offers",
  },
  {
    num: "04",
    title: "Aggregate",
    body: "For each (date, gpu_sku), compute median, IQR, and counts — both market-wide and per-provider.",
    tag: "daily_aggregates",
  },
  {
    num: "05",
    title: "Decompose",
    body: "Sequential ANOVA on log-prices attributes variance to observable factors; the rest is residual.",
    tag: "basis_decomposition",
  },
];

/**
 * Five-stage horizontal pipeline visualization. A numbered rail at the top
 * indicates the flow; cards below are uniform width AND uniform height (via
 * grid stretch + flex column) so the layout reads as a coherent sequence.
 * The final card is residual amber to echo the page's headline finding.
 */
export function PipelineDiagram() {
  return (
    <div
      className="pipeline"
      role="img"
      aria-label="Data pipeline: collect, store raw, normalize, aggregate, decompose"
    >
      <div className="pipeline__rail" aria-hidden>
        {STAGES.map((stage) => (
          <div key={stage.num} className="pipeline__rail-stop">
            <span className="pipeline__rail-dot">{stage.num}</span>
          </div>
        ))}
      </div>

      {STAGES.map((stage, idx) => {
        const isLast = idx === STAGES.length - 1;
        return (
          <Reveal key={stage.num} delay={idx * 90}>
            <div className={`pipe-node ${isLast ? "is-residual" : ""}`}>
              <div className="pipe-node__num">Stage {stage.num}</div>
              <div className="pipe-node__title">{stage.title}</div>
              <div className="pipe-node__body">{stage.body}</div>
              <div className="pipe-node__tag mono">{stage.tag}</div>
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}
