---
title: Domain Model
tags: [area:reference, audience:developers, status:active]
owner: Raj
last_updated: 2026-07-24
---

# Domain Model

The core entities that Basis reasons about, how they relate, and where they live.

---

## Core Entities

### Raw Observation

An immutable snapshot of what a single provider returned for a single GPU offering at a single point in time.

**Key fields:**
- `source` — provider id (`vast`, `runpod`, `aws_spot`, `tensordock`)
- `collected_at` — UTC timestamp
- `raw_payload` — the full provider response, JSONB, stored verbatim
- `gpu_model_reported` — provider's name for the GPU (not yet canonical)
- `price_hourly` — USD per GPU per hour (collector converts if provider quotes differently)
- `region_reported`, `commitment_type_reported`, `provider_metadata`

**Lifecycle:** write once, never modify. The audit trail of every price Basis has observed.

**Storage:** `raw_observations` table. See [database.md](../02-reference/database.md#raw_observations).

---

### Canonical Offer

A normalized projection of a raw observation. Standardized enough to compare across providers.

**Key fields:**
- `raw_observation_id` — FK back to the source raw row
- `gpu_sku_canonical` — e.g., `h100_sxm_80gb` (one of ~100 canonical SKUs)
- `gpu_variant` — `sxm` / `pcie` / `nvl`
- `vram_gb` — derived from the canonical SKU
- `provider`, `commitment_type`, `region_{country,state,city}`
- `vcpus_bundled`, `ram_gb_bundled`, `storage_gb_bundled`, `verification_tier`
- `price_usd_per_hour` — copied from raw
- `normalized_price_usd_per_hour` — adjusted for observable factors (populated by the analytics layer)

**Lifecycle:** regenerable. `run_normalize.py --reset` wipes and rebuilds from raw observations.

**Storage:** `canonical_offers` table. See [database.md](../02-reference/database.md#canonical_offers).

---

### GPU SKU (canonical)

A single identifier for a specific GPU model + form factor + VRAM combo. Not a database entity — a string referenced by canonical offers and aggregates.

**Format:** `{model}_{form_factor}_{vram_gb}gb`

**Examples:**
- `h100_sxm_80gb`, `h100_pcie_80gb`, `h100_nvl_94gb`
- `h200_sxm_141gb`, `h200_nvl_141gb`
- `a100_sxm_80gb`, `a100_sxm_40gb`, `a100_pcie_80gb`
- `rtx_4090_24gb`, `rtx_5090_32gb`, `rtx_a6000_48gb`
- `mi300x_192gb`

**Source of truth:** `GPU_NAME_MAP` in `backend/basis/normalization/canonicalize.py`.

**Invariant:** different form factors (SXM vs PCIe) → different canonical SKUs. Different VRAM → different canonical SKUs. Normalization never collapses meaningful hardware differences.

---

### Commitment Type (canonical)

How long the buyer is committed; correlates strongly with price.

**Canonical values:**
- `on_demand` — pay-as-you-go
- `spot` — interruptible, discounted
- `reserved_{1w,1m,3m,6m,1y,3y}` — fixed-duration commitment

**Source of truth:** `COMMITMENT_TYPE_MAP` in `backend/basis/normalization/commitment.py`.

---

### Provider

The cloud service the observation came from.

**Active providers (3):** `vast`, `runpod`, `aws_spot`.

**Parked:** `tensordock` (public feed empty since 2026-07-13).

**Dropped:** `lambda_labs` (ADR 0003).

Historical canonical data includes all four non-Lambda providers. Provider table:

| Id | Name | Type |
|----|------|------|
| `vast` | Vast.ai | Marketplace (individual sellers) |
| `runpod` | RunPod | Neocloud (curated datacenters) |
| `aws_spot` | AWS EC2 Spot | Hyperscaler spot market |
| `tensordock` | TensorDock | Neocloud marketplace (parked) |
| `lambda_labs` | Lambda Labs | Neocloud (dropped — ADR 0003) |

---

### Region

Where the instance is physically located. Normalized to `(country, state, city)` with any field possibly `NULL`.

- `aws_spot` → stripped AZ (`us-east-1a` → `US, Virginia, NULL`).
- `vast` → split on `,` (`"Virginia, US"` → `US, Virginia, NULL`).
- `tensordock` → three-part strings (`"Las Vegas, Nevada, US"` → `US, Nevada, Las Vegas`).
- `runpod` → no region at the offer level (all fields `NULL`).

---

### Bundle

Resources included in the GPU offering beyond the GPU itself: vCPUs, RAM, storage. Providers differ in what they include (some unbundle CPU/RAM/storage as line items; some bundle).

**Fields:** `vcpus_bundled`, `ram_gb_bundled`, `storage_gb_bundled`, `networking_type`, `verification_tier`.

**Missingness is honest:** AWS Spot canonical offers all have `NULL` bundle fields. RunPod offers have `NULL` storage. Analytics must be NULL-aware.

---

### Daily Aggregate

Pre-computed daily summary per (date, gpu_sku, provider, region). Populated by the analytics layer.

Tracks: observation count, median, p25, p75, normalized_median.

**Storage:** `daily_aggregates` table.

---

### Basis Decomposition

The headline output. Per (date, gpu_sku): how total price variance breaks down.

Columns: `total_variance`, `variance_from_region`, `variance_from_commitment`, `variance_from_bundle`, `variance_from_provider`, `residual_variance`.

`residual_variance` is the **basis risk** — the unexplained chunk, the number the writeup is built around.

**Storage:** `basis_decomposition` table.

---

## Relationships

```
Provider ──────────┐
                   │
                   ▼
Raw Observation ──┬─ gpu_model_reported
                  └─ region_reported
                      │
                      │  (normalization pipeline)
                      ▼
Canonical Offer ──┬─ gpu_sku_canonical (→ a GPU SKU)
                  ├─ commitment_type   (→ a Commitment Type)
                  ├─ region_{country,state,city}  (→ a Region)
                  ├─ {vcpus,ram_gb,storage_gb}_bundled  (→ a Bundle)
                  └─ provider          (→ a Provider)
                      │
                      │  (analytics pipeline)
                      ▼
           Daily Aggregate  +  Basis Decomposition
```

Every canonical offer links back to its raw observation. Every aggregate summarizes a set of canonical offers. No entity ever skips a layer — canonical offers are never derived from raw observations without going through normalization, and aggregates are never derived directly from raw observations.

---

## Data Boundaries

| Entity | Written by | Read by |
|--------|-----------|---------|
| Raw Observation | Collectors only | Normalization, (possibly) ad-hoc queries |
| Canonical Offer | Normalization pipeline only | Analytics, ad-hoc queries |
| Daily Aggregate | Analytics only | API |
| Basis Decomposition | Analytics only | API |
| Config (`.env`) | Human | Everything |

Crossing these boundaries (e.g., a collector writing to canonical offers, or the API reading from raw observations) is forbidden. See [../01-architecture/system-overview.md#invariants](../01-architecture/system-overview.md#invariants).

---

## Thesis entities

The writeup (Phase 6) will talk about:

- **Dispersion** — how wide the price distribution is for a given GPU SKU on a given day.
- **Explainable variance** — the portion attributable to observable factors.
- **Residual basis risk** — the portion that remains after accounting for observable factors. This is the finding.
- **Market maturity** — whether dispersion narrows or widens over time (observed across the time series of daily aggregates).
