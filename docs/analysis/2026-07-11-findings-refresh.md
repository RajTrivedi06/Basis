---
title: Findings refresh — 77-day window (2026-07-11)
tags: [area:analysis, audience:all, status:active]
owner: Raj
last_updated: 2026-07-11
---

# Findings refresh — 77-day window (2026-07-11)

Re-anchors [findings.md](../findings.md) and [methodology.md](../methodology.md) from the 60-day window (2026-04-26 → 2026-06-24) to the full **77-day** window **2026-04-26 → 2026-07-11**, recomputed against live EC2 production data. Supersedes the [2026-06-24 refresh](2026-06-24-findings-refresh.md); method unchanged (sequential ANOVA on log-prices, `region → commitment → provider → bundle → residual`).

**Headline for this refresh: the medians barely moved, but Vast.ai has returned zero H100-SXM offers for 21 consecutive days (2026-06-23 → 2026-07-11).** The recent climb of the H100 residual to ~90% is a *collection failure, not a market signal*, and it is now the dominant data-quality item — see [§Vast H100-SXM outage](#vast-h100-sxm-outage-the-lead-story).

## Corpus

| Metric | 60-day (2026-06-24) | 77-day (2026-07-11) |
|---|---:|---:|
| Raw observations | 297,242 | 318,372 |
| Canonical offers | 295,047 | 315,743 |
| Canonical SKUs | 96 | 96 |

Provider mix (77-day): Vast.ai 237,746 (75.3%) · AWS Spot 45,448 (14.4%) · RunPod 30,065 (9.5%) · TensorDock 2,484 (0.8%).

**Vast's share fell 79.3% → 75.3%** — not because Vast collection broke wholesale (it still supplies the plurality of offers across all SKUs), but because Vast stopped contributing H100-SXM offers on 2026-06-23 while AWS Spot (+10k) and RunPod (+7k) kept growing. TensorDock is unchanged (2,484), meaning it contributed **no** new canonical offers this window — a second, quieter collection item worth checking.

## Headline — H100 SXM 80GB residual share

| Series | n_days | Median | IQR | Mean | Min | Max | Std |
|---|---:|---:|---:|---:|---:|---:|---:|
| Full (Vast included) | 77 | **60.3%** | 54.0 – 68.4 | 62.4 | 30.9 | 91.6 | 14.6 |
| Vast excluded | 77 | **81.9%** | ~80 – 88 | 80.5 | 50.6 | 93.0 | 11.0 |

**Median shift: +21.6 pp** (was +21.4 pp at 60 days). The core finding is robust: adding 17 days moved the full median by −0.2 pp and the no-Vast median by 0.0 pp.

What *did* change is the **no-Vast spread**: std jumped 4.9 → 11.0 and the min crashed from 75.3% to **50.6%**. Both come entirely from the new curated-only regime that opened on 2026-07-03 (see below) — the no-Vast series is now bimodal, not the tight ~80% band it was at 60 days.

## Cross-SKU (77-day)

| SKU | n_days | Median | IQR | Mean | Min | Max |
|---|---:|---:|---:|---:|---:|---:|
| A100 SXM 80GB | 77 | 29.7% | 22.5 – 34.9 | 28.9 | 9.0 | 62.1 |
| H100 SXM 80GB | 77 | 60.3% | 54.0 – 68.4 | 62.4 | 30.9 | 91.6 |
| RTX 4090 24GB | 77 | 78.9% | 59.5 – 84.9 | 68.2 | 1.6 | 90.5 |

The monotonic "newer/less-standardized → larger residual" ordering holds (A100 < H100 < RTX 4090). RTX 4090's mean (68.2) sits far below its median (78.9) — a wide left tail (min 1.6%) that has grown since 60 days, the same marketplace-day-to-day volatility noted before.

## Vast H100-SXM outage (the lead story)

Vast.ai returned **no H100 SXM 80GB canonical offers on any of the 21 days from 2026-06-23 through 2026-07-11** (plus two earlier isolated misses on 06-16 and 06-17). Every day in the outage sits at exactly **42 offers** — the AWS Spot + RunPod + TensorDock floor — and on those days the Vast-included and Vast-excluded residual series **coincide by construction** (`delta = 0.0`).

The consequence: **all ten of the highest-residual days in the 77-day window fall inside this outage** (2026-06-23 → 07-02, all 86–92%). Anyone reading the live dashboard right now sees an H100 residual near 90% that is an artifact of missing marketplace data, not a real widening of basis. The 77-day median (60.3%) is held up by the earlier Vast-present period and is robust to the outage; single-day numbers since 06-23 are not.

**This is an operational priority.** Three weeks of degraded H100-SXM coverage is well past a transient cron miss.

**Root cause (diagnosed 2026-07-11): a near-total collapse of Vast collection, not a normalization skip and not inventory-growth truncation.** Two `raw_observations` audits settle it:

1. **Not a rename.** Vast's `H100 SXM` (and `H100 NVL`, `H100 PCIE`) rows exist only **through 2026-06-22**, then vanish with *no* new/renamed H100 string after 06-23 — so the rows never reach the database; the canonicalizer is not involved.
2. **Not H100-specific — total Vast volume cratered.** Vast's daily raw-row count dropped from **~6,400/day (06-18 → 06-22) to ~220/day (06-23 →)**, a ~97% collapse across *all* GPUs (06-17 shows the same isolated dip to 221). Since ~6,400 was always well under the collector's `limit: 10000` cap, the earlier "expensive tier truncated as inventory grew past the cap" hypothesis is **wrong** — truncation was never active.

The surviving mechanism: **~220/day matches Vast's small *default* page size** (the code comment at `backend/basis/collectors/vast.py:116` notes the API default is 64; ≈ 64 × 2 query types × 2 daily runs ≈ 220). So our `limit: 10000` **stopped being honored on 2026-06-23** — a Vast server-side change, or a newly-enforced cap on keyless requests (the collector runs without an API key; `vast.py:4` notes a key gives "higher rate limits"). Because the query is ordered cheapest-first (`order dph_total asc`, `vast.py:128,132`), the truncated default page contains only the lowest-priced GPUs and the expensive H100 tier is excluded entirely. **H100 disappearing is a symptom of near-total Vast collection failure, not an H100-specific event.**

**Confirmed by live probe (`backend/scripts/probe_vast_api.py`, 2026-07-11): Vast now hard-caps unauthenticated `/bundles/` responses at 64 offers.** Every keyless variant — current request, `limit:10000`, `limit:100000`, no-limit, and POST-body — returns exactly **n=64**, all in the cheapest price band ($0.03–$0.16/hr), with **no H100**. The `limit` parameter is silently ignored. It reproduces off-EC2 (from a laptop), so it is a global keyless cap, not an IP throttle. Keyless workarounds are dead ends: `offset:64` returns 0 rows, and price-cursor pagination (`dph_total > last_max`) would need ~100+ sequential requests per run to climb from $0.03 to the ~$2–8 H100 tier — certain to trip rate limits twice daily.

**Fix: authenticate with a (free) Vast API key.** Vast's own docs and the collector's header comment (`vast.py:4`) note a key lifts these limits; the collector currently sends none. Plan: register a free key, pass `Authorization: Bearer <key>`, verify with probe variant 7 (`VAST_API_KEY=… uv run python backend/scripts/probe_vast_api.py`) that n ≫ 64 and H100 returns, then backfill via normalize/analytics. Durable secondary fixes regardless: log the skipped `gpu_model_reported` in normalization, and add a **per-provider daily-volume alert** so a 97% collection drop pages immediately instead of surfacing three weeks later in a refresh.

### Two regimes inside the outage — the substantive part

With Vast absent, the residual for the fixed 42-offer curated population is *not* constant. It splits cleanly:

- **2026-06-23 → 07-02: ~86–92%.** Curated prices clustered tightly within their region/commitment bands, so observable factors explained almost nothing and nearly all variance landed in the residual.
- **2026-07-03 → 07-11: ~50–55%.** The same providers, same offer count, but residual share roughly *halved*. AWS Spot prices spread across regions (US ~$2/hr vs Japan $8.60/hr on 2026-07-11), so **region became a strong explainer** and pulled ~40 pp of variance out of the residual.

This is the cleanest evidence yet that even a curated-only, marketplace-free basket carries large, time-varying basis — and that the single lever moving it is cross-region price dispersion within one provider's spot market. It is a natural argument for building the cross-region basis cut.

## Outlier days

- **Missing-Vast spikes (collection artifacts).** 2026-06-23 → 07-02 (86–92%) and the earlier 06-16/06-17 (~84%) are runs where Vast carried no H100-SXM offers (`n_full == n_no_vast`). Same mechanism as v1's 2026-04-18 Vast cron miss, now sustained for three weeks. **Data-quality watch item, escalated to an operational priority.**
- **Factor compression (substantive, Vast present).** 2026-05-08 (81.3%) remains the single cleanest high day with Vast *present* (76 offers, 32 Vast) — total variance slightly below the window median but region-attributable variance collapsed to ~⅓ of typical, pushing the same variance into the residual. It is the only Vast-present day where the full and no-Vast shares match. It is no longer the maximum (the outage days exceed it) but it is the only high day that reflects market structure rather than missing data.

## Fresh price anecdote (2026-07-11)

H100 SXM 80GB ranged from **$1.99/hr** (AWS Spot, US) to **$8.60/hr** (AWS Spot, Japan) — a **4.3× spread within a single provider's spot market**, differing only by region. (Vast was absent on 2026-07-11, so the low end is AWS rather than the usual sub-$1 marketplace listing; the same Japan $8.60 outlier persists from the 2026-06-24 refresh.)

## H100 SXM 80GB — full per-day series (Vast-included vs Vast-excluded)

```
date         full   no_vast  delta   n_full  n_no_vast
2026-04-26   59.4    93.0    +33.6      64       22
2026-04-27   64.4    92.8    +28.4      78       44
2026-04-28   66.1    92.6    +26.6     130       44
2026-04-29   59.5    92.2    +32.7      90       44
2026-04-30   63.9    91.6    +27.6      88       44
2026-05-01   50.2    91.1    +40.9      64       42
2026-05-02   50.1    90.3    +40.2      63       44
2026-05-03   56.8    89.6    +32.7      70       44
2026-05-04   45.4    88.9    +43.5      72       44
2026-05-05   60.7    88.2    +27.5      69       45
2026-05-06   64.0    87.6    +23.6      71       44
2026-05-07   57.3    81.9    +24.6      77       46
2026-05-08   81.3    81.3     -0.1      76       44   ← Vast present, prices overlap
2026-05-09   58.6    80.7    +22.1      84       42
2026-05-10   59.5    80.3    +20.8      63       43
2026-05-11   56.9    80.3    +23.3      57       42
2026-05-12   55.3    80.3    +25.0      62       42
2026-05-13   59.0    80.3    +21.3      64       43
2026-05-14   58.7    80.1    +21.4      71       42
2026-05-15   68.4    79.8    +11.4      48       43
2026-05-16   70.1    79.6     +9.6      54       44
2026-05-17   60.3    79.7    +19.5      71       44
2026-05-18   47.8    79.5    +31.8      83       44
2026-05-19   55.6    78.1    +22.5      87       44
2026-05-20   64.4    76.2    +11.8     110       43
2026-05-21   71.1    76.0     +4.8     111       43
2026-05-22   64.7    75.7    +11.0      93       42
2026-05-23   69.7    75.3     +5.7     101       44
2026-05-24   55.2    75.3    +20.2     145       43
2026-05-25   54.2    75.6    +21.4     125       42
2026-05-26   45.6    76.4    +30.8     128       43
2026-05-27   63.1    77.6    +14.5     141       43
2026-05-28   30.9    79.1    +48.2      76       43
2026-05-29   45.7    79.9    +34.2      76       42
2026-05-30   40.1    79.6    +39.5      83       43
2026-05-31   41.2    80.2    +39.1      94       44
2026-06-01   45.2    81.3    +36.2     115       42
2026-06-02   43.4    81.8    +38.4     118       42
2026-06-03   41.4    81.8    +40.3      94       42
2026-06-04   40.6    81.6    +41.0      86       42
2026-06-05   40.9    81.1    +40.2      79       42
2026-06-06   48.5    82.3    +33.8     134       42
2026-06-07   68.1    81.9    +13.8     143       42
2026-06-08   72.2    82.8    +10.6     159       42
2026-06-09   72.0    83.4    +11.3     153       42
2026-06-10   65.0    84.5    +19.5     154       42
2026-06-11   63.9    84.8    +20.9     165       42
2026-06-12   62.7    84.3    +21.6     182       42
2026-06-13   61.0    84.6    +23.6     192       42
2026-06-14   66.0    84.3    +18.3     193       42
2026-06-15   62.8    83.8    +21.0     118       42
2026-06-16   83.9    83.9     +0.0      42       42   ← Vast absent
2026-06-17   83.6    83.6     +0.0      42       42   ← Vast absent
2026-06-18   57.2    84.0    +26.8     152       42
2026-06-19   65.1    86.2    +21.1     175       42
2026-06-20   68.2    87.1    +18.9     200       42
2026-06-21   65.7    88.0    +22.3     197       42
2026-06-22   69.4    89.1    +19.6     161       42
2026-06-23   89.9    89.9     +0.0      42       42   ← outage begins
2026-06-24   90.3    90.3     +0.0      42       42
2026-06-25   90.9    90.9     +0.0      42       42
2026-06-26   91.1    91.1     +0.0      42       42
2026-06-27   91.3    91.3     +0.0      42       42
2026-06-28   91.2    91.2     +0.0      42       42
2026-06-29   91.1    91.1     +0.0      42       42
2026-06-30   91.2    91.2     +0.0      42       42
2026-07-01   91.6    91.6     +0.0      42       42
2026-07-02   86.3    86.3     +0.0      42       42
2026-07-03   54.2    54.2     +0.0      42       42   ← curated region-spread regime opens
2026-07-04   54.7    54.7     +0.0      42       42
2026-07-05   54.8    54.8     +0.0      42       42
2026-07-06   54.5    54.5     +0.0      42       42
2026-07-07   54.0    54.0     +0.0      42       42
2026-07-08   53.3    53.3     +0.0      42       42
2026-07-09   52.9    52.9     +0.0      42       42
2026-07-10   51.9    51.9     +0.0      42       42
2026-07-11   50.6    50.6     +0.0      21       21   ← Vast absent (partial day)

Full dataset  : n=77  mean=62.44  median=60.26  std=14.62
Vast excluded : n=77  mean=80.50  median=81.89  std=11.02
Median shift (no_vast − full): +21.63 pp
```

## What changed vs the 2026-06-24 refresh

- H100 headline: 60% / 82% → **60% / 82%** (median shift +21.4 → +21.6). Medians are effectively unchanged — the finding is stable across the extra 17 days.
- Corpus grew 295k → 316k canonical offers; SKU count flat at 96.
- Vast share fell 79.3% → **75.3%**, driven by the H100-SXM outage rather than a broad Vast failure.
- **New: the Vast H100-SXM outage is now sustained (21 days), not intermittent.** It owns the entire top-residual tail and is escalated from a footnote to an operational priority.
- **New: a two-regime split inside the outage** — curated-only residual ran ~90% through 07-02, then halved to ~52% from 07-03 as AWS regional dispersion widened. The no-Vast min dropped 75.3 → 50.6 and std rose 4.9 → 11.0 as a result.
- TensorDock contributed no new canonical offers this window (still 2,484) — a secondary collection item.

## Reproduction

Read-only, run on EC2 (live Postgres `basis-db-1`, `127.0.0.1:5433`):

- Summary numbers (corpus, provider mix, per-SKU residual stats, outlier days, anecdote, Vast-dropout days): `docker exec -i basis-db-1 psql -U basis -d basis` with the audit queries in this refresh's command bundle.
- Vast-excluded H100 per-day series: `backend/scripts/decompose_without_vast.py` (window now env-driven — defaults to `SINCE=2026-04-26` and `UNTIL=today`; override with `SINCE=`/`UNTIL=`). Run from `backend/` with `DB_HOST=127.0.0.1 DB_PORT=5433 PGPASSWORD=$(...)`.

Twice-daily `collect_cron.sh` (collect → normalize → analytics) keeps `basis_decomposition` current, so the Vast-included per-SKU stats come straight from that table; only the no-Vast series is computed ad hoc.
