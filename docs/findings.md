---
title: Findings — How fungible is GPU compute?
tags: [area:overview, audience:all, status:active]
owner: Raj
last_updated: 2026-05-15
---

# How fungible is GPU compute? Measuring basis risk in quoted H100 prices

On 2026-05-13, an NVIDIA H100 SXM 80GB rented for $0.45/hr on Vast.ai's cheapest listing and $6.88/hr on AWS Spot's most expensive availability zone. Same nominal hardware, **15×** spread, same day. Conventional wisdom says most of that gap comes from the obvious stuff — region, commitment type, who's selling it. I built **Basis**, a public-data study that collects quoted GPU prices twice daily from four providers and decomposes the cross-sectional variance into observable factors and a residual. The finding, across 18 days of EC2-era collection:

> **For H100 SXM 80GB, ~59% of log-price variance is unexplained when all four providers are included — and ~89% when Vast.ai is excluded.** The headline depends on which segment of the market you measure, and that conditionality is itself the finding.

Both numbers are basis risk benchmark designs have to live with. Single-residual headlines flatten a market that does not behave like a single market.

## What Basis is

Basis is a research study, not a SaaS. It collects quoted prices from four providers — Vast.ai (marketplace), RunPod (neocloud), AWS EC2 Spot (hyperscaler), and TensorDock (neocloud marketplace) — via twice-daily cron. Over 18 days of post-cutover EC2 collection (2026-04-26 → 2026-05-13) it has accumulated 90,054 canonical offers across 93 canonical GPU SKUs, drawn from 90,161 raw observations. Lambda Labs was considered but dropped: its free API key now requires a payment method, which violated the study's zero-data-cost constraint.

The positioning is important. **These are quoted prices, not executed transactions.** Transaction-based benchmarks like Ornn's OCPI are gated behind enterprise subscriptions, and the fact that they *are* is itself part of the problem Basis exists to quantify. A public study of quoted prices is an honest lower bound on what benchmark builders have to contend with — real transactions likely compress this dispersion but we cannot directly observe by how much.

**Temporal note.** Numbers in this writeup reflect the 18-day window 2026-04-26 → 2026-05-13, frozen for analysis on 2026-05-13. The dashboard updates continuously, so live medians may differ by a few tenths of a percentage point as new days land.

## Method

**Canonicalization is rule-based and conservative.** Every raw observation is mapped through explicit lookup tables: `"H100 SXM"`, `"H100_SXM5"`, and `"NVIDIA HGX H100 SXM 80GB"` all become `h100_sxm_80gb`. Different form factors (SXM vs PCIe) and different VRAM capacities get different canonical SKUs — we never collapse meaningful hardware differences. Unknown GPU names are **skipped and logged**, not guessed. This matters because aggressive normalization would artificially shrink the residual and undermine the finding.

**Decomposition is sequential ANOVA on log-prices**, in a fixed factor order:

```
region → commitment → provider → bundle → residual
```

