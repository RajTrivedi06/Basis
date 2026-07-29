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
| Vast.ai | Marketplace (REST) | **Free API key required** (keyless capped at 64 offers since 2026-06-23) | Twice daily | ~2,800 |
| RunPod | Neocloud (GraphQL) | Optional API key | Twice daily | ~190 |
| AWS EC2 Spot | Hyperscaler (boto3) | IAM access key + `ec2:DescribeSpotPriceHistory` | Twice daily | ~300 |
| Azure Retail Prices | Hyperscaler (REST) | None | Twice daily | Varies by region/SKU |
| GCP Cloud Billing | Hyperscaler (REST) | GCP API key (`GCP_API_KEY`) | Twice daily | TBD |
| TensorDock | Neocloud marketplace (REST) | Public feed drained — **parked 2026-07-13** | — | — |
| Lambda Labs | Neocloud (REST) | Requires payment method — **dropped** | — | — |

---

## Vast.ai

- **Type:** GPU marketplace with public API
- **Endpoint:** `https://console.vast.ai/api/v0/bundles/?q={...}`
- **Auth:** **Free API key effectively required** since 2026-06-23. Unauthenticated `/bundles/` responses are capped at 64 cheapest-first offers (`limit` ignored), which excludes the premium tier (H100, etc.). Set `VAST_API_KEY`; the collector sends `Authorization: Bearer <key>`. Without a key, collection falls back to keyless behaviour with a loud warning.
- **Format:** JSON array of offers.
- **Key fields in raw payload:** `gpu_name`, `dph_total`, `geolocation`, `reliability2`, `verification`, `num_gpus`, `cpu_cores_effective`, `cpu_ram` (MB), `disk_space` (GB).
- **Collector:** `backend/basis/collectors/vast.py`
- **Commitment types captured:** `on_demand` and `spot`. The collector issues two queries — an on-demand query and a `"type":"bid"` query — and labels each offer by **which query returned it** (`type=bid` → `spot`). The payload's `is_bid` field is `false` on every offer of both queries and cannot be used; a machine listed by both queries yields two observations with different prices (fixed on-demand vs current interruptible bid). Rows collected before the 2026-07-25 fix are all labeled `on_demand` regardless of product — see [analysis/2026-07-24-vast-bid-bug.md](../analysis/2026-07-24-vast-bid-bug.md).
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
- **Historical backfill:** `backend/run_backfill_aws.py` is a one-shot, paginated 90-day
  backfill. Backfilled rows use the provider record's own UTC `Timestamp` as
  `collected_at`, so daily analytics retain the historical price-observation date.
  Every backfilled row carries `provider_metadata.backfill = true` and
  `provider_metadata.backfill_executed_at` with the actual UTC run time. Before
  insert, one query loads existing AWS Spot raws and deduplicates on
  `(InstanceType, AvailabilityZone, raw_payload.Timestamp)`; existing instance/AZ
  values prefer `provider_metadata` and fall back to `raw_payload`, while the
  timestamp always comes from `raw_payload`.
- **Production backfill execution:** Pending Manager execution in the Raj-approved
  EC2 window coordinated with Task 2.4. Execution date and inserted row count:
  **pending**.
