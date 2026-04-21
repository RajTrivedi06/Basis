# Database Reference

## What this file is for

Every table, every column, every index. Source of truth when reading or modifying the schema.

## When to read/use this

- Writing a query.
- Adding a migration.
- Debugging why a column value looks off.

---

## Engine & connection

- **Engine:** PostgreSQL (via Docker Compose).
- **Container:** `basis-db-1`.
- **DB name:** `basis`, user `basis`.
- **Connection URL:** from `DATABASE_URL` in `.env`, loaded by `backend/basis/config.py`.
- **Migrations:** Alembic, in `backend/alembic/`.

Echo (SQL logging) is off by default — see `backend/basis/db/engine.py`.

---

## Tables

### `raw_observations`

Immutable record of every price point captured. **Never modified after insert.**

| Column | Type | Description |
|--------|------|-------------|
| id | int (PK) | Auto-increment |
| source | varchar(50) | Provider id (`vast`, `runpod`, `aws_spot`, `tensordock`) |
| collected_at | timestamptz | UTC timestamp of collection run |
| raw_payload | jsonb | Full provider response, stored verbatim |
| gpu_model_reported | varchar(200) | GPU model as reported by the provider |
| price_hourly | float | Price in USD/GPU/hour as reported |
| region_reported | varchar(200) | Region string as reported |
| commitment_type_reported | varchar(100) | Commitment type as reported |
| provider_metadata | jsonb | Additional provider-specific fields (vCPUs, RAM, verification, etc.) |

**Index:** `(collected_at, gpu_model_reported, source)`

**Invariants:**
- Once written, rows are never updated or deleted.
- `raw_payload` always contains the full response — collectors must not discard fields.
- All prices stored are **per GPU per hour** (collectors convert if the provider quotes per-instance).

---

### `canonical_offers`

Normalized projection of raw observations. Can be **regenerated** from raw observations via `run_normalize.py --reset`.

| Column | Type | Description |
|--------|------|-------------|
| id | int (PK) | Auto-increment |
| raw_observation_id | int (FK → raw_observations.id) | Source row |
| collected_at | timestamptz | Copied from raw observation |
| gpu_sku_canonical | varchar(100) | Standardized SKU (`h100_sxm_80gb`, `a100_sxm_40gb`, ...) |
| gpu_variant | varchar(50) | `sxm`, `pcie`, `nvl`, or NULL |
| vram_gb | int | Extracted from canonical SKU |
| region_country | varchar(100) | ISO 2-letter code (`US`, `JP`, `DE`, ...). Unknown country names from a provider fall through as raw strings until added to the lookup table in `backend/basis/normalization/region.py`. |
| region_state | varchar(100) | State / province |
| region_city | varchar(100) | City if known |
| provider | varchar(50) | Same as raw observation's `source` |
| commitment_type | varchar(50) | Canonical: `on_demand`, `spot`, `reserved_{1w,1m,3m,6m,1y,3y}` |
| vcpus_bundled | int | NULL if unknown |
| ram_gb_bundled | float | NULL if unknown |
| storage_gb_bundled | float | NULL if unknown |
| networking_type | varchar(100) | Interconnect if disclosed (rarely populated) |
| verification_tier | varchar(50) | `verified`, `unverified`, provider-specific tiers |
| price_usd_per_hour | float | Raw price per GPU-hour |
| normalized_price_usd_per_hour | float | Price after observable-factor adjustment. **NULL until Phase 3.** |

**Index:** `(collected_at, gpu_sku_canonical, provider)`

**Relationship:** Each canonical offer links back to exactly one raw observation via FK. This preserves the audit trail: every normalized number can be traced to its provider snapshot.

---

### `daily_aggregates`

Materialized daily summaries for fast dashboard queries. **Not yet populated (Phase 3).**

| Column | Type | Description |
|--------|------|-------------|
| id | int (PK) | Auto-increment |
| date | date | Aggregation date |
| gpu_sku | varchar(100) | Canonical SKU |
| provider | varchar(50) | NULL = all providers |
| region | varchar(100) | NULL = all regions |
| observation_count | int | Number of offers in this bucket |
| median_price | float | Median USD/GPU/hour |
| p25_price | float | 25th percentile |
| p75_price | float | 75th percentile |
| normalized_median_price | float | Median of normalized prices |

**Index:** `(date, gpu_sku)`

---

### `basis_decomposition`

Variance attribution results, one row per (day, GPU SKU). **Not yet populated (Phase 3).**

| Column | Type | Description |
|--------|------|-------------|
| id | int (PK) | Auto-increment |
| date | date | Analysis date |
| gpu_sku | varchar(100) | Canonical SKU |
| total_variance | float | Total price variance |
| variance_from_region | float | Variance attributable to region |
| variance_from_commitment | float | Variance attributable to commitment type |
| variance_from_bundle | float | Variance attributable to bundle composition |
| variance_from_provider | float | Variance attributable to provider identity |
| residual_variance | float | Unexplained (the basis risk finding) |

**Index:** `(date, gpu_sku)`

---

## Common queries

See [../00-start-here/dev-commands.md](../00-start-here/dev-commands.md) for sanity-check queries.

## Schema changes

See [../03-guides/add-migration.md](../03-guides/add-migration.md) (to be written when the first migration after the initial schema lands).
