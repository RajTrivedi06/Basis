# Data Flow

## What this file is for

Trace a single price observation from "provider API responds" to "canonical offer in DB". If you're trying to understand why a column ends up with a particular value, this is the doc.

## When to read/use this

- Debugging why a price looks wrong in `canonical_offers`.
- Designing a new collector and not sure what to put where.
- Explaining the system to a non-technical stakeholder.

---

## Example: one Vast.ai H100 offer

**1. Vast.ai API returns:**

```json
{
  "id": 12345,
  "gpu_name": "H100 SXM",
  "dph_total": 1.50,
  "geolocation": "Virginia, US",
  "num_gpus": 1,
  "cpu_cores_effective": 16,
  "cpu_ram": 131072,
  "disk_space": 1000,
  "verification": "verified",
  ...40 more fields
}
```

**2. `VastCollector.collect()`** wraps this into a `RawObservationCreate`:

```python
RawObservationCreate(
    source="vast",
    collected_at=utc_now(),
    raw_payload=<full JSON above>,
    gpu_model_reported="H100 SXM",
    price_hourly=1.50,
    region_reported="Virginia, US",
    commitment_type_reported="on_demand",
    provider_metadata={
        "cpu_cores_effective": 16,
        "cpu_ram_mb": 131072,
        "disk_space_gb": 1000,
        "verification": "verified",
    },
)
```

**3. Persistence (`collectors/persist.py`)** inserts a row into `raw_observations`. Nothing else touches this row ever again.

**4. `run_normalize.py`** picks it up and runs the normalization pipeline:

| Step | Module | Input | Output |
|------|--------|-------|--------|
| GPU canonicalize | `normalization/canonicalize.py` | `"H100 SXM"` | `gpu_sku_canonical="h100_sxm_80gb"`, `gpu_variant="sxm"`, `vram_gb=80` |
| Commitment map | `normalization/commitment.py` | `"on_demand"` | `commitment_type="on_demand"` |
| Region normalize | `normalization/region.py` | `"Virginia, US"` (source="vast") | `country="US"`, `state="Virginia"`, `city=None` |
| Bundle extract | `normalization/bundle.py` | `provider_metadata` | `vcpus_bundled=16`, `ram_gb_bundled=128.0`, `storage_gb_bundled=1000.0`, `verification_tier="verified"` |

**5. Canonical offer row:**

```
id:                              1
raw_observation_id:              <fk>
collected_at:                    2026-04-20T18:20:00Z
gpu_sku_canonical:               h100_sxm_80gb
gpu_variant:                     sxm
vram_gb:                         80
region_country:                  US
region_state:                    Virginia
region_city:                     NULL
provider:                        vast
commitment_type:                 on_demand
vcpus_bundled:                   16
ram_gb_bundled:                  128.0
storage_gb_bundled:              1000.0
networking_type:                 NULL
verification_tier:               verified
price_usd_per_hour:              1.50
normalized_price_usd_per_hour:   NULL   (populated later by analytics)
```

**6. Analytics (Phase 3, planned)** will read all canonical offers for `h100_sxm_80gb` on a given day and compute:
- Dispersion → `daily_aggregates`
- Variance decomposition → `basis_decomposition`

**7. API** reads from those aggregate tables. Frontend charts them.

---

## Cross-provider differences

Not every provider gives every field. What's missing is as important as what's there.

| Field | Vast.ai | RunPod | AWS Spot | TensorDock |
|-------|---------|--------|----------|------------|
| GPU model | explicit | explicit | mapped from instance type | explicit |
| Region | geolocation string | none | AZ (e.g., `us-east-1a`) | city/state/country |
| Multiple commitment tiers | on-demand + bid | on-demand, spot, reserved_*, community, secure | spot only | on-demand only |
| vCPU bundled | yes | derived | fixed per instance type | yes |
| RAM bundled | yes | yes | fixed per instance type | yes |
| Storage bundled | yes | no | no | yes |
| Verification/reliability | `verification` | `secure` vs `community` | n/a | n/a |

**Implication:** The `canonical_offers` row for an AWS Spot H100 has `NULL` for `vcpus_bundled`, `ram_gb_bundled`, `storage_gb_bundled`. That's honest missingness, not a bug. Analytics must handle NULLs.

---

## Why the layers are separated

- **Raw is immutable** so we can always re-derive canonical from scratch. If a normalization rule changes, run `run_normalize.py --reset`.
- **Canonical is the comparison substrate** — all cross-provider analysis happens here.
- **Aggregates are for speed** — the dashboard doesn't recompute medians on every page load.

Cross-layer shortcuts (e.g., collector writing directly to canonical) are forbidden. See [system-overview.md](system-overview.md) for the invariants.
