---
title: Findings — How fungible is GPU compute?
tags: [area:overview, audience:all, status:active]
owner: Raj
last_updated: 2026-07-24
---

# How fungible is GPU compute? Measuring basis risk in quoted H100 prices

> **⚠ Headline under revision (2026-07-25).** The exclude-Vast conditional below (~82%) predates a structural break: on 2026-07-03 the non-Vast baseline collapsed (four AWS Virginia spot offers repriced) and the exclude-Vast gap has since inverted to ≈ −4pp. See [analysis/2026-07-24-exclude-vast-collapse.md](analysis/2026-07-24-exclude-vast-collapse.md). Numbers below remain the 77-day-window record until the scheduled narrative rewrite.

On 2026-07-11, an NVIDIA H100 SXM 80GB rented for $1.99/hr on AWS Spot in US-East and $8.60/hr on AWS Spot in Japan — **4.3×** spread, same day, same provider, same spot-pricing mechanism, differing only by region. Widen the lens to all four providers and the gap is larger still. Conventional wisdom says most of that variance comes from the obvious stuff — region, commitment type, who's selling it. I built **Basis**, a public-data study that collects quoted GPU prices twice daily from four providers and decomposes the cross-sectional variance into observable factors and a residual. The finding, across 77 days of EC2-era collection:

> **For H100 SXM 80GB, ~60% of log-price variance is unexplained when all four providers are included — and ~82% when Vast.ai is excluded.** The headline depends on which segment of the market you measure, and that conditionality is itself the finding.

Both numbers are basis risk benchmark designs have to live with. Single-residual headlines flatten a market that does not behave like a single market.

## What Basis is

