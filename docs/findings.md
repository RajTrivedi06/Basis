---
title: Findings — How fungible is GPU compute?
tags: [area:overview, audience:all, status:active]
owner: Raj
last_updated: 2026-04-20
---

# How fungible is GPU compute? Measuring basis risk in quoted H100 prices

On 2026-04-17, an NVIDIA H100 SXM 80GB rented for $0.45/hour on the cheapest Vast.ai listing and $6.88/hour on the most expensive AWS Spot availability zone. Same nominal hardware, **15×** spread, same day. Conventional wisdom says most of that gap comes from the obvious stuff — region, commitment type, who's selling it. I built **Basis**, a public-data study that collects quoted GPU prices twice daily from four providers and decomposes the cross-sectional variance into observable factors and a residual. The finding, across three observation days:

> **For H100 SXM 80GB, between 53% and 95% of log-price variance remains unexplained after controlling for region, commitment type, provider identity, and bundled resources.**

That residual is the basis risk any compute benchmark or derivatives product has to live with.

## What Basis is

Basis is a research study, not a SaaS. It collects quoted prices from four providers — Vast.ai (marketplace), RunPod (neocloud), AWS EC2 Spot (hyperscaler), and TensorDock (neocloud marketplace) — via twice-daily cron. Over three days of collection it has accumulated 9,979 raw observations across 97 canonical GPU SKUs. Lambda Labs was considered but dropped: its free API key now requires a payment method, which violated the study's zero-data-cost constraint.

The positioning is important. **These are quoted prices, not executed transactions.** Transaction-based benchmarks like Ornn's OCPI are gated behind enterprise subscriptions, and the fact that they *are* is itself part of the problem Basis exists to quantify. A public study of quoted prices is an honest lower bound on what benchmark builders have to contend with — real transactions likely compress this dispersion but we cannot directly observe by how much.

## Method

**Canonicalization is rule-based and conservative.** Every raw observation is mapped through explicit lookup tables: `"H100 SXM"`, `"H100_SXM5"`, and `"NVIDIA HGX H100 SXM 80GB"` all become `h100_sxm_80gb`. Different form factors (SXM vs PCIe) and different VRAM capacities get different canonical SKUs — we never collapse meaningful hardware differences. Unknown GPU names are **skipped and logged**, not guessed. This matters because aggressive normalization would artificially shrink the residual and undermine the finding.

**Decomposition is sequential ANOVA on log-prices**, in a fixed factor order:

```
region → commitment → provider → bundle → residual
```

Log-prices because *ratios*, not absolute differences, are the meaningful fungibility metric: a 2× multiplier from $1→$2/hr is the same fungibility gap as $2→$4/hr. Fixed order because the attribution needs to be deterministic; changing the order redistributes attributions among the four factors but leaves the residual unchanged. Missing factor values (common for RunPod, which doesn't report region) are kept as a distinct `UNKNOWN` group so observations aren't silently dropped. Bundle is a z-normalized composite of bundled vCPUs, RAM, and storage, bucketed into quartiles.

## The numbers

H100 SXM 80GB across three observation days, variance in log-price units:

| Date | Total | Region | Commit | Provider | Bundle | Residual | **% Residual** |
|------|-------|--------|--------|----------|--------|----------|----------------|
| 2026-04-17 | 0.323 | 0.068 | 0.004 | 0.000 | 0.023 | 0.227 | **70.4%** |
| 2026-04-18 | 0.227 | 0.001 | 0.011 | 0.000 | 0.000 | 0.215 | **94.7%** |
| 2026-04-20 | 0.301 | 0.086 | 0.019 | 0.035 | 0.000 | 0.161 | **53.5%** |

Across 3 days the residual explains between half and nearly all of log-price variance. The 2026-04-18 reading of 94.7% is the most striking: on that day only AWS Spot and RunPod were active (a cron gap on the Vast side), and the two providers carve the market so differently that almost no observable factor touches the spread.

A cross-SKU comparison adds texture. **A100 SXM 80GB** shows much tighter residuals (5–25%) — it's a more mature, more widely-standardized product. **RTX 4090** — a consumer card traded in chaotic marketplace conditions — shows residuals as high as 88%. The residual is not a constant; it's a function of how commoditized a particular SKU is.

## Why the residual is so large

Three candidate explanations, none of which Basis normalizes for:

**1. Reliability and datacenter tier.** Vast.ai sellers mark themselves "verified" or "unverified"; RunPod classifies its datacenters as "secure" vs "community". These categories carry real differences in failure rate, uptime SLA, and underlying hardware generation — but they aren't standardized across providers. Normalizing them would require a subjective mapping that would be more opinion than measurement.

**2. Real-time availability.** A $0.95/hr H100 SXM on AWS Spot is cheap because it can be preempted in 15 minutes. A $2.99/hr on-demand H100 on RunPod is not preemptible. These prices are not substitutes for the same workload; they price in different probability-of-continuity distributions. You could argue availability should be part of the commitment factor — but commitment is categorical (on-demand / spot / reserved), not continuous, and spot interruption probabilities vary by region within AWS alone.

**3. Marketplace versus curated pricing.** Vast.ai is a race-to-the-bottom marketplace of independent sellers. AWS Spot is one seller with an algorithmic pricing loop tied to utilization. RunPod and TensorDock sit somewhere between. These are fundamentally different *price discovery mechanisms*, and controlling for "provider" treats each as a single label without capturing the mechanism difference.

Collectively these three factors show up in the residual. Not normalizing them is a deliberate choice: we want the basis risk measurement to include everything the benchmark-builder would face in practice.

## Implications for compute benchmarks

A benchmark that reports "the H100 price" as a single number is implicitly averaging across all of these dimensions. That's fine for **direction** — is the market trending up or down, quarter over quarter? But it's inadequate for **pricing**, for two reasons:

1. **Settlement divergence.** A derivatives contract priced to a blended benchmark will frequently settle far from what either counterparty actually transacted. A ±50% residual means a ±2× swing on a typical notional.

2. **Hedge ineffectiveness.** A workload buyer hedging exposure to an index price that aggregates across availability tiers will end up hedged against a *weighted average of things they aren't buying*.

The honest response is either stratification (report H100-SXM-on-demand-US-East separately from H100-SXM-spot-US-East, and so on) or bilateral contracts referenced to a specific counterparty rather than an anonymized benchmark. Ornn's OCPI presumably solves this internally with rich slicing; this study is a public-data estimate of how bad the problem looks when you try to aggregate across the slices.

## Limitations

The most important caveat is the **three-day sample**. Residual estimates will stabilize with more data — thirty days of collection is the realistic target before any published number should be taken seriously. The second-biggest caveat is the **quoted-vs-transacted gap**: enterprise transaction prices likely compress dispersion, but by how much is the exact question that remains inaccessible without paid benchmarks. Third, **four providers is not the full market**: OCI, GCP, Azure, CoreWeave, Crusoe, and others are missing, and each would add its own price discovery mechanism. Finally, **conservative normalization is a choice**: reliability, interconnect type, and datacenter tier are deliberately left in the residual because normalizing them would be pretending to measure what we can't.

## What's next

The cron continues to run. After 2–4 more weeks of observations, the residual range will tighten and stratification by commitment type will become statistically credible. The next methodological enhancement is reporting Type III (marginal) attributions alongside the sequential ones, so both "region-first" and "provider-first" residuals become visible. The underlying code, data, and every intermediate step are in the repo — this piece is simply the part that points at what the pipeline found.

Explore the live data on the [Dispersion](/dispersion), [Basis](/basis), and [Providers](/providers) pages. For the full methodology, see [Methodology](/methodology).
