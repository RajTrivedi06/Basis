---
title: Findings refresh — 60-day window (2026-06-24)
tags: [area:analysis, audience:all, status:active]
owner: Raj
last_updated: 2026-06-24
---

# Findings refresh — 60-day window (2026-06-24)

Re-anchors [findings.md](../findings.md) and [methodology.md](../methodology.md) from the original 18-day window (2026-04-26 → 2026-05-13) to the full **60-day** window **2026-04-26 → 2026-06-24**, recomputed against live EC2 production data. Supersedes the [2026-05-13 refresh](2026-05-13-findings-refresh-analysis.md); method unchanged (sequential ANOVA on log-prices, `region → commitment → provider → bundle → residual`).

## Corpus

| Metric | 18-day (2026-05-13) | 60-day (2026-06-24) |
|---|---:|---:|
| Raw observations | 90,161 | 297,242 |
| Canonical offers | 90,054 | 295,047 |
| Canonical SKUs | 93 | 96 |

Provider mix (60-day): Vast.ai 234,100 (79.3%) · AWS Spot 35,282 (12.0%) · RunPod 23,181 (7.9%) · TensorDock 2,484 (0.8%).

## Headline — H100 SXM 80GB residual share

| Series | n_days | Median | IQR | Mean | Min | Max | Std |
|---|---:|---:|---:|---:|---:|---:|---:|
| Full (Vast included) | 60 | **60.5%** | 53.2 – 66.0 | 60.0 | 30.9 | 90.2 | 12.2 |
| Vast excluded | 60 | **81.9%** | 79.9 – 87.2 | 83.2 | 75.3 | 93.0 | 4.9 |

**Median shift: +21.4 pp** (was +29.4 pp at 18 days). The gap narrowed because the no-Vast series drifts *down* over the longer window (from ~93% in late April to the high-70s by late May) while the Vast-inclusive series holds near 60%.

## Cross-SKU (60-day)

| SKU | n_days | Median | IQR | Mean | Min | Max |
|---|---:|---:|---:|---:|---:|---:|
| A100 SXM 80GB | 60 | 28.8% | 22.5 – 34.4 | 29.0 | 12.6 | 62.1 |
| H100 SXM 80GB | 60 | 60.5% | 53.2 – 66.0 | 60.0 | 30.9 | 90.2 |
| RTX 4090 24GB | 60 | 80.5% | 74.3 – 85.0 | 75.4 | 13.9 | 90.5 |

The monotonic "newer/less-standardized → larger residual" ordering holds (A100 < H100 < RTX 4090). RTX 4090's mean (75.4) sits well below its median (80.5), reflecting a few low-residual days that widen its spread relative to the 18-day picture.

## Outlier days

Two distinct kinds of high day:

- **Missing-Vast spikes (collection artifacts).** 2026-06-24 (90.2%), 2026-06-23 (89.9%), 2026-06-16 (83.9%), 2026-06-17 (83.6%) are runs where Vast carried **no** H100-SXM offers (`n_full == n_no_vast`). The population collapses to the narrow-band AWS/RunPod/TensorDock prices and the two series coincide. Same mechanism as v1's 2026-04-18 Vast cron miss. **Data-quality watch item:** intermittent Vast coverage for this SKU on recent runs.
- **Factor compression (substantive).** 2026-05-08 (81.3%) is the cleanest high day with Vast *present* (76 offers, 32 Vast). Total variance was slightly below the window median (0.261 vs 0.271), but region-attributable variance collapsed to ~⅓ of typical (0.023 vs ~0.061), pushing the same variance into the residual. It is the only Vast-present day where the full and no-Vast shares match.

## Fresh price anecdote (2026-06-24)

H100 SXM 80GB ranged from **$1.36/hr** (AWS Spot, US) to **$8.60/hr** (AWS Spot, Japan) — a 6.3× spread within a single provider's spot market, differing only by region. (Vast was absent on 2026-06-24, so the low end is AWS rather than the usual sub-$1 marketplace listing.)

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
2026-06-23   89.9    89.9     +0.0      42       42   ← Vast absent
2026-06-24   90.2    90.2     +0.0      21       21   ← Vast absent (partial day)

Full dataset  : n=60  mean=60.03  median=60.46  std=12.25
Vast excluded : n=60  mean=83.22  median=81.89  std=4.93
Median shift (no_vast − full): +21.44 pp
```

## What changed vs the 2026-05-13 refresh

- H100 headline: 59% / 89% → **60% / 82%** (no-Vast came down; +pp shift narrowed 29→21).
- Corpus tripled (90k → 295k offers); SKU count 93 → 96.
- New phenomenon: **intermittent Vast dropouts** on recent runs (6/16, 6/17, 6/23, 6/24) — now the top residual days, and a collection-reliability item rather than a market signal.
- 2026-05-08 remains the cleanest factor-compression example, but is no longer the maximum.

## Reproduction

Read-only, run on EC2 (live Postgres `basis-db-1`, `127.0.0.1:5433`):

- Summary numbers (corpus, provider mix, per-SKU residual stats, outlier days, anecdote): `docker exec -i basis-db-1 psql -U basis -d basis` with the audit queries.
- Vast-excluded H100 per-day series: `backend/scripts/decompose_without_vast.py` with `UNTIL` extended to today and `DB_HOST=127.0.0.1 DB_PORT=5433 PGPASSWORD=$(...)`.

Nightly `collect_cron.sh` (collect → normalize → analytics) keeps `basis_decomposition` current, so the Vast-included per-SKU stats come straight from that table; only the no-Vast series is computed ad hoc.
