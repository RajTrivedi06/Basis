# API Reference

## What this file is for

REST endpoints exposed by the FastAPI backend. Source of truth for any client (frontend, external script, future integration).

## When to read/use this

- Building a frontend page or chart.
- Writing an external client.
- Reviewing API design.

---

## Status

**10 endpoints live.** The original 6 shipped 2026-04-20; `/api/fungibility-matrix` shipped 2026-04-21 as part of Basis v2 Phase A; three provenance drilldown endpoints shipped 2026-04-21 as part of Basis v2 Phase B. All return real data from `canonical_offers`, `daily_aggregates`, `basis_decomposition`, and `raw_observations`.

---

## Base URL

- Local dev: `http://localhost:8000`
- OpenAPI UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Auth

**None.** Public research tool. No tokens, no user accounts. If deployed publicly, rate-limit at the edge (e.g., Cloudflare).

## CORS

Open to `http://localhost:3000` in dev. Configured in `basis/api/main.py`.

---

## `GET /health`

Simple readiness check.

**Response:**

```json
{ "status": "ok", "version": "0.1.0", "environment": "dev" }
```

---

## `GET /api/offers`

List canonical offers with filters and pagination.

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `gpu_sku` | string | Filter by canonical SKU (e.g., `h100_sxm_80gb`) |
| `provider` | string | `vast` / `runpod` / `aws_spot` / `tensordock` |
| `commitment_type` | string | `on_demand` / `spot` / `reserved_{1w,1m,3m,6m,1y,3y}` |
| `region_country` | string | Country code or name (see note below) |
| `since` | datetime | ISO timestamp — observations at or after |
| `until` | datetime | ISO timestamp — observations strictly before |
| `page` | int | ≥ 1, default 1 |
| `page_size` | int | 1–500, default 50 |

**Note on `region_country`:** There's a pending normalization inconsistency — AWS stores ISO-2 (`JP`, `US`) while TensorDock stores full names (`United States`). Filtering may miss rows until this is cleaned up.

**Response** (`OfferListResponse`):

```json
{
  "items": [
    {
      "id": 7966,
      "collected_at": "2026-04-20T23:20:20.670800Z",
      "gpu_sku": "h100_sxm_80gb",
      "provider": "tensordock",
      "region_country": "United States",
      "commitment_type": "on_demand",
      "price_usd_per_hour": 1.99,
      "normalized_price_usd_per_hour": null
    }
  ],
  "total": 193,
  "page": 1,
  "page_size": 3
}
```

`raw_payload` is never returned — that's internal audit only.

---

## `GET /api/dispersion/{gpu_sku}`

Dispersion time series for a canonical SKU, read from `daily_aggregates`.

**Path:**

- `gpu_sku` — e.g., `h100_sxm_80gb`

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `since` | date | Include points at or after |
| `until` | date | Include points at or before |
| `provider` | string | Restrict to one provider (default: all-providers rollup) |

**Behavior:**
- Default (no `provider`): returns the all-providers rollup rows where `daily_aggregates.provider IS NULL`.
- With `provider`: returns that provider's daily rows. 404 if no data for that (SKU, provider) combo.

**Response** (`DispersionResponse`):

```json
{
  "gpu_sku": "h100_sxm_80gb",
  "points": [
    {
      "date": "2026-04-20",
      "gpu_sku": "h100_sxm_80gb",
      "observation_count": 66,
      "median_price": 1.867,
      "p25_price": 1.467,
      "p75_price": 2.090,
      "iqr": 0.623,
      "coefficient_of_variation": null
    }
  ]
}
```

`iqr` is computed on the fly as `p75 - p25`. CoV is not stored (would need raw observations); returned as `null` until a future migration adds it.

---

## `GET /api/basis/{gpu_sku}`

Variance decomposition for a (SKU, date). Defaults to the latest decomposition available for that SKU.

**Path:**

- `gpu_sku` — e.g., `h100_sxm_80gb`

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `date` | date | Specific date; defaults to latest |

**Response** (`BasisDecompositionResponse`):

```json
{
  "date": "2026-04-20",
  "gpu_sku": "h100_sxm_80gb",
  "total_variance": 0.301,
  "variance_from_region": 0.086,
  "variance_from_commitment": 0.019,
  "variance_from_bundle": 0.035,
  "variance_from_provider": 0.0,
  "residual_variance": 0.161,
  "pct_explained": 46.5,
  "pct_residual": 53.5
}
```

