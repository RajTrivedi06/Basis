import type { ExplainabilityArtifact } from "@/lib/mlExplainabilityTypes";
import { providerLabel } from "@/lib/providerLabel";
import { BoundBar } from "@/components/ml/BoundBar";
import { HostEffectsStat } from "@/components/ml/HostEffectsStat";
import { ShapFeaturesChart } from "@/components/ml/ShapFeaturesChart";

interface ExplainabilityContentProps {
  artifact: ExplainabilityArtifact;
}

/** ISO timestamp -> calendar date. The artifact is the only date source (A6). */
function artifactDate(timestamp: string): string {
  return timestamp.slice(0, 10);
}

export function ExplainabilityContent({ artifact }: ExplainabilityContentProps) {
  const { metadata, metrics, shap_summary, host_analysis, caveats } = artifact;

  return (
    <div className="space-y-8">
      <div className="panel p-[26px]">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
          <div className="eyebrow">The bound · residual-first</div>
          <div className="ml-meta">
            {metadata.sku} · {metrics.holdout.n_days}-day holdout · trained{" "}
            {artifactDate(metadata.trained_at)}
          </div>
        </div>

        <BoundBar
          anovaExplained={metrics.anova_explained_same_days}
          gbmR2={metrics.holdout.r2_oos}
          gap={metrics.gap}
          height={100}
        />

        <div className="mt-6 border-t border-[var(--line-lo)] pt-5">
          <div className="caption mb-3 text-[var(--ink-mid)]">
            Holdout R² by provider
          </div>
          <div className="flex flex-wrap gap-2.5">
            {Object.entries(metrics.r2_holdout_by_provider).map(
              ([provider, r2]) => (
                <span key={provider} className="ml-chip">
                  <span>{providerLabel(provider)}</span>
                  <span className="ml-chip__value">
                    {(r2 * 100).toFixed(1)}%
                  </span>
                </span>
              )
            )}
          </div>
          <p className="caption mt-3 max-w-[68ch] leading-relaxed">
            The bound is not evenly hard to reach: a provider whose listings
            carry more describable detail is easier to predict than one that
            posts a short catalog line.
          </p>
        </div>
      </div>

      <div className="panel p-[26px]">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-3">
          <div className="eyebrow">SHAP top features</div>
          <div className="ml-meta">n={shap_summary.n_sample} sample rows</div>
        </div>
        <p className="caption mb-4">
          Mean absolute attribution — how much each feature moves the
          model&apos;s predicted log-price, not whether it moves it up or down.
        </p>
        <ShapFeaturesChart features={shap_summary.top_features} />
      </div>

      <HostEffectsStat hostAnalysis={host_analysis} />

      <section
        className="rounded-[var(--r-md)] border border-[var(--residual-line)] bg-[var(--residual-bg)] p-5"
        aria-label="Mandatory caveats"
      >
        <h2 className="eyebrow mb-4" style={{ color: "var(--residual)" }}>
          Caveats — read before interpreting
        </h2>
        <ul className="space-y-3">
          {caveats.map((caveat) => (
            <li
              key={caveat}
              className="text-sm leading-relaxed text-[var(--ink)]"
            >
              {caveat}
            </li>
          ))}
        </ul>
        <p className="caption mt-4 border-t border-[var(--residual-line)] pt-3">
          Corpus through {metadata.corpus_through} ·{" "}
          {metadata.corpus_rows.toLocaleString()} rows · model trained{" "}
          {artifactDate(metadata.trained_at)}. Every figure on this page is read
          from that artifact, so a retrain moves them without a copy edit.
        </p>
      </section>
    </div>
  );
}

export function ExplainabilityEmptyState() {
  return (
    <div className="panel p-[26px]">
      <div className="mono text-[12px] uppercase tracking-[0.1em] text-[var(--ink-mid)]">
        Results not yet published
      </div>
      <p className="caption mt-3 max-w-[720px] leading-relaxed">
        The ML explainability artifact has not been uploaded yet, or the API
        could not reach it. This section will populate automatically once the
        training run completes and the artifact is served from{" "}
        <span className="mono text-[var(--ink)]">GET /api/ml/explainability</span>.
      </p>
    </div>
  );
}

export function ExplainabilityLoadingState() {
  return (
    <div className="panel p-[26px]">
      <div className="mono text-[12px] uppercase tracking-[0.1em] text-[var(--ink-mid)]">
        Loading explainability results…
      </div>
      <p className="caption mt-3 text-[var(--ink-dim)]">
        Fetching the precomputed artifact from the API.
      </p>
    </div>
  );
}
