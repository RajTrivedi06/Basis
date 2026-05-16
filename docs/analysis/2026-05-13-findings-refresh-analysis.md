# Findings refresh — analysis (2026-05-13)

Investigation backing the upcoming refresh of `docs/findings.md` and `docs/methodology.md`. Source: production EC2 Postgres, 18 days of post-cutover data (2026-04-26 → 2026-05-13). Analytics tables only — `basis_decomposition`, `canonical_offers`, `raw_observations`. The Vast-exclusion robustness check (§2) recomputes via the production `compute_decompositions` function on a filtered DataFrame; everything else reads precomputed rows.

One-off script committed at `backend/scripts/decompose_without_vast.py`.

---

## 1. The 2026-05-08 outlier

H100 SXM 80GB residual share on 2026-05-08 was **81.3%** vs. an 18-day median of 59%. Unlike v1's 2026-04-18 outlier (94.7%, attributed in `findings.md:44` to a Vast cron miss), **this is not a missing-data event** — all four providers were active on 5/8 and observation count was normal.

The story is **factor compression**: total variance was unremarkable, but the per-factor attributions (especially region) collapsed to roughly a third of their typical magnitude, leaving a larger share to the residual.

| date  | n_offers | providers (n) | total | region | commit | provider | bundle | resid | %resid |
|-------|---------:|--------------:|------:|-------:|-------:|---------:|-------:|------:|-------:|
| 5/06  |       71 |             4 | 0.319 | 0.064  | 0.029  | 0.006    | 0.017  | 0.204 | 64.0   |
| 5/07  |       77 |             4 | 0.283 | 0.053  | 0.023  | 0.009    | 0.037  | 0.162 | 57.3   |
| **5/08** |    **76** |         **4** | **0.260** | **0.023** | **0.017** | **0.002** | **0.007** | **0.212** | **81.3** |
| 5/09  |       84 |             3 | 0.211 | 0.045  | 0.042  | 0.000    | 0.001  | 0.124 | 58.6   |
| 5/10  |       63 |             4 | 0.210 | 0.019  | 0.060  | 0.004    | 0.002  | 0.125 | 59.5   |

Median region-variance over the other 17 days is ~0.05; on 5/8 it was 0.023. Total variance (0.260) was actually below average — what changed is *where* the variance landed. Per-provider counts on 5/8: vast 32, aws_spot 30, runpod 12, tensordock 2 — the same composition as neighbouring days.

Combined with §2 below: 5/8 is the only day in the 18-day window where the with-Vast and without-Vast residual shares *match* (both 81.3%, delta -0.1 pp). On every other day Vast pulls residual share down by 20–44 pp. So the 5/8 spike is genuinely "what residual share looks like when Vast prices happen to overlap the rest of the market" — a different mechanism from v1's 4/18 (Vast literally absent), but the same observable outcome (factors can't separate against an indistinguishable Vast).

---

## 2. Vast.ai dominance — robustness check

Vast supplies ~80% of all canonical offers (71,770 / 90,054). Recomputing the H100 SXM 80GB decomposition over the same 18 days with Vast offers excluded entirely, using the production `compute_decompositions` function:

| dataset           | n_days | mean | median | std  |
|-------------------|-------:|-----:|-------:|-----:|
| Full (Vast incl.) |     18 | 59.4 | **59.2** | 7.4  |
| Vast excluded     |     18 | 86.8 | **88.6** | 5.1  |

**Median shift: +29.4 pp.** This is not robust. The headline "median ~59%" is deeply Vast-conditional — without Vast, the residual share would be roughly 88%, which is closer to "almost nothing is explained by observable factors." Per-day breakdown:

| date  | full % | no-vast % | delta |
|-------|-------:|----------:|------:|
| 4/26  | 59.4   | 93.0      | +33.6 |
| 4/27  | 64.4   | 92.8      | +28.4 |
| 4/28  | 66.1   | 92.6      | +26.6 |
| …     | …      | …         | …     |
| 5/04  | 45.4   | 88.9      | +43.5 |
| 5/07  | 57.3   | 81.9      | +24.6 |
| **5/08** | **81.3** | **81.3** | **−0.1** |
| 5/09  | 58.6   | 80.7      | +22.1 |
| 5/13  | 59.0   | 80.3      | +21.3 |

Two interpretations, both worth saying out loud:

- **Methodologically:** Vast is a variance-providing population that observable factors *can* attribute against (different verified-tier hosts, geographic spread, bundled-resource diversity). Excluding Vast strips out the offers that the model can explain, leaving the AWS Spot / RunPod / TensorDock prices that cluster within their narrow per-provider bands.
- **Substantively:** the headline is sample-mix-dependent. Anyone reading "59% of variance is unexplained" should know that statistic is conditional on a Vast-heavy population. With a more enterprise-weighted basket the residual share rises sharply.

This is the single most important caveat to surface in the refresh. It does not invalidate the basis-risk thesis — variance that shifts that much across reasonable subsamples is itself the "you can't pick a clean reference price" finding — but it changes how the headline number should be framed.

---

## 3. Headline summary stats

H100 SXM 80GB residual share over 18 days, with and without the 5/8 outlier.

| sample        | n  | mean  | median | std  | p25   | p75   | IQR  | min   | max   |
|---------------|---:|------:|-------:|-----:|------:|------:|-----:|------:|------:|
| All 18 days   | 18 | 59.36 | 59.19  | 7.64 | 56.85 | 63.10 | 6.25 | 45.42 | 81.31 |
| Excl. 5/8     | 17 | 58.07 | 58.99  | 5.49 | 56.82 | 60.65 | 3.83 | 45.42 | 66.05 |