**404** when no decomposition exists for that SKU (or SKU + date).

---

## `GET /api/providers`

Per-provider summary across the full dataset, plus median deviation vs. market median on the latest observation date.

**Response** (`ProviderListResponse`):

```json
{
  "items": [
    {
      "provider": "vast",
      "offer_count": 8417,
      "distinct_skus": 90,
      "latest_collection": "2026-04-20T23:20:11.517925Z",
      "median_deviation_pct": -1.58
    },
    {
      "provider": "runpod",
      "offer_count": 564,
      "distinct_skus": 40,
      "latest_collection": "2026-04-20T23:20:17.290215Z",
      "median_deviation_pct": 40.79
    }
  ]
}
```

`median_deviation_pct` is the mean across SKUs of `(provider_median - market_median) / market_median * 100` on the latest date. Negative = cheaper than market on average.

---

## `GET /api/gpu-skus`

List of canonical SKUs with coverage and latest median price.

**Response** (`GpuSkuListResponse`):

```json
{
  "items": [
    {
      "gpu_sku": "h100_sxm_80gb",
      "gpu_variant": "sxm",
      "vram_gb": 80,
      "offer_count": 193,
      "provider_count": 4,
      "latest_median_price": 1.867
    }
  ]
}
```

`latest_median_price` comes from the latest `daily_aggregates` all-providers rollup. Null if the SKU has fewer than 3 offers on the latest date.

---

## `GET /api/fungibility-matrix`

One row per canonical SKU at its latest observed date, joining `daily_aggregates` (all-providers rollup) with `basis_decomposition` on `(date, gpu_sku)`. SKUs below the 5-observation decomposition threshold return null residual fields; the frontend renders those as *accumulating*.

Powers the landing-page fungibility matrix. Reads aggregates only — does not invoke analytics at request time.

**Query parameters:** none.

**Response** (`FungibilityMatrixResponse`):

```json
{
  "items": [
    {
      "gpu_sku": "h100_sxm_80gb",
      "latest_date": "2026-04-20",
      "median_price": 1.867,
      "observation_count": 66,
      "provider_count": 4,
      "total_variance": 0.301,
      "residual_variance": 0.161,
      "pct_residual": 53.5
    },
    {
      "gpu_sku": "b300_sxm_288gb",
      "latest_date": "2026-04-20",
      "median_price": 7.165,
      "observation_count": 4,
      "provider_count": 1,
      "total_variance": null,
      "residual_variance": null,
      "pct_residual": null
    }
  ]
}
```

`provider_count` is the number of distinct non-null providers in `daily_aggregates` for that `(gpu_sku, latest_date)`. Server returns rows alphabetically by `gpu_sku`; the frontend applies its own sort.

---

## `GET /api/decomposition/{gpu_sku}/observations`

Canonical offers that contributed to a given (gpu_sku, date) decomposition bucket. Powers the provenance drilldown drawer surfaced from the Basis decomposition page.

**Path:**

- `gpu_sku` — e.g., `h100_sxm_80gb`

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `date` | date | Bucket date; defaults to the latest date for which a decomposition exists for that SKU |

**Behavior:**
- If `date` is omitted, the endpoint looks up the latest `basis_decomposition.date` for the SKU and returns all canonical offers matching that UTC day.
- Returns 404 if no decomposition exists for the SKU (and no `date` was given to disambiguate).
- Date bucketing matches the analytics layer: `collected_at` is grouped by UTC day (`pd.to_datetime(collected_at, utc=True).dt.date` equivalent).

**Response** (`DecompositionObservationsResponse`):

```json
{
  "gpu_sku": "h100_sxm_80gb",
  "date": "2026-04-20",
  "items": [
    {
      "canonical_offer_id": 4400,
      "raw_observation_id": 8400,
      "collected_at": "2026-04-20T23:20:11.517925Z",
      "provider": "vast",
      "price_usd_per_hour": 1.3348,
      "commitment_type": "on_demand",
      "region_country": "TH",
      "region_state": "Thailand",
      "region_city": null,
      "vcpus_bundled": 28,
      "ram_gb_bundled": 251.9,
      "storage_gb_bundled": 5810.5125,
      "verification_tier": "unverified"
    }
  ]
}
```

Null factor values (`region_country: null`, etc.) are returned as-is; the frontend renders them as explicit `UNKNOWN` rather than hiding them.

---

## `GET /api/raw-observation/{id}`

