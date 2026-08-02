---
title: Methodology
tags: [area:overview, audience:all, status:active]
owner: Raj
last_updated: 2026-07-24
---

# Methodology

> **⚠ Headline under revision (2026-07-25).** The ~82% exclude-Vast figure cited below predates a 2026-07-03 structural break in the non-Vast baseline; the exclude-Vast gap has since inverted (≈ −4pp as of 07-23). See [analysis/2026-07-24-exclude-vast-collapse.md](analysis/2026-07-24-exclude-vast-collapse.md). Full treatment awaits the scheduled findings rewrite.

How quoted GPU prices become a residual-variance number, and what choices are frozen in the analytics layer. The narrative interpretation lives in [findings.md](findings.md); this file is the reference for *how* the numbers are computed.

**Temporal note.** Numbers cited below reflect the 77-day window 2026-04-26 → 2026-07-11 of post-cutover EC2 collection, refreshed 2026-07-11. The dashboard updates continuously, so live medians may differ by a few tenths of a pp. **Operational note (2026-07-24):** Vast collector auth (`VAST_API_KEY`) and per-provider volume alerting shipped 2026-07-12; TensorDock parked 2026-07-13. Collection today runs on 3 active providers — numbers below are unchanged until the next findings refresh.

Investigation report: [`analysis/2026-07-11-findings-refresh.md`](analysis/2026-07-11-findings-refresh.md). Prior refreshes: [`analysis/2026-06-24-findings-refresh.md`](analysis/2026-06-24-findings-refresh.md), [`analysis/2026-05-13-findings-refresh-analysis.md`](analysis/2026-05-13-findings-refresh-analysis.md).

## Summary