- **Notes:**
  - `availability_zone` (e.g., `us-east-1a`) is stored in `region_reported`; the trailing letter is stripped during region normalization.
  - Only spot prices. On-demand and reserved AWS pricing is not collected (that's a separate pricing API).

---

## Azure Retail Prices

- **Type:** Hyperscaler retail price catalog
- **Endpoint:** `https://prices.azure.com/api/retail/prices`
- **Auth:** None.
- **Format:** Paginated JSON with up to 1,000 full retail-price items per page. The collector follows `NextPageLink` until it is null.
- **Collector:** `backend/basis/collectors/azure.py`
- **VM sizes tracked:** 13 explicitly mapped full-GPU sizes across ND H100 v5, ND A100 v4, NC A100 v4, NCasT4 v3, and NVadsA10 v5. Fractional A10 profiles and undocumented aliases are excluded rather than guessed.
- **Regions:** Azure Resource Manager names such as `eastus`, `westus3`, and `westeurope`; 20 GPU-relevant commercial regions are explicitly mapped in `normalization/region.py`. Unknown regions return empty normalized fields and are logged.
- **Commitment types captured:** `on_demand`, `spot`, `reserved_1y`, and `reserved_3y`.
- **Price handling:**
  - Consumption prices are quoted in USD per VM-hour and divided by the VM's explicit GPU count.
  - Reservation prices are upfront totals. The collector divides by 8,760 hours for one year or 26,280 hours for three years, then divides by GPU count. The source total, term hours, effective instance-hour price, and formula are retained in `provider_metadata.price_conversion`.
- **Filtering and skips:**
  - The OData `$filter` restricts results to `serviceName eq 'Virtual Machines'`, documented GPU-family predicates, Linux products, `Consumption`/supported `Reservation` prices, and non-Low-Priority meters. The collector's exact 13-SKU table remains the authoritative allowlist.
  - `Consumption` items containing `Spot` in `skuName` or `meterName` are labeled `spot`; other supported consumption items are `on_demand`.
  - Legacy `Low Priority`, Dev/Test consumption, unsupported reservation terms, non-USD prices, non-hourly consumption meters, and unmapped VM sizes are skipped and logged.
  - Transient 429/5xx and transport failures use bounded 1/2/4-second backoff.
- **Raw-data fidelity:** Each observation stores the complete retail-price item unchanged in `raw_payload`.
## GCP Cloud Billing Catalog

- **Type:** Hyperscaler public pricing catalog
- **Endpoint:** `https://cloudbilling.googleapis.com/v1/services/6F81-5844-456A/skus?key=<GCP_API_KEY>`
- **Auth:** GCP API key with Cloud Billing API enabled. Set `GCP_API_KEY`. Without a key, the collector logs a warning and returns an empty list (still registered).
- **Format:** Paginated JSON SKU list (`nextPageToken`). Service ID `6F81-5844-456A` is Compute Engine (verified via the services list endpoint).
- **Collector:** `backend/basis/collectors/gcp.py`
- **SKUs collected:** `category.resourceGroup == "GPU"` attach/on-demand GPU line items for mapped models (H100 80GB, A100 80GB, A100 40GB, L4, T4, V100, P100).
- **Commitment types captured:** `on_demand`, `spot` (Spot/Preemptible), `reserved_1y`, `reserved_3y` (Commitment v1 CUD when term is explicit). Ambiguous descriptions are skipped per ADR-0002.
- **Price handling:** Prices are **already per-GPU-hour** from `pricingInfo[0].pricingExpression.tieredRates[-1].unitPrice` (`units` + `nanos/1e9` USD). No division by GPU count. `usageUnit` must be `h`.
- **Region handling:** Concrete region IDs (e.g. `us-central1`, `europe-west4`) map via `GCP_REGION_MAP` in `normalization/region.py`. Multi-region strings (`Americas`, `global`, etc.) are stored as-is in `region_reported` and normalize to empty country (honest `None`). The collector logs multi-region SKU share each run.
- **Bundle fields:** All `None`. GCP's per-GPU price is the GPU **attach** price; the host VM is billed separately (analogous to TensorDock's `price_per_hr` caveat).
- **Notes:**
  - Full SKU JSON is stored in `raw_payload`.
  - Unknown GPU descriptions and ambiguous commitment shapes are skip-and-log.

---

## TensorDock

> **Status: parked (2026-07-13).** The public `/api/v2/locations` feed now returns
> `{"data":{"locations":[]}}` — an empty inventory — and live data appears to have
> moved behind an API key at `/api/v2/hostnodes` (returns `401 Unauthorized`
> unauthenticated). Same "gate the marketplace behind a key" move as Vast, but here
> the endpoint *and* response shape change, so restoring it is a collector rewrite,
> not a header. TensorDock was ~0.8% of canonical offers (2,484, frozen since ~mid-June)
> and rarely cleared the per-(date, SKU) minimum-observation threshold, so it had
> negligible weight in the residual decomposition — dropping it does not move any
> finding. The collector file and its tests are kept, but as of 2026-07-24 the
> collector is **deregistered** from `AVAILABLE` in `run_collect.py` — it no longer
> runs at all. It is also excluded from the per-provider volume alert
> (`check_collection_volume.py`) so it does not false-alarm.
> To restore: register a (free, if available) key, confirm inventory + shape at
> `/api/v2/hostnodes`, rewrite the collector to authenticate, then re-add
> `tensordock` to `AVAILABLE` in `run_collect.py` and to `EXPECTED_PROVIDERS`.

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
