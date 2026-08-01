---
title: Exclude-Vast residual collapse — investigation
tags: [area:analysis, audience:all, status:active]
owner: Raj
last_updated: 2026-07-24
---

# Why the exclude-Vast residual gap collapsed for h100_sxm_80gb

- **Date:** 2026-07-24 · read-only investigation against the restored full-corpus local DB (408,388 raw / 405,774 canonical, data through 2026-07-23 20:03 UTC)
- **Method:** identical code path to the API — same column set as `_compute_filtered_timeseries` (`routes/basis.py:60`), same `compute_decompositions` (`analytics/basis.py`), same MIN_OBSERVATIONS=5. Daily residual share = `residual_variance / total_variance × 100`. Only SELECTs were run.
- **Eras:** A = pre-cap (04-26 → 06-15) · B = cap/outage (06-16 → 07-11) · C = post-auth-fix (07-12 → present).

## TL;DR (facts)

The gap did not "fade" — **the exclude-Vast baseline itself collapsed, on 2026-07-03, while Vast was entirely absent from collection.** The non-Vast H100 universe is only ~42 offers/day (30 AWS spot + 12 RunPod catalog rows), and its 80–91% residual was carried by a handful of AWS intra-region price outliers. On 07-03 the four US/Virginia offers priced ~$6.68 converged to $2.53; the non-Vast residual share dropped 86.3% → 54.2% overnight and has stayed ~41–54% since. When Vast returned on 07-12, it returned into that new, lower baseline — and the gap is now slightly negative (era-C mean −4.0pp). The old ~+22pp story was true of eras A/B and is genuinely gone, but "Vast changed" is the wrong explanation: **the comparison group changed.**

---

## 1. Daily series (full vs exclude-Vast residual share)

Full table, 2026-04-26 → 2026-07-23 (90 days with decomposable data; both series always decomposable — non-Vast n=42 ≥ MIN_OBSERVATIONS every day):

