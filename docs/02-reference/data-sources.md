# Data Sources

## What this file is for

Every provider we collect from: endpoint, auth, cadence, format, quirks. Source of truth for the collection layer.

## When to read/use this

- Adding a new collector.
- Debugging a collector that's returning weird data.
- Writing the methodology section.

---

## Summary

All data is **free and publicly quoted pricing**. Total data cost: **$0**.

The Obs/run column below is an **approximate, dated snapshot** (early in the project) for rough sizing only — it is not kept current. For live counts, see [../project-status.md](../project-status.md).

| Provider | Type | Auth | Cadence | Obs/run (approx.) |
|----------|------|------|---------|---------|
| Vast.ai | Marketplace (REST) | None / optional API key | Twice daily | ~2,800 |
| RunPod | Neocloud (GraphQL) | Optional API key | Twice daily | ~190 |
| AWS EC2 Spot | Hyperscaler (boto3) | IAM access key + `ec2:DescribeSpotPriceHistory` | Twice daily | ~300 |
| TensorDock | Neocloud marketplace (REST) | None | Twice daily | ~35 |
| Lambda Labs | Neocloud (REST) | Requires payment method — **dropped** | — | — |

---

## Vast.ai

- **Type:** GPU marketplace with public API
- **Endpoint:** `https://console.vast.ai/api/v0/bundles/?q={...}`
- **Auth:** None required; `VAST_API_KEY` grants higher rate limits.
- **Format:** JSON array of offers.
- **Key fields in raw payload:** `gpu_name`, `dph_total`, `geolocation`, `reliability2`, `verification`, `num_gpus`, `cpu_cores_effective`, `cpu_ram` (MB), `disk_space` (GB).
- **Collector:** `backend/basis/collectors/vast.py`
- **Commitment types captured:** `on_demand` and `spot`. The collector issues two queries — an on-demand query and a `"type":"bid"` query — and maps each offer via its `is_bid` field (`is_bid=true` → `spot`, otherwise `on_demand`).
- **Notes:**
  - Richest dataset by far. Thousands of offers with detailed hardware specs and location.
  - `geolocation` format is `"<state-or-city>, <CC>"` — parsed in `normalization/region.py`.
  - `verification` ∈ {`verified`, `unverified`, ...} becomes `verification_tier` on the canonical offer.

---

## RunPod

- **Type:** GPU neocloud with public GraphQL API
- **Endpoint:** `https://api.runpod.io/graphql`
- **Auth:** Public queries work without a key; `RUNPOD_API_KEY` gives more depth.
- **Format:** GraphQL response listing GPU types with multiple pricing tiers per type.
- **Key fields:** `id` (GPU name), `communityPrice`, `securePrice`, `communitySpotPrice`, `secureSpotPrice`, plus reserved durations.
- **Collector:** `backend/basis/collectors/runpod.py`
- **Commitment types captured:** `on_demand`, `spot`, `reserved_1m`, `reserved_3m`, `reserved_6m`, `reserved_1y`, `reserved_3y` (when present).
- **Notes:**
  - One GPU type produces multiple observations (one per pricing tier).
  - No region information at the offer level.
  - `secure` vs `community` is a reliability/datacenter distinction; both map to the same commitment types but may differ in pricing.

---

## AWS EC2 Spot Price History

- **Type:** Hyperscaler spot market
- **Access:** `boto3 ec2.describe_spot_price_history()`
- **Auth:** IAM user access key with `ec2:DescribeSpotPriceHistory` (or `AmazonEC2ReadOnlyAccess` managed policy).
- **Format:** Spot price records with `InstanceType`, `AvailabilityZone`, `SpotPrice`, `Timestamp`.
- **Collector:** `backend/basis/collectors/aws_spot.py`
- **Instance types tracked:** `p5.48xlarge` (8× H100 SXM), `p5e.48xlarge` (8× H200 SXM), `p4d.24xlarge` (8× A100 SXM 40GB), `p4de.24xlarge` (8× A100 SXM 80GB), plus `g5.*` (A10G) and `g6.*` (L4) families.
- **Regions tracked:** `us-east-1`, `us-east-2`, `us-west-2`, `eu-west-1`, `eu-central-1`, `ap-northeast-1`, `ap-southeast-1`.
- **Price handling:** The API returns per-instance price. We divide by the GPU count (stored in `GPU_INSTANCE_TYPES` in the collector) to get **USD per GPU per hour**.
- **Window:** Last 24 hours per run. Most-recent price per `(instance_type, AZ)` is kept to avoid duplicating stable prices.
- **Notes:**
  - `availability_zone` (e.g., `us-east-1a`) is stored in `region_reported`; the trailing letter is stripped during region normalization.
  - Only spot prices. On-demand and reserved AWS pricing is not collected (that's a separate pricing API).

---

## TensorDock

- **Type:** Neocloud marketplace (hosts set their own prices)
- **Endpoint:** `https://dashboard.tensordock.com/api/v2/locations`
- **Auth:** None.
- **Format:** JSON with `locations`, each containing a `gpus` list.
- **Key fields per GPU:** `price_per_hr`, `max_count`, `displayName`, `v0Name`, `resources.{max_vcpus,max_ram_gb,max_storage_gb}`, `pricing.{per_vcpu_hr,per_gb_ram_hr,per_gb_storage_hr}`, `network_features`.
- **Collector:** `backend/basis/collectors/tensordock.py`
- **Commitment types captured:** `on_demand`.
- **Notes:**
  - `gpus` is a **list**, not a dict (was a research miss in the initial build — caught during testing).
  - Same GPU model can appear at multiple locations with different prices — this is expected (it's a marketplace).
  - Prices are per-GPU-hour already; no division needed.
  - `price_per_hr` does **not** include CPU/RAM/storage — those are billed separately via `pricing.per_*_hr`. We still store them in `provider_metadata` for later analysis.

---

## Lambda Labs (dropped)

- **Status:** Dropped. See [../01-architecture/adr/0003-skip-lambda-labs.md](../01-architecture/adr/0003-skip-lambda-labs.md).
- **Reason:** Requires a payment method on file to issue a free API key. Violates the $0 data cost constraint.
- **Collector code:** Still in `backend/basis/collectors/lambda_labs.py` but not registered in `run_collect.py`.

---

## getdeploying.com (cross-reference only)

- **Not collected.** Aggregator. Useful for QA / sanity-checking our numbers, not as a source.

---

## Adding a new source

See [../03-guides/add-collector.md](../03-guides/add-collector.md).
