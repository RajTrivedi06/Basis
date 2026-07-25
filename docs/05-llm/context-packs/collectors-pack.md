# Context Pack: Collectors

## What this file is for

Dense context for an AI agent working on the collector layer. Copy-paste into a subagent prompt.

## When to use this

- You're about to add, fix, or review a collector.

---

## Layer purpose

Collectors pull provider data and write **raw observations** (immutable JSONB snapshots). One file per provider in `backend/basis/collectors/`. All inherit from `BaseCollector`.

## Active vs parked (2026-07-24)

| Status | Providers |
|--------|-----------|
| **Active** | `vast`, `runpod`, `aws_spot` |
| **Parked** | `tensordock` (public feed empty since 2026-07-13; returns 0) |
| **Dropped** | `lambda_labs` (not in `run_collect.py` `AVAILABLE`) |

`check_collection_volume.py` monitors only active providers (`EXPECTED_PROVIDERS`).

## Contract

Every collector:

- Class name: `<Provider>Collector`, subclass of `BaseCollector`.
- Class attribute `source_name` — unique lowercase snake_case id (e.g., `"vast"`, `"aws_spot"`).
- `async def collect() -> list[RawObservationCreate]`.
- On a per-item error: log a `WARNING`, skip the item, continue.
- On missing auth: log a `WARNING` and `return []`.
- Stores **full** provider response in `raw_payload` (JSONB). Never drop fields.
- Required output fields per observation: `source`, `collected_at` (UTC), `raw_payload`, `gpu_model_reported`, `price_hourly`, `region_reported`, `commitment_type_reported`, `provider_metadata`.
- `price_hourly` is **USD per GPU per hour**. Convert if the provider quotes per-instance or per-month.

## Files

```
backend/basis/collectors/
├── base.py          BaseCollector (don't modify without strong reason)
├── persist.py       save_observations() — inserts into raw_observations
├── vast.py          Vast.ai REST (VAST_API_KEY effectively required)
├── runpod.py        RunPod GraphQL
├── aws_spot.py      AWS EC2 Spot (boto3)
├── tensordock.py    TensorDock REST (PARKED — returns 0)
└── lambda_labs.py   Lambda Labs (DROPPED — not registered)
```

Entry point: `backend/run_collect.py`, with `AVAILABLE` dict mapping CLI name to class.

## Provider quick-reference

| Provider | Endpoint | Auth | Price basis | Regions captured |
|----------|----------|------|-------------|------------------|
| vast | `console.vast.ai/api/v0/bundles/` | **`VAST_API_KEY` required** (64-offer keyless cap since 2026-06-23) | Per-GPU-hour (divide `dph_total` by `num_gpus`) | `geolocation` string like `"Virginia, US"` |
| runpod | GraphQL | Optional `RUNPOD_API_KEY` | Per-GPU-hour | None at offer level |
| aws_spot | boto3 `describe_spot_price_history` | IAM key or EC2 instance role | Per-instance — divide by GPU count in `GPU_INSTANCE_TYPES` | AZ strings like `"us-east-1a"` |
| tensordock | `dashboard.tensordock.com/api/v2/locations` | Parked — feed empty | Per-GPU-hour | City/state/country |

## Output row shape (RawObservationCreate)

```python
RawObservationCreate(
    source="vast",                        # matches source_name
    collected_at=utc_now_datetime,
    raw_payload={...full response dict...},
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

## Common mistakes to avoid

- **Do not modify `raw_observations` after insert.** Invariant.
- **Do not divide or adjust prices inside the raw payload itself** — store what the provider returned. Compute `price_hourly` separately.
- **Do not crash the whole run on one bad item.** Catch per-item exceptions, log, continue.
- **Do not discard provider fields** — unused fields today become analytical features tomorrow.
- **Do not bypass `BaseCollector`.**
- **Do not assume Vast works without `VAST_API_KEY`** — keyless mode returns only 64 cheapest offers.

## Testing pattern

Dry-run first:

```bash
cd backend
uv run python run_collect.py <source> --dry-run
```

Verifies: counts per GPU type, reasonable prices, expected commitment types.

Then real run → normalize → SQL verify:

```sql
SELECT source, count(*) FROM raw_observations WHERE source = '<source>';
SELECT provider, count(*) FROM canonical_offers WHERE provider = '<source>';
```

Counts should match unless the provider introduces a new unmapped GPU name.

Probe Vast auth: `uv run python scripts/probe_vast_api.py`

## Related

- Full guide: `docs/03-guides/add-collector.md`
- Provider docs: `docs/02-reference/data-sources.md`
- Schema: `docs/02-reference/database.md#raw_observations`
- Volume alert: `backend/scripts/check_collection_volume.py`