| date | era | full % | excl-Vast % | gap (pp) | vast H100 n |
|---|---|---|---|---|---|
| 2026-04-26 | A | 59.4 | 93.0 | +33.6 | 42 |
| 2026-04-27 | A | 64.4 | 92.8 | +28.4 | 34 |
| 2026-04-28 | A | 66.1 | 92.6 | +26.6 | 86 |
| 2026-04-29 | A | 59.5 | 92.2 | +32.7 | 46 |
| 2026-04-30 | A | 63.9 | 91.6 | +27.6 | 44 |
| 2026-05-01 | A | 50.2 | 91.1 | +40.9 | 22 |
| 2026-05-02 | A | 50.1 | 90.3 | +40.2 | 19 |
| 2026-05-03 | A | 56.8 | 89.6 | +32.7 | 26 |
| 2026-05-04 | A | 45.4 | 88.9 | +43.5 | 28 |
| 2026-05-05 | A | 60.7 | 88.2 | +27.5 | 24 |
| 2026-05-06 | A | 64.0 | 87.6 | +23.6 | 27 |
| 2026-05-07 | A | 57.3 | 81.9 | +24.6 | 31 |
| 2026-05-08 | A | 81.3 | 81.3 | −0.1 | 32 |
| 2026-05-09 | A | 58.6 | 80.7 | +22.1 | 42 |
| 2026-05-10 | A | 59.5 | 80.3 | +20.8 | 20 |
| 2026-05-11 | A | 56.9 | 80.3 | +23.3 | 15 |
| 2026-05-12 | A | 55.3 | 80.3 | +25.0 | 20 |
| 2026-05-13 | A | 59.0 | 80.3 | +21.3 | 21 |
| 2026-05-14 | A | 58.7 | 80.1 | +21.4 | 29 |
| 2026-05-15 | A | 68.4 | 79.8 | +11.4 | 5 |
| 2026-05-16 | A | 70.1 | 79.6 | +9.6 | 10 |
| 2026-05-17 | A | 60.3 | 79.7 | +19.5 | 27 |
| 2026-05-18 | A | 47.8 | 79.5 | +31.8 | 39 |
| 2026-05-19 | A | 55.6 | 78.1 | +22.5 | 43 |
| 2026-05-20 | A | 64.4 | 76.2 | +11.8 | 67 |
| 2026-05-21 | A | 71.1 | 76.0 | +4.8 | 68 |
| 2026-05-22 | A | 64.7 | 75.7 | +11.0 | 51 |
| 2026-05-23 | A | 69.7 | 75.3 | +5.7 | 57 |
| 2026-05-24 | A | 55.2 | 75.3 | +20.2 | 102 |
| 2026-05-25 | A | 54.2 | 75.6 | +21.4 | 83 |
| 2026-05-26 | A | 45.6 | 76.4 | +30.8 | 85 |
| 2026-05-27 | A | 63.1 | 77.6 | +14.5 | 98 |
| 2026-05-28 | A | 30.9 | 79.1 | +48.2 | 33 |
| 2026-05-29 | A | 45.7 | 79.9 | +34.2 | 34 |
| 2026-05-30 | A | 40.1 | 79.6 | +39.5 | 40 |
| 2026-05-31 | A | 41.2 | 80.2 | +39.1 | 50 |
| 2026-06-01 | A | 45.2 | 81.3 | +36.2 | 73 |
| 2026-06-02 | A | 43.4 | 81.8 | +38.4 | 76 |
| 2026-06-03 | A | 41.4 | 81.8 | +40.3 | 52 |
| 2026-06-04 | A | 40.6 | 81.6 | +41.0 | 44 |
| 2026-06-05 | A | 40.9 | 81.1 | +40.2 | 37 |
| 2026-06-06 | A | 48.5 | 82.3 | +33.8 | 92 |
| 2026-06-07 | A | 68.1 | 81.9 | +13.8 | 101 |
| 2026-06-08 | A | 72.2 | 82.8 | +10.6 | 117 |
| 2026-06-09 | A | 72.0 | 83.4 | +11.3 | 111 |
| 2026-06-10 | A | 65.0 | 84.5 | +19.5 | 112 |
| 2026-06-11 | A | 63.9 | 84.8 | +20.9 | 123 |
| 2026-06-12 | A | 62.7 | 84.3 | +21.6 | 140 |
| 2026-06-13 | A | 61.0 | 84.6 | +23.6 | 150 |
| 2026-06-14 | A | 66.0 | 84.3 | +18.3 | 151 |
| 2026-06-15 | A | 62.8 | 83.8 | +21.0 | 76 |
| 2026-06-16 | B | 83.9 | 83.9 | +0.0 | 0 |
| 2026-06-17 | B | 83.6 | 83.6 | +0.0 | 0 |
| 2026-06-18 | B | 57.2 | 84.0 | +26.8 | 110 |
| 2026-06-19 | B | 65.1 | 86.2 | +21.1 | 133 |
| 2026-06-20 | B | 68.2 | 87.1 | +18.9 | 158 |
| 2026-06-21 | B | 65.7 | 88.0 | +22.3 | 155 |
| 2026-06-22 | B | 69.4 | 89.1 | +19.6 | 119 |
| 2026-06-23 | B | 89.9 | 89.9 | +0.0 | 0 |
| 2026-06-24 | B | 90.3 | 90.3 | +0.0 | 0 |
| 2026-06-25 | B | 90.9 | 90.9 | +0.0 | 0 |
| 2026-06-26 | B | 91.1 | 91.1 | +0.0 | 0 |
| 2026-06-27 | B | 91.3 | 91.3 | +0.0 | 0 |
| 2026-06-28 | B | 91.2 | 91.2 | +0.0 | 0 |
| 2026-06-29 | B | 91.1 | 91.1 | +0.0 | 0 |
| 2026-06-30 | B | 91.2 | 91.2 | +0.0 | 0 |
| 2026-07-01 | B | 91.6 | 91.6 | +0.0 | 0 |
| 2026-07-02 | B | 86.3 | 86.3 | +0.0 | 0 |
| 2026-07-03 | B | 54.2 | 54.2 | +0.0 | 0 |
| 2026-07-04 | B | 54.7 | 54.7 | +0.0 | 0 |
| 2026-07-05 | B | 54.8 | 54.8 | +0.0 | 0 |
| 2026-07-06 | B | 54.5 | 54.5 | +0.0 | 0 |
| 2026-07-07 | B | 54.0 | 54.0 | +0.0 | 0 |
| 2026-07-08 | B | 53.3 | 53.3 | +0.0 | 0 |
| 2026-07-09 | B | 52.9 | 52.9 | +0.0 | 0 |
| 2026-07-10 | B | 51.9 | 51.9 | +0.0 | 0 |
| 2026-07-11 | B | 50.6 | 50.6 | +0.0 | 0 |
| 2026-07-12 | C | 51.0 | 50.4 | −0.7 | 152 |
| 2026-07-13 | C | 51.5 | 49.7 | −1.8 | 123 |
| 2026-07-14 | C | 56.0 | 49.4 | −6.6 | 89 |
| 2026-07-15 | C | 52.5 | 49.3 | −3.2 | 79 |
| 2026-07-16 | C | 57.9 | 49.2 | −8.7 | 101 |
| 2026-07-17 | C | 54.6 | 49.0 | −5.5 | 119 |
| 2026-07-18 | C | 55.8 | 53.9 | −1.9 | 109 |
| 2026-07-19 | C | 52.8 | 53.6 | +0.7 | 91 |
| 2026-07-20 | C | 48.2 | 52.2 | +4.0 | 87 |
| 2026-07-21 | C | 52.1 | 48.2 | −3.9 | 75 |
| 2026-07-22 | C | 53.0 | 44.3 | −8.7 | 91 |
| 2026-07-23 | C | 53.0 | 41.3 | −11.7 | 82 |

