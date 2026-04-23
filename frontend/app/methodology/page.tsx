const ARTICLE_STYLE = {
  fontFamily: "var(--f-serif)",
  fontSize: 17,
  lineHeight: 1.72,
  color: "var(--ink-mid)",
} as const;

const HEADING_STYLE = {
  margin: "0 0 14px",
  color: "var(--ink-hi)",
  fontWeight: 400,
  fontSize: 24,
  letterSpacing: "-0.01em",
} as const;

const PARAGRAPH_STYLE = {
  margin: "0 0 18px",
} as const;

export default function MethodologyPage() {
  return (
    <div className="page-wide fade-up">
      <section className="max-w-[780px] pb-2 pt-9">
        <div className="eyebrow mb-2.5">08 · Methodology</div>
        <h1 className="display m-0 text-[clamp(2.5rem,5vw,3rem)] font-normal leading-[1.05] tracking-[-0.02em] text-[var(--ink-hi)]">
          Methodology
        </h1>
        <p className="caption mt-3 max-w-[640px]">
          Basis is a variance-accounting study, not a forecasting engine. The
          rules stay explicit because interpretability is part of the claim.
        </p>
      </section>

      <div className="max-w-[780px]" style={ARTICLE_STYLE}>
        <MethodSection title="Data collection">
          <p style={PARAGRAPH_STYLE}>
            <span style={{ color: "var(--ink-hi)" }}>Basis</span> is a
            public-data study measuring how fungible GPU compute really is
            across cloud providers. It collects quoted prices, normalizes them
            into a canonical schema, and decomposes observed price variance
            into observable factors and a residual. The residual is the
            headline finding.
          </p>
          <p style={PARAGRAPH_STYLE}>
            Four providers are collected twice daily: Vast.ai (REST), RunPod
            (GraphQL), AWS EC2 Spot (boto3), and TensorDock (REST). Lambda
            Labs was considered but dropped because its free API key now
            requires a payment method on file, which violates the study&apos;s
            zero-data-cost constraint.
          </p>
          <p style={PARAGRAPH_STYLE}>
            Every collector writes its full provider response to{" "}
            <span className="mono text-[14px] text-[var(--ink)]">
              raw_observations
            </span>{" "}
            as a JSONB blob. Raw rows are immutable, never updated and never
            deleted, so the normalized layer can always be regenerated from
            source truth.
          </p>
        </MethodSection>

        <MethodSection title="Canonical schema">
          <p style={PARAGRAPH_STYLE}>
            The normalization layer projects each raw observation into a{" "}
            <span className="mono text-[14px] text-[var(--ink)]">
              canonical_offer
            </span>{" "}
            row with standardized fields: canonical GPU SKU (for example{" "}
            <span className="mono text-[14px] text-[var(--ink)]">
              h100_sxm_80gb
            </span>
            ), canonical commitment type (
            <span className="mono text-[14px] text-[var(--ink)]">
              on_demand
            </span>
            ,{" "}
            <span className="mono text-[14px] text-[var(--ink)]">spot</span>,{" "}
            <span className="mono text-[14px] text-[var(--ink)]">
              reserved_*
            </span>
            ), country/state/city region, and bundled vCPU/RAM/storage.
          </p>
          <p style={PARAGRAPH_STYLE}>
            Unknown GPU names are skipped and logged, not guessed, and missing
            factor values remain a distinct{" "}
            <span className="pill-unknown">UNKNOWN</span> group rather than
            being imputed away. Conservative normalization preserves the
            residual instead of laundering ambiguity into &ldquo;region&rdquo;
            or &ldquo;bundle.&rdquo;
          </p>
        </MethodSection>

        <MethodSection title="Dispersion metrics">
          <p style={PARAGRAPH_STYLE}>
            For each{" "}
            <span className="mono text-[14px] text-[var(--ink)]">
              (date, gpu_sku)
            </span>{" "}
            with at least three offers, Basis computes median, 25th
            percentile, 75th percentile, and observation count, both across
            all providers and per-provider. These live in{" "}
            <span className="mono text-[14px] text-[var(--ink)]">
              daily_aggregates
            </span>{" "}
            and power the time-series pages.
          </p>
        </MethodSection>

        <MethodSection title="Basis decomposition">
          <p style={PARAGRAPH_STYLE}>
            For each{" "}
            <span className="mono text-[14px] text-[var(--ink)]">
              (date, gpu_sku)
            </span>{" "}
            with at least five offers, Basis runs a sequential ANOVA on
            log-prices in the fixed model order shown in the UI:
          </p>

          <div className="panel mb-[18px] p-4">
            <div className="mono text-[13px] text-[var(--ink)]">
              region → commitment → provider → bundle → residual
            </div>
          </div>

          <p style={PARAGRAPH_STYLE}>
            Each factor&apos;s attribution is the additional sum-of-squares
            explained after conditioning on all prior factors. The residual is{" "}
            <span className="mono text-[14px] text-[var(--ink)]">
              total_variance − Σ attributions
            </span>
            .
          </p>
          <p style={PARAGRAPH_STYLE}>
            <span style={{ color: "var(--ink-hi)" }}>Order dependence.</span>{" "}
            Sequential ANOVA is order-dependent: a different order
            redistributes factor attributions, but leaves the residual
            unchanged. That is why the Basis page and the comparison section at
            the bottom both render in model order rather than prototype order.
          </p>
          <p style={PARAGRAPH_STYLE}>
            <span style={{ color: "var(--ink-hi)" }}>Why log-prices.</span>{" "}
            Price ratios, not absolute differences, are the meaningful
            fungibility metric. A 2× price multiplier at $1/hr vs $2/hr
            represents the same fungibility gap as 2× at $2/hr vs $4/hr; they
            should not be conflated in absolute-variance terms.
          </p>
        </MethodSection>

        <MethodSection title="Limitations">
          <ul className="m-0 list-disc space-y-3 pl-5">
            <li>
              <span style={{ color: "var(--ink-hi)" }}>
                Quoted, not transacted.
              </span>{" "}
              All prices here are public list prices. Enterprise-negotiated
              rates are not available without access to a transaction benchmark
              such as Ornn&apos;s OCPI.
            </li>
            <li>
              <span style={{ color: "var(--ink-hi)" }}>Selection bias.</span>{" "}
              Marketplace providers such as Vast.ai list many independent
              sellers; hyperscalers such as AWS list a small number of
              instance types. These are not like-for-like data generators.
            </li>
            <li>
              <span style={{ color: "var(--ink-hi)" }}>
                Temporal coverage.
              </span>{" "}
              The dataset currently depends on laptop-hosted cron. Gaps in the
              time series are possible and are not back-filled.
            </li>
            <li>
              <span style={{ color: "var(--ink-hi)" }}>
                Continuous factors.
              </span>{" "}
              Reliability scores, interconnect type, and datacenter tier are
              left in the residual by design. Rule-based conservative
              normalization means we do not price-adjust for fields we cannot
              audit confidently.
            </li>
          </ul>
        </MethodSection>

        <MethodSection title="What the residual means">
          <p style={PARAGRAPH_STYLE}>
            The residual variance is the portion of log-price dispersion that
            cannot be explained by region, commitment type, provider identity,
            or bundle composition. It represents the genuine basis risk a
            compute benchmark would have to absorb: the irreducible mismatch
            between a single reference price and what a specific buyer actually
            pays.
          </p>
          <p style={{ margin: 0 }}>
            Across three observation days in April 2026, H100 SXM 80GB
            residual variance ranged from 53% to 95% of total log-price
            variance. More data will refine these numbers; the range should
            narrow once a few weeks of consistent collection have accumulated.
          </p>
        </MethodSection>
      </div>
    </div>
  );
}

function MethodSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="pt-10">
      <h2 className="serif" style={HEADING_STYLE}>
        {title}
      </h2>
      {children}
    </section>
  );
}
