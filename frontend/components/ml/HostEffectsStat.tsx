"use client";

import { useState } from "react";
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
    <div className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--panel-lo)] p-5">
      <div className="eyebrow mb-4">Vast host identity (on-demand panel)</div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <HostMetric label="ICC" value={icc.toFixed(3)} />
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

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 caption text-[var(--ink-mid)]">
        <span>
          Tenure (days): min {tenure_days.min} · median {tenure_days.median} ·
          max {tenure_days.max}
        </span>
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
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div>
      <div className="caption">{label}</div>
      <div className="mono mt-1 text-xl text-[var(--ink-hi)]">{value}</div>
      {detail ? (
        <div className="caption mt-1 text-[var(--ink-dim)]">{detail}</div>
      ) : null}
    </div>
  );
}