With 315,743 canonical offers across 4 providers and 96 SKUs, H100 SXM 80GB log-price variance over 77 days is **~60% unexplained** when all four providers are included and **~82% unexplained** when Vast.ai is excluded. Both numbers come from the same `compute_decompositions` function, applied to the same date range, with the only difference being whether Vast rows are filtered out. See [Provider-mix dependence](#provider-mix-dependence-and-the-vastai-robustness-check) below.

## Frozen method choices

### Decomposition model

**Sequential ANOVA on log-prices**, in the fixed factor order:

```
region → commitment → provider → bundle → residual
```

Rationale: most-exogenous (physical geography) to most-internal (bundle is correlated with provider identity and with commitment type). Log-prices are used because price ratios — not absolute differences — are the meaningful fungibility metric (a 2× multiplier at $1/hr vs $2/hr is the same fungibility gap as 2× at $2/hr vs $4/hr).

Total log-price variance is partitioned sequentially. Each factor's attribution is the additional sum-of-squares explained after conditioning on all prior factors. The residual is `total - sum(attributions)`.

**Order-dependence is a known property.** A different order (e.g., provider first) would redistribute attributions but leaves the residual unchanged. Reporting a second (Type III, marginal) order is a nice-to-have tracked in [TASKS/README.md](TASKS/README.md).

**On-demand recomputation for provider-filtered views.** Standard outputs are read from the precomputed `basis_decomposition` table, refreshed **twice daily** after each collection run (`collect_cron.sh`: collect → normalize → analytics at 08:00 and 20:00 UTC). For provider-filtered analyses — exposed as the `exclude_providers` query parameter on both `GET /api/basis/{gpu_sku}` and `GET /api/basis/{gpu_sku}/timeseries` — the same `compute_decompositions` function is called live against `canonical_offers` minus the excluded providers. The two endpoints share the on-demand helper; the only difference is whether its date window contains one day or several.

### Handling missing data

- **NULL region / commitment / provider** → assigned a distinct `"UNKNOWN"` label rather than dropped. This preserves observation counts and treats "missingness" as an honest category.
- **NULL bundle fields** → rows with all three bundle fields NULL get bundle label `"UNKNOWN"`. Rows with partial bundle data contribute what they have to a z-normalized composite score, then bucket into quartiles.

### Minimum-observation thresholds

- **Dispersion buckets** skipped when fewer than 3 offers (not enough signal to report percentiles).
- **Decomposition** skipped when a (date, gpu_sku) has fewer than 5 offers, or when a factor has fewer than 2 distinct values (no variance to attribute). Provider-filtered days that fall below the threshold simply do not appear in the response — the request does not fail.

### What is not adjusted

Per [ADR-0002](01-architecture/adr/0002-conservative-normalization.md), no continuous adjustments are made. The normalization layer is strictly rule-based, and the analytics layer only groups and decomposes — it does not "predict what the price should be" and subtract. Reliability tier, interconnect type, and datacenter quality are deliberately left in the residual; see [findings.md](findings.md) §"Why the residual is so large".

## Provider-mix dependence and the Vast.ai robustness check

The headline residual is sample-mix-conditional. Vast.ai supplies ~75% of all canonical offers, so the same `compute_decompositions` over the same 77 days produces materially different residuals depending on whether Vast rows are included.

### Provider composition (77-day window)

| Provider | Canonical offers | Share |
|---|---:|---:|
| Vast.ai | 237,746 | 75.3% |
| AWS Spot | 45,448 | 14.4% |
| RunPod | 30,065 | 9.5% |
| TensorDock | 2,484 | 0.8% |
| **Total** | **315,743** | **100%** |

Vast's share fell from 79.3% at the prior refresh because it stopped contributing H100-SXM offers on 2026-06-23 (see the outage note below) while AWS Spot and RunPod kept growing; TensorDock added no new offers this window.

### Headline shift

| Series | n_days | Median % residual | Mean | Std |
|---|---:|---:|---:|---:|
| Full (Vast included) | 77 | **60.3** | 62.4 | 14.6 |
| Vast excluded | 77 | **81.9** | 80.5 | 11.0 |

**Median shift: +21.6 percentage points.** On the 56 days where Vast offers were present, removing them pushes the H100 SXM 80GB residual share up by +5 to +48 pp (median +23). The 21 days where Vast carried no H100-SXM offers coincide by construction — two isolated early misses (2026-06-16, 06-17) and a sustained 19-day outage (2026-06-23 → 07-11) — plus 2026-05-08, the one Vast-present day where its prices overlapped the rest of the market. Both are discussed in [findings.md](findings.md) §"The outlier days". The no-Vast std rose from 4.9 to 11.0 this refresh: with Vast gone, the curated-only residual split into a high regime (~90% through 07-02) and a low regime (~52% from 07-03, as AWS regional dispersion widened), making the no-Vast series bimodal.

### Methodological position

The residual is intentionally **not** Vast-corrected. Reweighting or excluding Vast in the headline would silently solve the project's central question by definition — "what would the residual look like under a less marketplace-dominated population" is itself the basis-risk finding, not a noise term to suppress. The dual reporting — headline series with Vast, robustness section with Vast excluded — is how the methodology stays honest about a sample-mix dependence that exists in the underlying market, not just in the dataset.

The ~18% of variance that observable factors *can* touch in the no-Vast series is almost entirely commitment-type effects (on-demand vs spot vs reserved); region contributes trace amounts, bundle and provider near zero. In the full series, those same factors pick up an additional ~21 pp of explanatory power, which is what Vast's internal heterogeneity (different verified-tier hosts, geographic spread, bundled-resource diversity) gives the model to attribute against. The headline residual is the variance the model cannot explain on top of that.

## H100 SXM 80GB summary stats (77 days)

| Sample | n_days | Median | IQR | Mean | Min | Max |
|---|---:|---:|---:|---:|---:|---:|
| Full (Vast included) | 77 | 60.3% | 54 – 68 | 62.4 | 30.9 | 91.6 |
| Vast excluded | 77 | 81.9% | ~80 – 88 | 80.5 | 50.6 | 93.0 |

Cross-SKU comparison over the same window:

| SKU | n_days | Median residual | IQR |
|---|---:|---:|---:|
| A100 SXM 80GB | 77 | 30% | 23 – 35 |
| H100 SXM 80GB | 77 | 60% | 54 – 68 |
| RTX 4090 24GB | 77 | 79% | 60 – 85 |

Full per-day tables and the outlier-day deep dive: [`analysis/2026-07-11-findings-refresh.md`](analysis/2026-07-11-findings-refresh.md).

## Related

- [Findings](findings.md) — narrative interpretation of these numbers
- [Project brief](project-brief.md)
- [System overview](01-architecture/system-overview.md)
- [ADR-0002 on conservative normalization](01-architecture/adr/0002-conservative-normalization.md)
- [Findings-refresh analysis (2026-05-13)](analysis/2026-05-13-findings-refresh-analysis.md)
