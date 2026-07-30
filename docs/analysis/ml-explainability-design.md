# ML Explainability Design — XGBoost Bound + Host Effects (Stage 3, Task 3.0)

**Status:** APPROVED — Director sign-off 2026-07-29, conditional on Amendments 1–2 (provider scope this cycle; schema + era-derivation touches), both incorporated below. Training runs remain gated on Stage 2 close.
**Author:** Manager (Claude), 2026-07-29. Payload inventory verified against the local corpus (restored 2026-07-29: 507,522 raw rows, 5 sources).
**Governing ADRs:** ADR-0002 (normalization stays rule-based; ML is a separate analysis layer), ADR-0006 (raw_payload access is read-only via FK join).

## Purpose

Establish a defensible upper bound on how much of GPU price variance is explainable from *observable* features, using gradient-boosted trees + SHAP, and decompose the residual's host-identity component. The number this produces qualifies the project headline (rule-based 4-factor decomposition leaves ~X% unexplained) by answering: "is that residual truly unexplained, or just unexplained by four coarse factors?"

---

## 1. Scope & sample

- **SKU:** `h100_sxm_80gb` only. Per-SKU analysis; no pooling — different SKUs are different markets with different provider mixes and price levels; pooling would let the model "explain" cross-SKU level differences and inflate R² meaninglessly.
- **Current sample (local corpus, 2026-07-29):** ~12,200 canonical H100-SXM rows over 95 distinct days. Provider mix: aws_spot 5,770 (incl. 90-day backfill) · vast 5,157 · runpod 1,134 · azure 96 · tensordock 48.
- **Providers (Director Amendment 1):** this training cycle trains and evaluates on **vast, runpod, aws_spot, and historical tensordock only**. Azure (one run of history) and GCP (zero at gate day) are **excluded this cycle**: their rows would sit in the holdout with essentially no training history and drag OOS R² down as an artifact of onboarding timing, not of the thesis. They join at the first retrain once they have real history (§ runbook retrain triggers anticipate exactly this). The trained-provider list is recorded in `metadata.trained_providers` and disclosed in the frontend caveat copy. Extraction takes an explicit provider allowlist parameter.
- **Eras.** A = 04-26→06-15 (pre-cap) · B = 06-16→07-11 (Vast cap/outage; 21 zero-Vast days) · C = 07-12→07-25 (post-auth-fix) · D = 07-26→ (Vast spot rows begin). **Era derivation is total (Amendment 2):** any date before 2026-04-26 maps to label `era_0_backfill` rather than erroring. Factual note: the current corpus has no such rows (backfill min day is 04-30 ≥ era-A start), but future retrains may backfill deeper — the label is defensive and its (currently empty) presence is harmless.
  - **Primary fit: full corpus with `era` as a categorical feature.** Rationale: (a) time-based CV needs the long history — eras C+D alone are ~18 days, too few for expanding-window folds; (b) era-B composition shift (Vast absent) is exactly the kind of observable regime information the model should be allowed to condition on, and SHAP will show honestly how much work the era label does; (c) dropping era B would delete most AWS backfill days too.
  - **Robustness fit: eras C+D only** (healthy collection, Vast spot visible). Reported alongside the primary in the artifact. If the two disagree materially (>0.1 in holdout R²), that is a finding to flag, not smooth over.
  - Era-B capped days need no special handling beyond the label: Vast simply has no rows there; the model sees the surviving providers.
- **AWS backfill rows** carry `provider_metadata.backfill=true` but real historical timestamps; they are treated by their observed day like any row. The spot-history API is the same source cron uses, so no schema drift. Per Amendment 2, the extraction layer surfaces the `backfill` flag (available for filtering and labeling); ruling on its use: it is **not a model feature** — it is collection provenance, perfectly confounded with source × date range, and the era label already carries regime information. It exists in the feature frame as a non-feature metadata column.

## 2. Target & unit of observation