Sanity check: the recomputed full-sample window mean over 06-24 → 07-24 is **64.47%**, matching the precomputed `basis_decomposition` table's window mean of **64.47%** exactly (n=30; the table covers 04-26 → 07-23) — the on-demand recompute and the production analytics agree.

## 2. Per-era gap statistics

| era | days both series | mean gap | median gap | full mean | excl mean | zero-Vast-H100 days |
|---|---|---|---|---|---|---|
| A (04-26 → 06-15) | 51 | **+25.1pp** | +23.6pp | 57.4% | 82.6% | 0 |
| B (06-16 → 07-11) | 26 | +4.2pp | +0.0pp | 72.3% | 76.4% | **21 of 26** |
| C (07-12 → 07-23) | 12 | **−4.0pp** | −3.6pp | 53.2% | 49.2% | 0 |

On the 21 era-B zero-Vast days the "gap" is identically 0 by construction — full and exclude-Vast are the same sample. The only era-B days with a real gap are 06-18 → 06-22 (pre-cap, +19 to +27pp, consistent with era A).

**The break inside era B, with Vast absent:** the exclude-Vast series fell 86.3% → 54.2% between 07-02 and 07-03 and never recovered. Factor-level decomposition of those two days (identical composition: 30 AWS spot + 12 RunPod offers, same regions, RunPod catalog literally frozen — the same 12 rows at the same prices every day):

```
2026-07-02: total_var=0.2101  region=13.6%  commit=0.1%  provider=0.0%  bundle=0.0%  residual=86.3%
2026-07-03: total_var=0.1139  region=45.6%  commit=0.3%  provider=0.0%  bundle=0.0%  residual=54.2%
```

The cause is visible in the raw offers: on 07-02, US/Virginia carried four offers at $6.682–6.684 next to six at $2.08–2.19 and two at $2.53 — massive *within-region* spread → residual. On 07-03 the $6.68 offers were gone (the top Virginia prices converged to $2.532), leaving Tokyo's two pinned $8.60 offers as the only extremes — and those are *between-region*, so they attribute to region (45.6%), not residual. One AWS spot price event in one region, four offers, moved the non-Vast residual share by 32pp.

## 3. Vast sample-bias check (H100 SXM 80GB prices, USD/GPU/hr)

| era | vast n / days present | offers/day (median) | vast p50 | vast IQR | vast p90 | vast range | other p50 | other IQR | other p90 |
|---|---|---|---|---|---|---|---|---|---|
| A | 2,955 / 51 | 44 | 2.334 | [1.867, 2.756] | 4.331 | [0.267, 13.337] | 2.059 | [1.649, 2.690] | 3.290 |
| B | 675 / **5** | 133 | 2.001 | [1.602, 2.269] | 2.440 | [0.447, 24.000] | 2.374 | [1.897, 2.990] | 5.146 |
| C | 1,198 / 12 | 91 | 1.923 | [1.454, 2.264] | 3.005 | [0.237, 9.334] | 2.586 | [2.407, 2.690] | 2.990 |

Sub-era truncation check (vast only):

```
 A1 (04-26..05-14)      n= 608  p50=1.922  p90=3.214  max=13.334
 A2 sag (05-15..05-31)  n= 892  p50=2.534  p90=5.334  max=13.337
 A3 (06-01..06-15)      n=1455  p50=2.334  p90=3.787  max=13.336
 B  (06-16..07-11)      n= 675  p50=2.001  p90=2.440  max=24.000
 C  (07-12..)           n=1198  p50=1.923  p90=3.005  max= 9.334
```

