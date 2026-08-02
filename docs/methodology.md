---
title: Methodology
tags: [area:overview, audience:all, status:active]
owner: Raj
last_updated: 2026-08-02
---

# Methodology

> **A full narrative refresh is in progress; this page carries interim corrections dated 2026-08-02.** Method choices are current. The summary-statistic tables below are the frozen record of the 2026-04-26 → 2026-07-11 analytical window and are labelled as such.

How quoted GPU prices become a residual-variance number, and what choices are frozen in the analytics layer. The narrative interpretation lives in [findings.md](findings.md); this file is the reference for *how* the numbers are computed.

**Temporal note.** The summary tables below are the frozen record of the 2026-04-26 → 2026-07-11 window of post-cutover EC2 collection, refreshed 2026-07-11; the dashboard is the live number. Two later events make that window non-comparable to the present series: Vast spot pricing became visible on 2026-07-26 (collector fix, "Era D"), and the Azure and GCP list catalogs joined the corpus on 2026-07-28. **Operational note:** Vast collector auth (`VAST_API_KEY`) and per-provider volume alerting shipped 2026-07-12; TensorDock was retired 2026-06-12. Collection today runs on five providers — Vast, RunPod, AWS Spot, Azure, and GCP.

Investigation report: [`analysis/2026-07-11-findings-refresh.md`](analysis/2026-07-11-findings-refresh.md). Prior refreshes: [`analysis/2026-06-24-findings-refresh.md`](analysis/2026-06-24-findings-refresh.md), [`analysis/2026-05-13-findings-refresh-analysis.md`](analysis/2026-05-13-findings-refresh-analysis.md).

## Summary

With 560k+ raw observations through Aug 2026 across five providers and 96 SKUs: in market-priced segments (marketplaces + spot), observable factors fail to explain roughly 20–61% of H100 price variance week to week; in administered catalogs the same factors explain nearly everything — segment-conditionality is the finding. Every figure on this page comes from the same `compute_decompositions` function; what changes between them is the population it is applied to. See [Price generation and the ML bound](#price-generation-and-the-ml-bound) for why the population matters that much, and [Provider-mix dependence](#provider-mix-dependence-and-the-vastai-robustness-check) for the Vast-exclusion robustness check.

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

## Price generation and the ML bound

### Comparison protocol

The GBM-vs-ANOVA comparison is out-of-sample model against in-sample ANOVA share; an out-of-sample ANOVA (group means fit on train days, applied to test days) is a planned v4 refinement. The asymmetry is disclosed rather than defended.

### Price-generation mechanisms

AWS spot prices are administratively generated by a reserve-price algorithm rather than negotiated per host; hardware features carry no signal for them — the ML model's per-provider holdout R² of −0.73 on AWS is that mechanism showing up empirically, exactly as the external critique predicted.

Azure and GCP publish fixed list catalogs — one price per (SKU, region, commitment) — so pooling their thousands of identical rows with market-priced segments mechanically compresses the residual share: the four-provider marketplace window of Jul 12–27 averaged 51.0% unexplained, while the pooled five-provider series after their Jul 28–30 entry averages single digits (6.7%). The pooled figure is row-count-weighted; catalog-heavy populations compress it by construction.

Pool in Azure/GCP's fixed list catalogs (joined Jul 28) and the pooled residual collapses to single digits — administered prices are explainable by construction, which is precisely why a compute benchmark must be segment-aware.

### The ML bound

A 45-feature gradient-boosted model evaluated on held-out days reached R² 0.454 within-day, BELOW the in-sample four-factor share (0.563) on the same days — a negative gap of −10.9pp (as of 2026-07-31). Observable specs do not close the residual out-of-sample. What does account for over half of the remaining within-day variance on Vast is persistent host identity: fixed-effects ICC 0.554, stable across tenure thresholds (0.55/0.55/0.53 at ≥5/≥10/≥20 days). The model's top features (motherboard, port count, disk model) are hardware fingerprints — partial proxies for host identity, not causal price levers.

### Reading the series

Residual SHARE moves with its denominator: across late July the absolute residual variance stayed roughly stable (~0.06 in log-price terms) while total variance tripled with pool composition, halving the share. Share answers "what fraction resists explanation in this population"; absolute variance answers "how big is the unexplained spread" — the distinction is the difference between the mystery shrinking and the ruler changing.

## Provider-mix dependence and the Vast.ai robustness check

This is a robustness check on the frozen 2026-04-26 → 2026-07-11 window, not a live headline: the exclude-Vast gap inverted after a 2026-07-03 structural break in the non-Vast baseline, and the corpus rebalanced again when Azure and GCP joined. Current treatment, including the 2026-08-01 addendum on what the pooled headline now means, is in [`analysis/2026-07-24-exclude-vast-collapse.md`](analysis/2026-07-24-exclude-vast-collapse.md).

Within the window the residual was sample-mix-conditional. Vast.ai supplied ~75% of canonical offers, so the same `compute_decompositions` over the same dates produced materially different residuals depending on whether Vast rows were included.

### Provider composition (frozen window)

| Provider | Canonical offers | Share |
|---|---:|---:|
| Vast.ai | 237,746 | 75.3% |
| AWS Spot | 45,448 | 14.4% |
| RunPod | 30,065 | 9.5% |
| TensorDock | 2,484 | 0.8% |
| **Total** | **315,743** | **100%** |

(Frozen-window totals. The corpus has since grown past 560k raw observations and gained the Azure and GCP catalogs.)

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

## H100 SXM 80GB summary stats (frozen 2026-04-26 → 2026-07-11 window)

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