The median moves only **−0.20 pp** when 5/8 is dropped, but the **IQR shrinks from 6.25 to 3.83** and the std from 7.64 to 5.49. Without the outlier, the central 50% of days fits inside a 3.8-pp band around 59%. The headline is genuinely tight; 5/8 is the one ragged day, and even it sits well inside the no-Vast residual baseline (§2).

Practical refresh value: a headline like **"~59% (IQR 57–63%) over 18 days, with one 81% single-day spike"** is honest, reproducible, and far more useful than the v1 "53–95%" range that was driven by a 3-day sample plus the 4/18 cron-gap day.

---

## 4. Cross-SKU residual comparison

Confirmed canonical SKU names: `a100_sxm_80gb`, `rtx_4090_24gb` (note: `rtx_4090` doesn't exist; `rtx_4090d_24gb` is a small separate variant). Stats over the same 18-day window.

| SKU                | n_days | min   | p25   | median | p75   | max   | IQR  |
|--------------------|-------:|------:|------:|-------:|------:|------:|-----:|
| h100_sxm_80gb      |     18 | 45.4  | 56.9  | 59.2   | 63.1  | 81.3  | 6.3  |
| a100_sxm_80gb      |     18 | 16.0  | 21.3  | **24.1** | 28.7 | 41.6  | 7.4  |
| rtx_4090_24gb      |     18 | 78.9  | 84.2  | **86.1** | 88.0 | 90.5  | 3.8  |

**v1's intuition holds and is now firmer:**

- A100 SXM 80GB residual median **24%** with IQR 21–29% (claim was "5–25% range"). Slightly higher than v1's lower bound, but unmistakably a tight, mature SKU with most variance attributable to the four observable factors. All 4 providers active every day.
- RTX 4090 24GB residual median **86%** with IQR 84–88% (claim was "~88%"). Almost dead-on. Three providers consistently (no AWS Spot offering for the 4090). Notably *tighter* IQR than the H100 — the chaos is uniform across days.
- H100 SXM 80GB sits between them, biased low by Vast's contribution as documented in §2.

The texture finding survives: **newer / less-standardized SKU = higher residual share, with diminishing variance across days.** A100 (mature datacenter) → 24%, H100 (new datacenter) → 59%, RTX 4090 (consumer marketplace) → 86%.

---

## 5. TensorDock missing day

**Missing date: 2026-05-01.** Both scheduled runs that day (08:04 UTC and 20:04 UTC) failed with `httpx.ReadTimeout` while fetching `_fetch_locations` from the TensorDock API. This is an upstream API outage, not a cron miss or parse failure — the Basis collector ran on schedule, attempted, and timed out twice.

Excerpt from `journalctl -u basis-collect.service`:

```
May 01 08:04:47  Starting collection from tensordock
May 01 08:05:17  Collection failed for tensordock
                 httpx.ReadTimeout
May 01 20:04:47  Starting collection from tensordock
May 01 20:05:17  Collection failed for tensordock
                 httpx.ReadTimeout
```

Two minor coverage notes worth recording (not "missing days" but partial):

- **2026-04-26**: only the 22:04 cutover collection (33 obs) — first day on EC2.
- **2026-05-11**: morning collection missing, only 20:03 captured (33 obs). H100 SXM 80GB on 5/11 shows 3 providers (no TensorDock), consistent with TensorDock having no H100 SXM 80GB listing in that single evening pull.

No fix needed; flagging for the data-quality footnote in the refresh. TensorDock is the smallest provider in the dataset and intermittent timeouts have minimal effect on the residual decomposition (TensorDock contributed 1,158 / 90,054 ≈ 1.3% of canonical offers).

---

## 6. Implications for the findings.md refresh

**Lead with the median, not the range.** The v1 "53%–95%" headline was an artifact of a 3-day sample dominated by one cron-gap day. With 18 days, H100 SXM 80GB residual share clusters tightly: median 59%, IQR 57–63%, with one 81% spike on 5/8 that is *not* a data quality issue. The new prose should anchor on the median; cite the IQR for the central tendency; and discuss 5/8 explicitly so readers don't second-guess the methodology when they see the chart's outlier dot. The cross-SKU contrast (A100 24%, 4090 86%) is the strongest part of the v1 narrative and should expand to a small table — the texture argument now has 18 days of evidence per SKU rather than 3.

**The Vast caveat is the most important addition.** The headline residual is a Vast-conditional statistic: with the Vast.ai marketplace included, observable factors explain ~40% of log-price variance; without it, ~12%. That ~30-pp gap should appear in `methodology.md` as a robustness section ("the residual share depends on the population mix") and in `findings.md` as a one-paragraph caveat below the headline ("Vast supplies 80% of offers; excluding Vast lifts the residual to ~88%, which suggests the headline is conservative — most of what we *can* explain comes from Vast's heterogeneity"). This reframes the basis-risk thesis as *more* defensible, not less: the floor on unexplained variance is high regardless of which provider mix you choose, which is exactly the "you can't construct a clean reference price" claim the project is trying to make. The 5/8 outlier becomes a useful illustrative example here — it's the one day in the 18-day window where Vast's prices happened to align with the rest of the market, and the residual share immediately jumped to the no-Vast baseline.
