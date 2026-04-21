export default function MethodologyPage() {
  return (
    <div className="prose prose-invert max-w-3xl">
      <h1>Methodology</h1>

      <p>
        Basis is a public-data study measuring how fungible GPU compute really
        is across cloud providers. It collects quoted prices, normalizes them
        into a canonical schema, and decomposes observed price variance into
        observable factors and a residual. The residual is the headline
        finding.
      </p>

      <h2>Data collection</h2>
      <p>
        Four providers are collected twice daily: Vast.ai (REST), RunPod
        (GraphQL), AWS EC2 Spot (boto3), and TensorDock (REST). Lambda Labs
        was considered but dropped — its free API key now requires a payment
        method on file, which violates the study&apos;s zero-data-cost
        constraint.
      </p>
      <p>
        Every collector writes its full provider response to{" "}
        <code>raw_observations</code> as a JSONB blob. Raw rows are immutable
        — never updated, never deleted — so the normalized layer can always
        be regenerated from source truth.
      </p>

      <h2>Canonical schema</h2>
      <p>
        The normalization layer projects each raw observation into a{" "}
        <code>canonical_offer</code> row with standardized fields: canonical
        GPU SKU (e.g., <code>h100_sxm_80gb</code>), canonical commitment type
        (<code>on_demand</code>, <code>spot</code>, <code>reserved_*</code>),
        country/state/city region, and bundled vCPU/RAM/storage. Unknown GPU
        names are skipped and logged, not guessed — a conservative choice
        documented in ADR-002.
      </p>

      <h2>Dispersion metrics</h2>
      <p>
        For each <code>(date, gpu_sku)</code> with ≥3 offers, Basis computes
        median, 25th percentile, 75th percentile, and observation count — both
        across all providers and per-provider. These are stored in{" "}
        <code>daily_aggregates</code> and power the time-series charts.
      </p>

      <h2>Basis decomposition</h2>
      <p>
        For each <code>(date, gpu_sku)</code> with ≥5 offers, Basis runs a
        sequential ANOVA on log-prices in the fixed factor order:
      </p>
      <pre className="rounded-md border border-gray-800 bg-gray-950 px-4 py-3 text-sm">
        region → commitment → provider → bundle → residual
      </pre>
      <p>
        Each factor&apos;s attribution is the additional sum-of-squares
        explained after conditioning on all prior factors. The residual is{" "}
        <code>total_variance − Σ attributions</code>.
      </p>
      <p>
        <strong>Order dependence.</strong> Sequential ANOVA is order-dependent:
        a different order redistributes attributions but leaves the residual
        unchanged. A future enhancement will report Type III (marginal)
        attributions so both &quot;region-first&quot; and
        &quot;provider-first&quot; residuals are visible.
      </p>
      <p>
        <strong>Why log-prices.</strong> Price ratios, not absolute
        differences, are the meaningful fungibility metric. A 2× price
        multiplier at $1/hr vs $2/hr represents the same fungibility gap as 2×
        at $2/hr vs $4/hr — they shouldn&apos;t be conflated in
        absolute-variance terms.
      </p>
      <p>
        <strong>NULL handling.</strong> Missing region / commitment / provider
        values are kept as a distinct <code>UNKNOWN</code> group rather than
        dropped. Missingness is an honest category, not a bug.
      </p>

      <h2>Limitations</h2>
      <ul>
        <li>
          <strong>Quoted, not transacted.</strong> All prices here are public
          list prices. Enterprise-negotiated rates are not available without
          subscription to a transaction benchmark like Ornn&apos;s OCPI.
        </li>
        <li>
          <strong>Selection bias.</strong> Marketplace providers (Vast.ai)
          list many independent sellers; hyperscalers (AWS) list a small
          number of instance types. These are not like-for-like data
          generators.
        </li>
        <li>
          <strong>Temporal coverage.</strong> Dependent on laptop-hosted cron.
          Gaps in the time series are possible and are not back-filled.
        </li>
        <li>
          <strong>Continuous factors.</strong> Reliability scores,
          interconnect type, and datacenter tier are left in the residual by
          design — rule-based conservative normalization means we do not
          price-adjust for them.
        </li>
      </ul>

      <h2>What the residual means</h2>
      <p>
        The residual variance is the portion of log-price dispersion that
        cannot be explained by region, commitment type, provider identity, or
        bundle composition. It represents the genuine basis risk a compute
        benchmark would have to absorb — the irreducible mismatch between a
        single reference price and what a specific buyer actually pays.
      </p>
      <p>
        Across three observation days in April 2026, H100 SXM 80GB residual
        variance ranged from 53% to 95% of total log-price variance. More data
        will refine these numbers; the range is expected to narrow once we
        have a few weeks of consistent collection.
      </p>
    </div>
  );
}
