"use client";

import { Reveal } from "./Reveal";

interface ChainNode {
  factor: "region" | "commitment" | "provider" | "bundle" | "residual";
  label: string;
  note: string;
  order: string;
}

const NODES: ChainNode[] = [
  {
    factor: "region",
    label: "Region",
    note: "Country, state, and locality after canonicalization.",
    order: "Step 1",
  },
  {
    factor: "commitment",
    label: "Commitment",
    note: "On-demand, spot, or reserved terms observed that day.",
    order: "Step 2",
  },
  {
    factor: "provider",
    label: "Provider",
    note: "Identity of the price source, after region & commitment.",
    order: "Step 3",
  },
  {
    factor: "bundle",
    label: "Bundle",
    note: "Bundled vCPU, RAM, and storage quartile traveling with the GPU.",
    order: "Step 4",
  },
  {
    factor: "residual",
    label: "Residual",
    note: "Everything those four observable factors cannot explain.",
    order: "Outcome",
  },
];

/**
 * Sequential-ANOVA chain visualization. The first four nodes use the muted
 * slate factor palette; the last node is residual amber — the page's only
 * non-subordinate hue. Each node fades in with staggered delay so the eye
 * reads the chain left-to-right.
 */
export function ModelChain() {
  return (
    <div className="chain" role="img" aria-label="Sequential ANOVA model order: region, commitment, provider, bundle, residual">
      {NODES.map((node, idx) => (
        <Reveal key={node.factor} delay={idx * 110}>
          <div
            className={`chain__node ${node.factor === "residual" ? "is-residual" : ""}`}
            data-factor={node.factor}
          >
            <div>
              <div className="chain__order">{node.order}</div>
              <div className="chain__label">{node.label}</div>
            </div>
            <div>
              <div className="chain__note">{node.note}</div>
              <div className="chain__swatch" aria-hidden />
            </div>
            <span className="chain__arrow" aria-hidden />
          </div>
        </Reveal>
      ))}
    </div>
  );
}
