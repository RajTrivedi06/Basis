# Context Pack: Analytics

## What this file is for

Dense context for an AI agent working on Phase 3 (analytics). Layer is planned but not yet implemented.

## When to use this

- Building the dispersion engine.
- Building the basis decomposition.
- Designing the daily aggregation job.

---

## Layer purpose

Consume canonical offers, produce:
- **Daily aggregates** — per (GPU SKU, day): median, p25, p75, IQR, CoV.
- **Basis decomposition** — per (GPU SKU, day): variance attributed to region / commitment / provider / bundle / residual.

Writes to `daily_aggregates` and `basis_decomposition` tables (schema in `docs/02-reference/database.md`).

## Key file locations (planned)

```
backend/basis/analytics/
├── dispersion.py       Median, percentiles, IQR, CoV
├── decomposition.py    Variance attribution (ANOVA-style)
├── aggregate.py        Daily materialization job
└── __init__.py
```

Likely entry point: `backend/run_analytics.py` (mirror of `run_normalize.py` style).

## Input contract

Read **only** from `canonical_offers`. Never from `raw_observations` directly. Crossing that boundary would tie analytics to provider-specific quirks.

Minimum columns needed:
- `gpu_sku_canonical`
- `collected_at`
- `provider`
- `commitment_type`
- `region_country`, `region_state`
- `vcpus_bundled`, `ram_gb_bundled`, `storage_gb_bundled`
- `price_usd_per_hour`

## Output contract

### `daily_aggregates`

One row per `(date, gpu_sku, provider?, region?)`. `provider=NULL` and `region=NULL` rows are the "all-markets" summary.

Columns: `observation_count`, `median_price`, `p25_price`, `p75_price`, `normalized_median_price`.

### `basis_decomposition`

One row per `(date, gpu_sku)`.

Columns: `total_variance`, `variance_from_region`, `variance_from_commitment`, `variance_from_bundle`, `variance_from_provider`, `residual_variance`.

Sum of the components ≤ `total_variance`; `residual_variance` absorbs the remainder.

## Design principles

- **Honest missingness.** Not every canonical offer has a region or bundle. Use NULL-aware aggregation (e.g., `PERCENTILE_CONT` in Postgres, or filter to non-null rows explicitly).
- **Per-SKU analysis.** Don't pool across SKUs. H100 SXM and RTX 4090 have different markets.
- **Don't over-normalize.** Price adjustments for bundles should be conservative — e.g., subtract `per_vcpu_hr * vcpus_bundled` only when we have a credible per-unit price.
- **Reproducibility.** Daily aggregates must be regenerable from `canonical_offers`. Add a `--reset` flag.

## Variance decomposition approach (suggested)

Standard sequential ANOVA on log-prices:

```
log(price) ~ region + commitment + provider + bundle_score + residual
```

Each term explains a share of the total sum of squares. `residual` is the basis risk.

Alternative: fit a linear model per SKU and report R² contributions. Use `statsmodels` or numpy; no ML models.

## Invariants (inherited)

- All timestamps UTC.
- All prices USD per GPU per hour.
- Analytics never writes to `canonical_offers` or `raw_observations`.

## Performance notes

- ~10k canonical offers today, growing ~6k/day once cron is consistent. Trivial to handle in Python + Postgres.
- Percentiles can be computed directly in SQL via `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_usd_per_hour)`.
- No need for a separate OLAP layer.

## Not yet decided

- Exact variance attribution method (sequential vs. Shapley-style).
- Whether to compute `normalized_price_usd_per_hour` at normalization time or analytics time.
- Whether to bucket regions by continent for the decomposition (to avoid over-fragmented groups).

Flag these for Raj when you hit them.

## Related

- Phase plan: `docs/project-status.md`
- Schema: `docs/02-reference/database.md`
- ADR on conservatism: `docs/01-architecture/adr/0002-conservative-normalization.md`