**Cheapest-64 verdict:** during the cap (06-23 → 07-11), truncation manifested as **total absence** — H100s never made the 64-cheapest cut (capped runs collected ~111 rows across all GPUs), so 21 of 26 era-B days have zero Vast H100s rather than a shaved distribution. The 5 era-B days where Vast *is* present (06-18 → 06-22) are pre-cap, full-volume days (110–158 H100s/day). Late era A shows **no top-truncation**: the May volume sag (see §5) had low daily H100 counts (5–10 on 05-15/16) but p90=$5.33 and max=$13.34 — expensive offers were still collected. Era-C Vast looks like era-A Vast (similar p50/IQR/p90); Vast itself did not change much. What changed is the **other** column: era-C non-Vast IQR is [2.407, 2.690] — dramatically tighter than era A's [1.649, 2.690] — the AWS convergence of §2.

## 4. The test's last-30-days window

Window = 2026-06-24 → 2026-07-24. It spans **18 era-B days (06-24 → 07-11, all zero-Vast → gap ≡ 0)** and **12 era-C days (07-12 → 07-23)**. No era-A day is in the window.

- Window full-sample mean: **64.47%** (matches the test's `base_mean=64.47` exactly)
- Window exclude-Vast mean: **62.87%** (matches the test's `filt_mean=62.87` exactly)
- Window gap: **−1.60pp** = weighted blend of 18 days of structurally-zero gap and 12 days averaging −3.99pp.

So the test's assertion (`gap > +5pp`) is being evaluated on a window where 60% of the days *cannot* have a gap (Vast wasn't collected) and the remaining 40% have a genuinely negative gap. Even a fully era-C window would fail the current assertion — the sign has flipped.

## 5. The Stage-0 volume surprise (~2,412/run vs "~6,400/day")

Resolved — **an apples-to-oranges comparison, not a supply shift.** The dry-run's 2,412 was the *on-demand query only* of a *single run*; the same run's bid query added 1,677, deduping to 3,081 unique offers. The historical "~6,400/day" is a **daily** total across two runs. Per-run weekly history (all GPUs):

```
week                    runs  median/run   min    max
2026-04-27/05-03         13     2,627     2,228  2,906
2026-05-04/05-10         14     1,883     1,711  2,415
2026-05-11/05-17         14     1,521       905  1,811   ← May sag
2026-05-18/05-24         14     1,465       859  1,974   ← May sag
2026-05-25/05-31         14     1,334       422  1,682   ← May sag
2026-06-01/06-07         14     2,180     1,708  3,127
2026-06-08/06-14         14     3,202     3,064  3,555   ← June peak (~6,400/day)
2026-06-15/06-21         14     3,173       109  3,537   (06-16/17 misses)
2026-06-22/06-28         14       111       107  3,268   ← cap begins 06-23
2026-06-29/07-05         14       111       105    118   ← capped (~64+bid dedup)
2026-07-06/07-12         16       114        64  3,222   ← fix lands 07-12 (extra 16:00/18:00 runs that day)
2026-07-13/07-19         14     3,063     2,802  3,188
2026-07-20/07-26          8     3,088     2,859  3,160   ← current
```

Current ~3,088/run × 2 runs = **~6,200/day — right at the June-peak level**. The "~6,400/day" baseline was itself the corpus maximum; April ran ~5,300/day and late May ~2,700/day. No evidence of a real supply shift.

**Incidental finding (data quality):** `commitment_type_reported` for Vast is `on_demand` for **100% of all 315,685 Vast rows, every month, all-time** — zero `spot` rows ever. The collector queries `type=bid` separately and labels offers by the payload's `is_bid` field, but no persisted Vast row has ever carried `spot`. Either every bid offer is a dedup-casualty of the on-demand query or `is_bid` is not set the way the collector assumes (`vast.py:216-218`). Consequence: the commitment factor is constant within Vast, so it can never explain any Vast price variance in the decomposition. Not investigated further here — flagged as a loose end.

Also observed in passing: JP/Tokyo AWS spot holds two offers pinned at exactly $8.600 continuously across weeks (spot price sitting at what is presumably the on-demand cap), and RunPod's 12 H100 catalog rows are identical every day for the whole 06-24 → 07-23 stretch — a static price catalog, not a moving market.

## 6. Verdict

### Which hypothesis fits

**Primary: window composition + a genuine one-day repricing event in the comparison group — not a Vast collection artifact, and not "Vast converged."**

1. **Collection artifact** explains the era-B portion of the window only: 18 of the test's 30 days have gap ≡ 0 because Vast wasn't collected at all (cheapest-64 cap). It does *not* explain the sign flip — era-C Vast collection is healthy (75–152 H100s/day, per-run volume at June-peak levels, price distribution similar to era A).
2. **Genuine market change — in the non-Vast segment.** The exclude-Vast baseline collapsed 86% → 54% on 2026-07-03, while Vast was absent, because four US/Virginia AWS spot offers repriced from ~$6.68 to $2.53. The old ~85% exclude-Vast residual was always resting on ~4 outlier offers in a 42-offer sample; the "+22pp gap" measured AWS spot's intra-region dispersion at least as much as anything about Vast.
3. **"Vast converged"** is not supported: Vast's own price distribution (p50/IQR/p90) is broadly unchanged from era A. What changed is that the non-Vast benchmark got tight (other-IQR [2.407, 2.690] in era C), so adding Vast now *widens* relative unexplained spread slightly (era-C gap −4pp) instead of diluting a wild AWS sample (era-A gap +25pp).

### Honest current headline numbers (era C, 07-12 → 07-23, 12 days)

- Full-sample residual share for h100_sxm_80gb: **mean 53.2%, daily range 48–58%**
- Exclude-Vast residual share: **mean 49.2%, drifting down (41.3% on 07-23), daily range 41–54%**
- Gap: **−4.0pp mean** — excluding Vast currently *lowers* residual share slightly
- The exclude-Vast series rests on **n≈42 offers/day from effectively two providers** (one of which — RunPod — posts a static catalog); it is not robust to single-instance-type repricings, as 07-03 proved.

### Recommendation (separate from the facts)

- **Retire the 59% → 89% segment-conditional story** on the hero and methodology page. Both of its numbers are stale: the 89% described a fragile 42-offer non-Vast sample that no longer behaves that way, and the current gap is slightly negative. Keeping it would misstate the market and the method's robustness.
- **The defensible v3 story is the full-sample residual: ~50–55% of H100 log-price variance remains unexplained after region, commitment, provider, and bundle — on a healthy, all-providers corpus.** That is still a strong fungibility finding, and it no longer depends on a conditional framing.
- If a Vast-exclusion cut is kept at all, present it as a robustness check with its sample size shown (n≈42/day, 2 effective providers), not as a headline; the era timeline (A/B/C) belongs in the methodology's limitations section, which already discloses the outage window.
- `test_basis_timeseries_exclude_vast` encodes a market fact as an invariant. Whatever the site's story becomes, the test should assert structure (both paths 200, recompute-vs-precomputed agreement on the full sample — which this investigation verified to 0.01pp), not a direction and magnitude of a market gap.
- Loose end worth a small follow-up: the all-time absence of `spot` commitment among persisted Vast rows (§5) — it silently zeroes the commitment factor for 75% of the corpus.

## Appendix — provenance

- Scripts (scratchpad, not committed): `exclude_vast_investigation.py`, `exclude_vast_followup.py` + two inline snippets; all read-only SELECTs via `async_session_factory`, decompositions via `basis.analytics.basis.compute_decompositions`.
- 8,635 canonical H100 rows since 04-26 (vast 4,828 / aws_spot 2,685 / runpod 1,074 / tensordock 48). TensorDock's 48 rows all pre-date its mid-June freeze and sit inside era A's "other" pool.

---

**Update 2026-07-25:** the Vast bid/spot loose end flagged in §5 has been root-caused and fixed — see [2026-07-24-vast-bid-bug.md](2026-07-24-vast-bid-bug.md). Commitment for Vast derives from query type going forward; historical rows are not retro-labeled.

---

## Addendum (2026-08-01): the corpus rebalance changed what the pooled headline means

The same failure class documented above recurred at corpus scale during the Stage 5
truth patch — and was caught the same way, before publication.

When Azure (Jul 28) and GCP (Jul 30) joined collection, the pooled H100-SXM residual
share collapsed from ~51% (Jul 12–27 mean, four-provider window) to single digits:
administered catalog prices — one list price per (SKU, region, commitment), thousands of
identical rows — are explainable *by construction*, and pooling them drowns the
market-priced segment. Simultaneously, an apparent decline *within* the marketplace
segment (59% → 20% over five days) decomposed into: (a) a **collection artifact** — the
AWS backfill's coverage boundary, where ~27 extra historical rows/day end and the
population thins (fresh cron collection was verified flat, per-region, all week); and
(b) a **real market observation** — era-D Vast spot deepening (spot listings ~doubled,
spot median halved to ~$1.07 while on-demand held).

Resolution: ADR-0007 excludes backfill rows from the live series (same-mechanism cron
sample); the public headline was re-anchored on structural claims frozen to the ML
artifact (observable-features bound; host ICC) with residual share presented as a live,
windowed, segment- and week-conditional range; and the share-vs-absolute distinction is
now in the methodology (absolute residual variance stayed ~stable while the share moved
with its denominator). The 2026-06 lesson generalized: **the pooled headline is a claim
about a population, and the population is a choice.**