- **Target:** `ln(price_usd_per_hour)` from `canonical_offers` (already USD per GPU-hour). Log because the existing sequential ANOVA (`analytics/basis.py`) is on log-prices — parity is required for the comparison protocol (§5) — and because price ratios are what matter for fungibility.
- **Unit:** one row per **(provider, offer identity, commitment_type, UTC day)**, keeping the **last collection run of the day** (2 runs/day; the later run is closest to the day's ANOVA snapshot and avoids double-counting). Measured duplication in current corpus: Vast H100 averages 2.81 rows per host-day (two runs × od/spot split × multi-slice listings), max 17.
- **Offer identity per source (rule-based, no guessing):**
  - vast: `machine_id` + `num_gpus` + `gpu_frac` (a machine's 1×/2×/4× slices are genuinely distinct offers at distinct per-GPU prices)
  - aws_spot: region + availability-zone + instance_type
  - runpod / azure / gcp: catalog identity as stored (sku/instance-type + region)
  - Fallback where identity fields are absent: hash of the included-feature vector. Documented in code next to each key.
- Same-host-different-commitment rows (od vs spot, era D) are **kept as separate rows** — commitment is a feature; collapsing them would erase exactly the variation the Vast bid fix bought us.

## 3. Feature inventory & leakage audit

### 3.1 Canonical-column features

| column | verdict | why |
|---|---|---|
| provider | **include** | core factor, parity with ANOVA |
| commitment_type | **include** | core factor |
| region_country | **include** | core factor at same granularity ANOVA uses |
| region_state, region_city | exclude | sparse, high-cardinality; country already carries the geo factor — finer geo would credit the GBM for granularity ANOVA never had without disclosing it |
| vcpus_bundled, ram_gb_bundled, storage_gb_bundled | **include** | bundle factor |
| networking_type | **include** | bundle factor |
| verification_tier | **include** | canonical form; supersedes payload `verification`/`vericode` |
| gpu_variant, vram_gb | auto-drop | constant within a single SKU (drop-constant rule, §3.4) |
| price_usd_per_hour | **BANNED** | the target |
| normalized_price_usd_per_hour | **BANNED** | derived from the target |
| id, raw_observation_id | exclude | identifiers |
| collected_at | exclude as feature | used ONLY for splits/dedup. No continuous calendar-time feature: under time-based CV the model would extrapolate a fitted trend into test windows — that measures trend persistence, not feature explanatory power |
| *(engineered)* era ∈ {era_0_backfill,A,B,C,D} | **include** | regime label, §1 rationale; era_0_backfill defensive (empty in current corpus) |
| *(metadata, non-feature)* provider_metadata.backfill | exclude as feature | provenance flag surfaced by extraction for filtering/labeling only (Amendment 2, §1 ruling) |

### 3.2 Vast `raw_payload` keys — full triage (100 keys, verified against corpus 2026-07-29)

Every key observed on H100-SXM Vast rows (key present in 100% of payloads unless noted). Verdicts: **EXCLUDE-P** = price-derived (hard ban), **EXCLUDE-I** = identity/artifact/duplicate, **INCL** = feature.

*Presence ≠ non-null (Stage 3.2 corpus audit):* several always-present keys carry null values — `external` and `nw_disk_{min,avg,max}_bw` are present-but-null corpus-wide, `sla_sigma_x` is null wherever present, and `mobo_name` is ~68% non-null. They stay INCL on paper; the extraction's drop-constant rule (§3.4.2, extended to zero-information columns) removes any that carry no signal at train time, and the ≥95% null-map guard applies only to keys with genuinely full values.

**EXCLUDE-P — price-derived (22 keys).** Any key containing or computed from a price/cost/bid/discount embeds the target:

| key | why banned |
|---|---|
| dph_base, dph_total, dph_total_adj | dollars-per-hour — the target itself |
| discounted_dph_total, discounted_hourly, discount_rate, credit_discount_max | discounted price variants / pricing levers |
| avail_vol_dph | volume-storage price |
| dlperf_per_dphtotal, flops_per_dphtotal | perf-per-dollar ratios — target in the denominator; the numerators survive separately as dlperf / total_flops |
| min_bid | current spot floor price |
| vram_costperhour | price per VRAM unit |
| inet_up_cost, inet_down_cost, internet_up_cost_per_tb, internet_down_cost_per_tb | bandwidth pricing set by the same host |
| storage_cost, storage_total_cost | storage pricing set by the same host |
| score | Vast's ranking score — computed partly FROM dph; a laundered price |
| sla_broker_rate | broker fee rate tied to pricing (70% fill); conservative ban |
| is_bid | pricing-mechanism flag — broken at source (false on 100% of rows, see 2026-07-24 bid-bug report); commitment_type is the honest version |
| time_remaining_isbid | bid-mechanics companion; conservative ban |

**EXCLUDE-I — identity / query artifact / duplicate (27 keys).** Not price leakage, but not features:

| key(s) | why excluded |
|---|---|
| id, ask_contract_id, avail_vol_ask_id, bundle_id, cluster_id, gpu_ids | listing/contract identifiers |
| host_id, machine_id | **reserved for host analysis (§6).** As GBM features they would let the model memorize host price levels — turning the "observable-features bound" into a host-identity lookup and double-counting §6's question |
| hostname, public_ipaddr, logo, webpage | host PII/branding; identity proxies |
| rn, search, bundled_results, instance, avail_vol_size | search-response artifacts of our own query |
| rentable | query filter artifact (we request rentable offers) |
| resource_type | constant "gpu" artifact |
| vericode, verification | duplicates of canonical verification_tier |
| geolocation, geolocode | duplicates of canonical region fields; using both would double-count geo |
| driver_vers | duplicate of driver_version |
| start_date, end_date | raw contract timestamps; `duration` (included) is the informative derivative |
| gpu_name | defines the SKU — constant within sample |

**INCL — candidate features (51 keys).** Machine/host characteristics, all target-independent:

| group | keys |
|---|---|
| GPU hardware | gpu_arch†, gpu_ram†, gpu_total_ram, gpu_frac, num_gpus, gpu_lanes, gpu_mem_bw, gpu_max_power, gpu_max_temp, gpu_display_active, bw_nvlink, compute_cap†, cuda_max_good, total_flops, dlperf |
| CPU/board | cpu_arch, cpu_name*, cpu_cores, cpu_cores_effective, cpu_ghz, cpu_ram, has_avx, mobo_name*, pci_gen, pcie_bw |
| Disk | disk_name*, disk_bw, disk_space, nw_disk_avg_bw, nw_disk_max_bw, nw_disk_min_bw |
| Network | inet_up, inet_down, direct_port_count, static_ip, external |
| Reliability/SLA | reliability, reliability2, reliability_mult, expected_reliability, target_reliability (75.6% fill), sla_r_claim (75.6%), sla_sigma_x (75.6%) |
| Host/platform state | hosting_type, vms_enabled, is_vm_deverified, rented‡, duration, time_remaining, driver_version (parsed numeric), os_version* |

\* high-cardinality strings → top-K levels (K=20 by frequency) + "other"; † expected constant within H100-SXM — the drop-constant rule (§3.4) removes them with a log line; ‡ `rented` is a demand-state signal, not a price: legitimately observable, but SHAP prominence should be discussed as occupancy correlation, not a causal lever.

### 3.3 Non-Vast rows

Vast payload features are NaN on non-Vast rows — XGBoost's native missing handling routes them. Per ADR-0006's honesty note, the doc/frontend must state the model is **Vast-feature-rich**: non-Vast providers are described only by canonical columns, so cross-provider comparisons of SHAP magnitudes are asymmetric by construction. We do NOT mine aws/runpod/azure/gcp payloads for extra keys in v3 — their canonical columns already capture what those catalogs expose (verified when the collectors were built); expanding their feature sets is a v4+ item.

### 3.4 Automated guards (implemented in 3.2, enforced forever)

1. **Banned-substring guard:** extraction output must contain zero columns whose name matches (case-insensitive substring) `dph, price, cost, bid, credit, discount, hourly, perhour, score, broker_rate` — and zero columns not present in this document's triage tables. A NEW payload key appearing in data fails the test until triaged here. (Both directions: nothing banned gets in, nothing un-triaged gets in.)
2. **Drop-constant rule:** columns with one distinct non-null value in the training sample are dropped and logged.
3. **Null-map test:** non-Vast rows NaN on all payload features; Vast rows populate 100%-fill keys at ≥95%.
4. **Join integrity:** every feature row ↔ exactly one canonical offer id; module is SELECT-only (no `session.commit`, enforced by review + a grep test).

## 4. Validation scheme

Time-based splits only, split on **UTC day** (never rows): same offer/host recurs across days, so any random split leaks host identity across train/test.

- **Holdout:** final 10 distinct days — untouched until the single final evaluation.
- **CV folds:** expanding-window over the remaining ~85 days, 4 folds, test windows of ~15 days: F1 train d1–25 / test d26–40 · F2 ≤40 / 41–55 · F3 ≤55 / 56–70 · F4 ≤70 / 71–85 (day indices over sorted distinct days; recomputed at train time as the corpus grows).
- Report **per-fold** n_train / n_test / provider mix / R² — fold composition varies a lot across eras (era-B folds are Vast-free) and a single averaged R² would hide that. Refuse single-number reporting.
- Holdout model trains on all pre-holdout days with the same feature pipeline.
- **Per-provider holdout R² (Amendment 1):** report holdout R² per trained provider alongside the aggregate — if one provider is carrying or tanking the number, that must be visible, not averaged away. Goes into `metrics.r2_holdout_by_provider`.
- Hyperparameters: fixed modest defaults (depth ≤ 6, ≤ 600 trees, early stopping on the last CV fold). No hyperparameter search against the holdout, ever.
- **Automated leakage tests:** (a) per-fold assertion max(train day) < min(test day); (b) permuted-target run — shuffle y within the training set, refit, holdout R² must be ≤ 0.05 (†if it isn't, features encode the target — stop); (c) duplicate-row check across train/test after dedup.

## 5. Comparison protocol — GBM bound vs rule-based ANOVA

On the **same held-out days** (the 10-day holdout, plus per-fold test windows as secondary):

- (a) GBM out-of-sample R² on log-price (1 − SSE/SST computed over pooled holdout rows, with SST from per-day demeaned variance summed over days — matching ANOVA's per-day framing; also report plain pooled R² for transparency);
- (b) sequential-ANOVA explained share = 1 − residual% from the existing `basis_decomposition` rows for `h100_sxm_80gb`, averaged over those same days (both are on log-price — verified in `analytics/basis.py`);
- (c) **gap = (a) − (b)** = what richer features + nonlinearity + interactions buy beyond the 4-factor rule-based decomposition.

**Framing (mandatory wherever these numbers appear, incl. frontend):** this is an **observable-features bound**, not proof about unobservables. A gap of G pp means: of the headline residual, at least G pp is explainable from features we observe but don't use in the rule-based decomposition. It says nothing about unobserved attributes (host reputation off-platform, contract fine print, demand shocks) — the omitted-variable caveat from the external critique stands.

## 6. Host analysis spec

**Question:** after removing day effects, how much of within-day residual log-price variance on Vast H100s is *persistent host identity* vs transient?

- **Panel:** Vast H100-SXM dedup rows (§2 unit), keyed on `machine_id`, **on_demand rows only** (spot exists only from era D — 4 days — mixing commitments would confound host effects with commitment effects). Current panel: 280 hosts, 1,833 host-days.
- **Method:** two-way fixed effects on `ln(price)`: day FE first (removes market drift), then machine FE. Report (a) FE-R² increment of host identity over day-only, and (b) **ICC** = Var(host) / (Var(host) + Var(residual)) from variance components on day-demeaned prices. Multiple offers per host-day (slices) are averaged to one host-day value first.
- **Threshold:** hosts with ≥ **10 observed days** (primary; currently n=61). Sensitivity at ≥5 (n=90) and ≥20 (n=31) — all three reported in the artifact with host counts; if ICC swings > 0.15 across thresholds, flag rather than pick the flattering one.
- Also report the host-tenure distribution (days observed: min/median/max) so readers see the panel is short (current max 51 days).

## 7. Artifact contract (FROZEN at Director sign-off — unblocks 3.4/3.5)

One versioned JSON + one model file (`.ubj`), uploaded to `s3://basis-backups-rajt-2026/models/` as `explainability_v{schema_version}_{trained_at:YYYYMMDD}.json` / `.ubj`, plus a stable alias `explainability_latest.json` the API serves.

```json
{
  "schema_version": "1.0.0",
  "metadata": {
    "trained_at": "2026-07-31T18:00:00Z",
    "sku": "h100_sxm_80gb",
    "trained_providers": ["vast", "runpod", "aws_spot", "tensordock"],
    "corpus_through": "2026-07-30",
    "corpus_rows": 0,
    "n_rows_after_dedup": 0,
    "era_coverage": ["A", "B", "C", "D"],
    "code_version": "<git sha>",
    "xgboost_version": "x.y.z",
    "fixture_hash": "<sha256 of feature-matrix schema>"
  },
  "metrics": {
    "folds": [
      {"fold": 1, "train_days": 25, "test_days": 15, "n_train": 0, "n_test": 0,
       "r2_oos": 0.0, "rmse_log": 0.0, "provider_mix_test": {"vast": 0.0}}
    ],
    "holdout": {"n_days": 10, "n_test": 0, "r2_oos": 0.0, "r2_oos_pooled": 0.0, "rmse_log": 0.0},
    "r2_holdout_by_provider": {"vast": 0.0, "runpod": 0.0, "aws_spot": 0.0, "tensordock": 0.0},
    "anova_explained_same_days": 0.0,
    "gap": 0.0,
    "permuted_target_r2": 0.0,
    "robustness_c_d": {"holdout_r2_oos": 0.0, "n_days": 0}
  },
  "shap_summary": {
    "n_sample": 0,
    "top_features": [{"rank": 1, "feature": "provider", "mean_abs_shap": 0.0}]
  },
  "host_analysis": {
    "icc": 0.0, "fe_r2_increment": 0.0, "n_hosts": 0, "n_host_days": 0,
    "min_days_threshold": 10,
    "sensitivity": [{"threshold": 5, "icc": 0.0, "n_hosts": 0},
                    {"threshold": 20, "icc": 0.0, "n_hosts": 0}],
    "tenure_days": {"min": 0, "median": 0, "max": 0}
  },
  "caveats": [
    "observable-features bound; says nothing about unobserved attributes",
    "Vast-feature-rich: non-Vast providers described by canonical columns only",
    "corpus window 2026-04-26 → <corpus_through>; era B has 21 zero-Vast days",
    "trained on vast/runpod/aws_spot/tensordock only; Azure and GCP join at first retrain with real history"
  ],
  "model_file": "models/explainability_v1.0.0_20260731.ubj"
}
```

Top-N for `shap_summary.top_features` = 20. `caveats` strings are rendered verbatim by the frontend (3.5) — copy is owned by this doc, not by frontend code. Unknown extra fields are allowed (additive evolution); breaking changes bump `schema_version` major.

*Amendment (3.3 review, 2026-07-30):* `metrics.sanity` is a REQUIRED block — `{duplicate_rows_across_split: int, importance_warning: bool, top_gain_importances: [{feature, gain_share}], holdout_pred_vs_actual: {corr, residual_p10, residual_p50, residual_p90}}`. Publishing the sanity battery inside the artifact makes the leakage checks auditable by anyone reading the served JSON, not just PR reviewers.

## 8. Run protocol & reporting thresholds

- `run_train.py`: extract → CV → fit → sanity battery → SHAP → host analysis → artifact (+ `--upload`). Full log pasted into the PR; sanity battery (permuted-target collapse, duplicate check, importance eyeball, holdout pred-vs-actual summary) is a merge requirement.
- **Stop-and-flag thresholds (Director directive):** holdout R² > 0.85 or < 0.2 → halt, investigate before merging anything. Surprising results are where leakage and bugs hide.
- Training runs on the full corpus are gated on Stage 2 close (exit-gate runs 1 & 2 on 2026-07-30).
