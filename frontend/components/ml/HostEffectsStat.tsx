"use client";

import { useState, type ReactNode } from "react";
import { GlossaryTerm } from "@/components/glossary/GlossaryTerm";
import type { HostAnalysis } from "@/lib/mlExplainabilityTypes";

interface HostEffectsStatProps {
  hostAnalysis: HostAnalysis;
}

export function HostEffectsStat({ hostAnalysis }: HostEffectsStatProps) {
  const [expanded, setExpanded] = useState(false);
  const {
    icc,
    fe_r2_increment,
    n_hosts,
    n_host_days,
    min_days_threshold,
    sensitivity,
    tenure_days,
  } = hostAnalysis;

  return (
    <div className="panel p-[26px]">
      <div className="eyebrow mb-2">Vast host identity (on-demand panel)</div>
      <p className="caption max-w-[68ch] leading-relaxed">
        How much of the leftover variation stays attached to the same specific
        machines from one day to the next — identity, not specification.
      </p>

      <div className="ml-statrow ml-statrow--four">
        <HostMetric
          label={<GlossaryTerm term="icc">ICC</GlossaryTerm>}
          value={icc.toFixed(3)}
          residual
        />
        <HostMetric
          label="Hosts (≥ threshold)"
          value={String(n_hosts)}
          detail={`threshold ${min_days_threshold} observed days`}
        />
        <HostMetric label="Host-days" value={String(n_host_days)} />
        <HostMetric
          label="FE R² increment"
          value={fe_r2_increment.toFixed(3)}
          detail="host identity over day-only"
        />
      </div>

      <div className="caption mt-4 text-[var(--ink-mid)]">
        Tenure (days): min {tenure_days.min} · median {tenure_days.median} · max{" "}
        {tenure_days.max}
      </div>

      <div className="mt-4 border-t border-[var(--line-lo)] pt-3">
        <button
          type="button"
          className="caption text-left text-[var(--ink-mid)] underline-offset-2 hover:text-[var(--ink)] hover:underline"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
        >
          {expanded ? "Hide" : "Show"} ICC sensitivity by host tenure threshold
        </button>

        {expanded && (
          <ul className="mt-3 space-y-2">
            <li className="caption mono text-[var(--ink)]">
              Primary (≥ {min_days_threshold} days): ICC {icc.toFixed(3)} · n=
              {n_hosts} hosts
            </li>
            {sensitivity.map((row) => (
              <li
                key={row.threshold}
                className="caption mono text-[var(--ink-mid)]"
              >
                ≥ {row.threshold} days: ICC {row.icc.toFixed(3)} · n=
                {row.n_hosts} hosts
              </li>
            ))}
          </ul>
        )}

        {!expanded && (
          <p className="caption mt-2 text-[var(--ink-dim)]">
            Sensitivity at ≥{sensitivity.map((s) => s.threshold).join(", ≥")}{" "}
            days available — expand to view all ICC values.
          </p>
        )}
      </div>
    </div>
  );
}

function HostMetric({
  label,
  value,
  detail,
  residual = false,
}: {
  label: ReactNode;
  value: string;
  detail?: string;
  residual?: boolean;
}) {
  return (
    <div className="ml-statrow__cell">
      <div
        className={`ml-statrow__value${residual ? " is-residual" : ""}`}
      >
        {value}
      </div>
      <div className="ml-statrow__label">{label}</div>
      {detail ? (
        <div className="caption mt-1 text-[var(--ink-dim)]">{detail}</div>
      ) : null}
    </div>
  );
}