Raw observation row by id, including the full provider payload. Used by the raw observation inspector surfaced from the drilldown drawer.

**Path:**

- `id` — `raw_observations.id` integer

**Response** (`RawObservationDetail`):

```json
{
  "id": 8400,
  "source": "vast",
  "collected_at": "2026-04-20T23:20:11.517925Z",
  "gpu_model_reported": "H100 SXM",
  "price_hourly": 1.3348,
  "region_reported": "Thailand, TH",
  "commitment_type_reported": "on_demand",
  "provider_metadata": { "...": "..." },
  "raw_payload": { "...": "..." }
}
```

`raw_payload` is returned in full — no truncation. Payloads are generally <10KB per row (a single provider-side record); revisit if that changes.

**404** when no raw observation with that id exists.

---

## `GET /api/raw-observation/{id}/explain`

Runs a raw observation through every `explain_*` normalization function and returns the composed attribution trail.

**Path:**

- `id` — `raw_observations.id` integer

Per [ADR 0004](../01-architecture/adr/0004-normalization-attribution.md), this route is the sole caller of the `explain_*` functions. The canonicalization pipeline (`backend/basis/normalization/pipeline.py`) never imports any `explain_*` symbol; this is enforced by an AST-level guard test in `backend/tests/test_normalization.py`.

**Fidelity:** the explain functions and the canonicalization pipeline derive canonical values from the same lookup tables. Fidelity was verified on 2026-04-21 by cross-checking `canonical_offers[4400]` against `explain(raw_observations[8400])` — every stored canonical field matched the explain-derived value.

**Response** (`RawObservationExplainResponse`):

```json
{
  "raw_observation_id": 8400,
  "source": "vast",
  "gpu": {
    "reported_name": "H100 SXM",
    "matched": true,
    "canonical_sku": "h100_sxm_80gb",
    "gpu_variant": "sxm",
    "vram_gb": 80,
    "rules": [
      "GPU_NAME_MAP['H100 SXM'] -> 'h100_sxm_80gb'",
      "variant: 'sxm' (canonical SKU contains '_sxm')",
      "vram_gb: 80 (parsed from 'h100_sxm_80gb' suffix)"
    ]
  },
  "commitment": {
    "reported_type": "on_demand",
    "canonical_type": "on_demand",
    "rule": "table_match",
    "matched_key": "on_demand"
  },
  "region": {
    "source": "vast",
    "region_reported": "Thailand, TH",
    "branch": "vast",
    "country": "TH",
    "state": "Thailand",
    "city": null,
    "trail": ["..."]
  },
  "bundle": {
    "source": "vast",
    "branch": "vast",
    "vcpus": 28,
    "ram_gb": 251.9,
    "storage_gb": 5810.5125,
    "networking_type": null,
    "verification_tier": "unverified",
    "fields": [
      {
        "canonical_field": "ram_gb",
        "source_field": "cpu_ram_mb",
        "source_value": 257985,
        "result": 251.9,
        "transformation": "round(cpu_ram_mb / 1024.0, 1)"
      }
    ]
  }
}
```

Each module's attribution has its own shape; shapes are intentionally heterogeneous per ADR 0004. Rule-of-thumb: `rules`/`trail` are human-readable narrative steps; `matched`/`branch`/`rule` are structured status fields.

**404** when no raw observation with that id exists.

---

## Schema definitions

All response models live in `backend/basis/schemas/api.py`:

- `OfferSummary`, `OfferListResponse`
- `DispersionPoint`, `DispersionResponse`
- `BasisDecompositionResponse`
- `ProviderSummary`, `ProviderListResponse`
- `GpuSkuSummary`, `GpuSkuListResponse`
- `FungibilityMatrixRow`, `FungibilityMatrixResponse`
- `DecompositionObservation`, `DecompositionObservationsResponse`
- `RawObservationDetail`
- `GpuCanonicalizationExplanationSchema`, `CommitmentCanonicalizationExplanationSchema`,
  `RegionNormalizationExplanationSchema`, `BundleFieldProvenanceSchema`,
  `BundleExtractionExplanationSchema`, `RawObservationExplainResponse`
- `HealthResponse`

## Adding a new endpoint

1. Define / extend a Pydantic response model in `schemas/api.py`.
2. Create or edit the route in `backend/basis/api/routes/<name>.py`.
3. Register the router in `basis/api/main.py`.
4. Add a smoke test once `tests/test_api.py` exists.
5. Document here: description, params, response example, errors.
