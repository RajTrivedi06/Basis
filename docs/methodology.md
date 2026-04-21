---
title: Methodology
tags: [area:overview, audience:all, status:stub]
owner: Raj
last_updated: 2026-04-20
---

# Methodology

## Status: partial — methods locked, narrative pending Phase 6

As of 2026-04-20 the analytics layer ships and produces real numbers. The method sections below are frozen; the narrative and final findings sections will be filled in during Phase 6.

## Planned sections

1. **Data Collection** — sources (4 providers), cadence (twice daily), what's captured, what's not.
2. **Canonical Schema** — how raw observations become canonical offers; conservative mapping approach.
3. **Normalization Rules** — explicit per-provider rules for GPU names, regions, commitment types, bundles. Why rule-based, not ML (see [01-architecture/adr/0002-conservative-normalization.md](01-architecture/adr/0002-conservative-normalization.md)).
4. **Dispersion Metrics** — how price distribution is measured (median, IQR, CoV).
5. **Basis Decomposition** — ANOVA-style variance attribution; which factors, computed in what order.
6. **Limitations** — quoted prices vs. executed transactions; coverage gaps; selection bias in marketplace vs. hyperscaler offers.
7. **Interpretation** — what the residual variance means for benchmark design.

## Placeholder statement

As of 2026-04-20, with 9,979 canonical offers across 97 SKUs and 4 providers, **H100 SXM** shows a cross-provider range of $0.45–$6.88 per GPU-hour.

## Frozen method choices

### Decomposition model

**Sequential ANOVA on log-prices**, in the fixed factor order:

```
region → commitment → provider → bundle → residual
```

Rationale: most-exogenous (physical geography) to most-internal (bundle is correlated with provider identity and with commitment type). Log-prices are used because price ratios — not absolute differences — are the meaningful fungibility metric (a 2× multiplier at $1/hr vs $2/hr is the same fungibility gap as 2× at $2/hr vs $4/hr).

Total log-price variance is partitioned sequentially. Each factor's attribution is the additional sum-of-squares explained after conditioning on all prior factors. The residual is `total - sum(attributions)`.

**Order-dependence is a known property.** A different order (e.g., provider first) would redistribute attributions but leaves the residual unchanged. Reporting a second order is a nice-to-have (tracked in TASKS).

### Handling missing data

- **NULL region / commitment / provider** → assigned a distinct `"UNKNOWN"` label rather than dropped. This preserves observation counts and treats "missingness" as an honest category.
- **NULL bundle fields** → rows with all three bundle fields NULL get bundle label `"UNKNOWN"`. Rows with partial bundle data contribute what they have to a z-normalized composite score, then bucket into quartiles.

### Minimum-observation thresholds

- **Dispersion buckets** skipped when fewer than 3 offers (not enough signal to report percentiles).
- **Decomposition** skipped when a (date, gpu_sku) has fewer than 5 offers, or when a factor has fewer than 2 distinct values (no variance to attribute).

### What is not adjusted

Per [ADR-0002](01-architecture/adr/0002-conservative-normalization.md), no continuous adjustments are made. The normalization layer is strictly rule-based, and the analytics layer only groups and decomposes — it does not "predict what the price should be" and subtract.

## First-pass H100 SXM 80GB findings (2026-04-20)

| Date | Total var | Residual var | % Residual |
|------|-----------|--------------|------------|
| 2026-04-17 | 0.323 | 0.227 | **70.4%** |
| 2026-04-18 | 0.227 | 0.215 | **94.7%** |
| 2026-04-20 | 0.301 | 0.161 | **53.5%** |

Across three observation days, between 53% and 95% of H100 SXM log-price variance is unexplained by region, commitment type, provider identity, or bundle composition. This is the Basis phenomenon the project was built to quantify. Full narrative interpretation is deferred to Phase 6.

## Related

- [Project brief](project-brief.md)
- [System overview](01-architecture/system-overview.md)
- [ADR-002 on conservative normalization](01-architecture/adr/0002-conservative-normalization.md)