Log-prices because *ratios*, not absolute differences, are the meaningful fungibility metric: a 2× multiplier from $1→$2/hr is the same fungibility gap as $2→$4/hr. Fixed order because the attribution needs to be deterministic; changing the order redistributes attributions among the four factors but leaves the residual unchanged. Missing factor values (common for RunPod, which doesn't report region) are kept as a distinct `UNKNOWN` group so observations aren't silently dropped. Bundle is a z-normalized composite of bundled vCPUs, RAM, and storage, bucketed into quartiles.

For this refresh the decomposition is run twice: once on the full dataset and once with Vast.ai excluded entirely. The contrast is what surfaces the segment-dependence story.

## The numbers

H100 SXM 80GB over the 18-day window, residual share of log-price variance:

| Sample | n_days | Median | IQR | Mean | Min | Max |
|---|---:|---:|---:|---:|---:|---:|
| Full (Vast included) | 18 | **59.2%** | 57 – 63 | 59.4 | 45.4 | 81.3 |
| Vast excluded | 18 | **88.6%** | (see §[Vast caveat](#provider-mix-and-the-vastai-caveat)) | 86.8 | — | — |

The median residual share moves +29.4 pp when Vast.ai is excluded, on a per-day basis. Within the Vast-inclusive series, the central 50% of days fits inside a 6-pp band around 59%; one day (5/8) sits at 81% and is treated as a single illustrative point rather than evidence of a long tail (see §[The 2026-05-08 day](#the-2026-05-08-day)).

The texture is sharper across SKUs. Same 18-day window, same method:

| SKU | n_days | Median residual | IQR | Notes |
|---|---:|---:|---:|---|
| **A100 SXM 80GB** | 18 | **24%** | 21 – 29 | Mature datacenter SKU. All four providers active every day; most variance attributable to observables. |
| **H100 SXM 80GB** | 18 | **59%** | 57 – 63 | Vast-inclusive headline. See §[Vast caveat](#provider-mix-and-the-vastai-caveat) for the no-Vast number. |
| **RTX 4090 24GB** | 18 | **86%** | 84 – 88 | Consumer card, marketplace-dominated. Three providers (no AWS Spot offering). Tighter IQR than H100 — chaos is uniform across days. |

The texture argument from v1 firms up at 18 days: **newer or less-standardized SKUs show a larger residual share, with diminishing variance across days.** A100 (mature) → 24%, H100 (current) → 59%, RTX 4090 (consumer marketplace) → 86%.

## Provider mix and the Vast.ai caveat

Vast supplies ~80% of all canonical offers (71,770 of 90,054). Recomputing the H100 SXM 80GB decomposition over the same 18 days with Vast offers excluded entirely — using the production `compute_decompositions` function on a filtered DataFrame — moves the median residual share from **59.2% to 88.6%**, a +29.4 pp shift. On 17 of 18 days, removing Vast pushes residual share up by 20–44 pp. The single exception is 2026-05-08 (see below).

Two interpretations, both worth saying out loud:

- **Methodologically.** Vast is a variance-providing population that observable factors *can* attribute against (different verified-tier hosts, geographic spread, bundled-resource diversity). Excluding Vast strips out the offers the model can explain, leaving the AWS Spot / RunPod / TensorDock prices that cluster within their narrow per-provider bands. The 12% of variance that observable factors can touch in the no-Vast series is essentially commitment-type effects, with region contributing trace amounts.
- **Substantively.** The headline is sample-mix-dependent. Anyone reading "~59% of variance is unexplained" should know that statistic is conditional on a Vast-heavy population. With a more enterprise-weighted basket the residual share rises sharply — and the floor on unexplained variance stays high regardless of which provider mix you pick, which is the basis-risk thesis stated more precisely.

This is the single most important caveat to surface, and it is itself the finding. A research benchmark that quietly normalised this away would be solving the project's whole question by definition.

## The 2026-05-08 day

H100 SXM 80GB residual share spikes to 81.3% on 2026-05-08 against an 18-day median of 59.2%. Unlike v1's 2026-04-18 outlier (94.7%, attributed to a Vast cron miss), **this is not a missing-data event** — all four providers were active on 5/8 and observation count was normal (76 offers, 32 from Vast).

The mechanism is **factor compression**, not extra noise. Total variance on 5/8 was actually *below* the 18-day average (0.260 vs ~0.28). What changed is where the variance landed: region-attributable variance collapsed to roughly a third of typical (0.023 vs a 17-day median of ~0.05), and bundle and provider attributions ran near zero. The same total variance got redistributed mostly into the residual.

Cross-referencing the no-Vast series sharpens the picture: 5/8 is the only day in 18 where the Vast-included and Vast-excluded residual shares **match** (81.3% vs 81.3%, delta -0.1 pp). On every other day, Vast inclusion pulls residual share down by 20–44 pp. So 5/8 is genuinely "what residual share looks like when Vast prices happen to overlap the rest of the market" — different mechanism from v1's 4/18 (Vast literally absent), same observable outcome (factors can't separate against an indistinguishable Vast). It is the cleanest single-day evidence for the segment-dependence story.

## Why the residual is so large

The Vast-exclusion result already covers most of one explanation, but it is worth laying out the three forces that show up in the residual. None is normalized away.

**1. Marketplace versus curated pricing.** Vast.ai is a race-to-the-bottom marketplace of independent sellers. AWS Spot is one seller with an algorithmic pricing loop tied to utilization. RunPod and TensorDock sit somewhere between. These are fundamentally different *price discovery mechanisms*, and controlling for "provider" treats each as a single label without capturing the mechanism difference. The 30-pp shift between the Vast-included and Vast-excluded series is the empirical signature of this — most of what observable factors *can* explain in the headline series is being explained by Vast's internal heterogeneity, not by the cross-provider structure that the same factors describe in curated populations.

**2. Reliability and datacenter tier.** Vast.ai sellers mark themselves "verified" or "unverified"; RunPod classifies its datacenters as "secure" vs "community". These categories carry real differences in failure rate, uptime SLA, and underlying hardware generation — but they aren't standardized across providers. Normalizing them would require a subjective mapping that would be more opinion than measurement.

**3. Real-time availability.** A $0.95/hr H100 SXM on AWS Spot is cheap because it can be preempted in 15 minutes. A $2.99/hr on-demand H100 on RunPod is not preemptible. These prices are not substitutes for the same workload; they price in different probability-of-continuity distributions. Availability could in principle live inside the commitment factor — but commitment is categorical (on-demand / spot / reserved), not continuous, and spot interruption probabilities vary by region within AWS alone.

Not normalizing these is deliberate. The basis risk measurement is supposed to include everything a benchmark-builder would face in practice; "what looks like the same H100" is genuinely not the same H100 on either axis.

## Implications for compute benchmarks

A benchmark that reports "the H100 price" as a single number is implicitly averaging across all of these dimensions. That is fine for **direction** — is the market trending up or down, quarter over quarter? — but it is inadequate for **pricing**, for three reasons:

1. **Settlement divergence.** A derivatives contract priced to a blended benchmark will frequently settle far from what either counterparty actually transacted. A ±50% residual means a ±2× swing on a typical notional.

2. **Hedge ineffectiveness.** A workload buyer hedging exposure to an index price that aggregates across availability tiers will end up hedged against a *weighted average of things they aren't buying*.

3. **Segment-specific misrepresentation.** A single number must misrepresent at least one segment when the underlying residual is provider-mix-conditional. The Vast-included headline is conservative for an enterprise procurement audience; the Vast-excluded headline is conservative for a marketplace buyer. Transparent dual reporting — both numbers, with the population mix explicit — is the honest alternative.

The deeper response is stratification (report H100-SXM-on-demand-US-East separately from H100-SXM-spot-US-East, and so on) or bilateral contracts referenced to a specific counterparty rather than an anonymized benchmark. Ornn's OCPI presumably solves this internally with rich slicing; this study is a public-data estimate of how bad the problem looks when you try to aggregate across the slices.

## Limitations

- **Quoted vs transacted.** Enterprise transaction prices likely compress dispersion, but by how much is the exact question that remains inaccessible without paid benchmarks. Basis is an honest lower bound, not a transaction benchmark.
- **Four providers, Vast-heavy.** OCI, GCP, Azure, CoreWeave, Crusoe, Lambda Labs (and others) are missing, and each would add its own price discovery mechanism. With Vast at 80% of canonical offers, the population is structurally tilted toward marketplace pricing; the Vast-exclusion section above is the explicit attempt to bound how much that tilt is doing the work.
- **Conservative normalization is a choice.** Reliability, interconnect type, and datacenter tier are deliberately left in the residual because normalizing them would be pretending to measure what we can't.
- **Single-residual SKU table is 18 days, not 18 months.** Long-run stability and seasonality are the obvious follow-ons, neither of which 18 days can settle.

## What's next

The most informative single change is adding more curated providers — Lambda Labs (revisited under different terms), CoreWeave, Crusoe — which would reduce Vast's share below 80% and sharpen the segment-dependence picture without changing the methodology. Cross-region basis (US-East vs US-West vs EU on the same SKU and commitment) is the obvious follow-on once provider coverage is broader. The cron continues to run; numbers will refresh as the window grows.

The underlying code, data, and every intermediate step are in the repo — this piece is the part that points at what the pipeline found. Explore the live data on the [Dispersion](/dispersion), [Basis](/basis), and [Providers](/providers) pages. For the full methodology, see [Methodology](/methodology).