Basis is a research study, not a SaaS. For the 77-day analytical window (2026-04-26 → 2026-07-11) it drew on quoted prices from four providers in the corpus — Vast.ai (marketplace), RunPod (neocloud), AWS EC2 Spot (hyperscaler), and TensorDock (neocloud marketplace) — collected twice daily via systemd timers on EC2. Over that window it accumulated 315,743 canonical offers across 96 canonical GPU SKUs, drawn from 318,372 raw observations. **As of 2026-07-24, collection runs on 3 active providers** (Vast, RunPod, AWS Spot); TensorDock is parked (public feed empty since 2026-07-13) and Lambda Labs was never activated (its free API key requires a payment method, violating the study's zero-data-cost constraint).

The positioning is important. **These are quoted prices, not executed transactions.** Transaction-based benchmarks like Ornn's OCPI are gated behind enterprise subscriptions, and the fact that they *are* is itself part of the problem Basis exists to quantify. A public study of quoted prices is an honest lower bound on what benchmark builders have to contend with — real transactions likely compress this dispersion but we cannot directly observe by how much.

**Temporal note.** Numbers in this writeup reflect the 77-day window 2026-04-26 → 2026-07-11, refreshed for analysis on 2026-07-11. The dashboard updates continuously, so live medians may differ by a few tenths of a percentage point as new days land.

## Method

**Canonicalization is rule-based and conservative.** Every raw observation is mapped through explicit lookup tables: `"H100 SXM"`, `"H100_SXM5"`, and `"NVIDIA HGX H100 SXM 80GB"` all become `h100_sxm_80gb`. Different form factors (SXM vs PCIe) and different VRAM capacities get different canonical SKUs — we never collapse meaningful hardware differences. Unknown GPU names are **skipped and logged**, not guessed. This matters because aggressive normalization would artificially shrink the residual and undermine the finding.

**Decomposition is sequential ANOVA on log-prices**, in a fixed factor order:

```
region → commitment → provider → bundle → residual
```

Log-prices because *ratios*, not absolute differences, are the meaningful fungibility metric: a 2× multiplier from $1→$2/hr is the same fungibility gap as $2→$4/hr. Fixed order because the attribution needs to be deterministic; changing the order redistributes attributions among the four factors but leaves the residual unchanged. Missing factor values (common for RunPod, which doesn't report region) are kept as a distinct `UNKNOWN` group so observations aren't silently dropped. Bundle is a z-normalized composite of bundled vCPUs, RAM, and storage, bucketed into quartiles.

For this refresh the decomposition is run twice: once on the full dataset and once with Vast.ai excluded entirely. The contrast is what surfaces the segment-dependence story.

## The numbers

H100 SXM 80GB over the 77-day window, residual share of log-price variance:

| Sample | n_days | Median | IQR | Mean | Min | Max |
|---|---:|---:|---:|---:|---:|---:|
| Full (Vast included) | 77 | **60.3%** | 54 – 68 | 62.4 | 30.9 | 91.6 |
| Vast excluded | 77 | **81.9%** | ~80 – 88 | 80.5 | 50.6 | 93.0 |

The median residual share moves +21.6 pp when Vast.ai is excluded — essentially unchanged from the +21.4 pp at 60 days, and both medians are within a fraction of a point of the prior refresh. The finding is stable. The one notable shift is in the *spread*: a three-week Vast H100-SXM outage (2026-06-23 → 07-11) pushes the Vast-inclusive high end to ~92% (2026-07-01) and, because the market on those days is the curated-only basket, widens the no-Vast series into a bimodal shape (min 50.6%). Both are discussed in §[The outlier days](#the-outlier-days); the low full-series day (31% on 2026-05-28) is unchanged.

The texture is sharper across SKUs. Same 77-day window, same method:

| SKU | n_days | Median residual | IQR | Notes |
|---|---:|---:|---:|---|
| **A100 SXM 80GB** | 77 | **30%** | 23 – 35 | Mature datacenter SKU. All four providers active; most variance attributable to observables. |
| **H100 SXM 80GB** | 77 | **60%** | 54 – 68 | Vast-inclusive headline. See §[Vast caveat](#provider-mix-and-the-vastai-caveat) for the no-Vast number. |
| **RTX 4090 24GB** | 77 | **79%** | 60 – 85 | Consumer card, marketplace-dominated. Three providers (no AWS Spot offering). Median high, but a wide left tail (mean 68%, occasional sub-20% days). |

The texture argument holds at 77 days: **newer or less-standardized SKUs show a larger residual share.** A100 (mature) → 30%, H100 (current) → 60%, RTX 4090 (consumer marketplace) → 79%.

## Provider mix and the Vast.ai caveat

Vast supplies ~75% of all canonical offers (237,746 of 315,743) — down from 79% at the last refresh, because Vast stopped contributing H100-SXM offers on 2026-06-23 while the other providers kept growing. Recomputing the H100 SXM 80GB decomposition over the same 77 days with Vast offers excluded entirely — using the production `compute_decompositions` function on a filtered DataFrame — moves the median residual share from **60.3% to 81.9%**, a +21.6 pp shift. On the 56 days where Vast offers were present, removing them pushes residual share up by +5 to +48 pp (median +23). The 21 days where Vast carried *no* H100-SXM offers coincide by construction (Vast-included = Vast-excluded): two isolated early misses (2026-06-16, 06-17) and then a sustained 19-day outage (2026-06-23 → 07-11). One further day, 2026-05-08, coincides with Vast *present* — its prices happened to overlap the rest of the market (see below).

Two interpretations, both worth saying out loud:

- **Methodologically.** Vast is a variance-providing population that observable factors *can* attribute against (different verified-tier hosts, geographic spread, bundled-resource diversity). Excluding Vast strips out the offers the model can explain, leaving the AWS Spot / RunPod / TensorDock prices that cluster within their narrow per-provider bands. The ~18% of variance that observable factors can touch in the no-Vast series is essentially commitment-type effects, with region contributing trace amounts.
- **Substantively.** The headline is sample-mix-dependent. Anyone reading "~60% of variance is unexplained" should know that statistic is conditional on a Vast-heavy population. With a more enterprise-weighted basket the residual share rises sharply — and the floor on unexplained variance stays high regardless of which provider mix you pick, which is the basis-risk thesis stated more precisely.

This is the single most important caveat to surface, and it is itself the finding. A research benchmark that quietly normalised this away would be solving the project's whole question by definition.

## The outlier days

Over 77 days the residual share has two kinds of high day, worth separating because they mean different things.

**Missing-data spikes — a sustained outage within the window.** All ten of the highest-residual days in the window (2026-06-23 → 07-02, ranging 86–92%) fall inside a three-week stretch where Vast carried *no* H100-SXM offers at all. With Vast absent, the population collapses to the narrow-band AWS/RunPod/TensorDock prices and the Vast-included and Vast-excluded series coincide. These are collection artifacts, not market structure (the same mechanism as v1's 2026-04-18 Vast cron miss). A live API probe traced it to Vast's new **64-offer cap on unauthenticated requests** (cheapest-first; `limit` ignored), which collapsed total Vast collection ~97% on 2026-06-23. **The collector fix shipped 2026-07-12** (`Authorization: Bearer` when `VAST_API_KEY` is set); a per-provider volume alert also shipped. The 77-day window medians are robust to the outage; single-day readings near 90% inside the tail should be read as "Vast is missing," not "basis widened." Details in the [2026-07-11 refresh](analysis/2026-07-11-findings-refresh.md).

Inside that outage sits a genuinely *substantive* second finding. The curated-only residual is not constant while Vast is gone: it ran ~86–92% through 2026-07-02, then **halved to ~50–55% from 2026-07-03 onward** — same three providers, same 42 offers per day. The lever is cross-region price dispersion: AWS Spot prices spread across regions (US ~$2/hr vs Japan $8.60/hr), so *region* suddenly became a strong explainer and pulled ~40 pp of variance out of the residual. Even a marketplace-free basket carries large, time-varying basis, and the single thing moving it is one provider's regional spread — the cleanest argument yet for a dedicated cross-region view.

**Factor compression — the substantive Vast-present day.** Setting the outage aside, the cleanest high day with Vast *present* is still **2026-05-08** (81.3% against a 77-day median of 60.3%). This is *not* a missing-data event — all four providers were active and observation count was normal (76 offers, 32 from Vast). The mechanism is factor compression: total variance on 5/8 was actually slightly *below* the window average (0.261 vs a median of 0.271), but region-attributable variance collapsed to roughly a third of typical (0.023 vs a median of ~0.061) and bundle and provider attributions ran near zero, so the same total variance landed mostly in the residual. 5/8 is the only Vast-*present* day where the Vast-included and Vast-excluded residual shares match (81.3% vs 81.3%). On the other 55 Vast-present days, Vast inclusion pulls residual share down by 5–48 pp. So 5/8 is genuinely "what residual share looks like when Vast prices happen to overlap the rest of the market" — the cleanest single-day evidence for the segment-dependence story, even though the outage days now exceed it numerically.

## Why the residual is so large

The Vast-exclusion result already covers most of one explanation, but it is worth laying out the three forces that show up in the residual. None is normalized away.

**1. Marketplace versus curated pricing.** Vast.ai is a race-to-the-bottom marketplace of independent sellers. AWS Spot is one seller with an algorithmic pricing loop tied to utilization. RunPod and TensorDock sit somewhere between. These are fundamentally different *price discovery mechanisms*, and controlling for "provider" treats each as a single label without capturing the mechanism difference. The ~21-pp shift between the Vast-included and Vast-excluded series is the empirical signature of this — most of what observable factors *can* explain in the headline series is being explained by Vast's internal heterogeneity, not by the cross-provider structure that the same factors describe in curated populations.

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
- **Four providers in corpus, three active today, Vast-heavy.** The 77-day numbers include TensorDock (~0.8% of offers); TensorDock is parked as of 2026-07-13. OCI, GCP, Azure, CoreWeave, Crusoe, Lambda Labs (and others) are missing. With Vast at ~75% of canonical offers in the window, the population is structurally tilted toward marketplace pricing; the Vast-exclusion section above bounds how much that tilt does the work.
- **Conservative normalization is a choice.** Reliability, interconnect type, and datacenter tier are deliberately left in the residual because normalizing them would be pretending to measure what we can't.
- **Vast H100-SXM outage (within window).** Vast returned no H100-SXM offers for 21 days in the 77-day window — root-caused to Vast's 64-offer keyless cap (2026-06-23). Collector auth fix shipped 2026-07-12; the outage tail remains in the frozen analytical window. Details in the [2026-07-11 refresh](analysis/2026-07-11-findings-refresh.md).
- **The SKU table is 77 days, not 18 months.** Long-run stability and seasonality are the obvious follow-ons, neither of which 77 days can fully settle.

## What's next

The most informative single change is adding more curated providers — Lambda Labs (revisited under different terms), CoreWeave, Crusoe — which would reduce Vast's share below 80% and sharpen the segment-dependence picture without changing the methodology. Cross-region basis (US-East vs US-West vs EU on the same SKU and commitment) is the obvious follow-on once provider coverage is broader. The cron continues to run; numbers will refresh as the window grows.

The underlying code, data, and every intermediate step are in the repo — this piece is the part that points at what the pipeline found. Explore the live data on the [Dispersion](/dispersion), [Basis](/basis), and [Providers](/providers) pages. For the full methodology, see [Methodology](/methodology).
