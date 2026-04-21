# Context Pack: Normalization

## What this file is for

Dense context for an AI agent working on the normalization layer. Copy-paste into a subagent prompt.

## When to use this

- Adding or fixing a mapping.
- Debugging a `skipped_unknown_gpu`.
- Reviewing the normalization pipeline.

---

## Layer purpose

Transform raw observations into **canonical offers** with standardized GPU SKU, commitment type, region, and bundled-resource fields. Rule-based and conservative (ADR 0002).

## Files

```
backend/basis/normalization/
├── canonicalize.py     GPU_NAME_MAP: dict[str, str]
├── commitment.py       COMMITMENT_TYPE_MAP: dict[str, str]
├── region.py           Per-source region parsers → NormalizedRegion(country,state,city)
├── bundle.py           Per-source bundle extraction → BundleInfo(vcpus,ram_gb,storage_gb,...)
└── pipeline.py         Orchestrator: raw_observation → canonical_offer
```

Entry point: `backend/run_normalize.py` (supports `--reset` to wipe and re-normalize).

## Canonical SKU format

`{model}_{form_factor}_{vram_gb}gb`

Examples: `h100_sxm_80gb`, `a100_pcie_80gb`, `rtx_4090_24gb`, `h200_sxm_141gb`.

Different form factors → different canonical SKUs. Different VRAM → different canonical SKUs. Do not collapse.

## Canonical commitment types

- `on_demand`
- `spot`
- `reserved_1w`, `reserved_1m`, `reserved_3m`, `reserved_6m`, `reserved_1y`, `reserved_3y`

## Region handling

`NormalizedRegion(country: str | None, state: str | None, city: str | None)`

Parsing is per-source via a `switch` in `normalize_region(source, region_reported)`:

- `aws_spot` → strip AZ suffix (`us-east-1a` → `us-east-1` → `US, Virginia`). `AWS_REGION_MAP` is the table.
- `vast` → split on `,`. Format is `"<state or city>, <country_code>"`.
- `tensordock` → split on `,`. Format is `"City, State, Country"` or shorter.
- `runpod` → none at offer level; returns empty `NormalizedRegion`.

Country codes map via `_COUNTRY_CODES` (ISO-2 → ISO-2, mostly identity with some aliases like `UK → GB`).

## Bundle extraction

`BundleInfo(vcpus, ram_gb, storage_gb, networking_type, verification_tier)`

- `vast` → `provider_metadata.cpu_cores_effective`, `cpu_ram_mb / 1024`, `disk_space_gb`, `verification`.
- `tensordock` → `provider_metadata.max_vcpus`, `max_ram_gb`, `max_storage_gb`.
- `aws_spot` → all `None` (we don't carry instance-level specs through).
- `runpod` → all `None` (not meaningful per offer).

## Pipeline flow

For each raw observation:

1. `canonicalize_gpu(gpu_model_reported)` → canonical SKU or `None`.
2. If `None`: skip, increment `skipped_unknown_gpu`, log the unmapped name.
3. `canonicalize_commitment(commitment_type_reported)` → canonical commitment (defaults to `on_demand`).
4. `normalize_region(source, region_reported)` → `NormalizedRegion`.
5. `extract_bundle(source, provider_metadata)` → `BundleInfo`.
6. Derive `gpu_variant` (`sxm`/`pcie`/`nvl`) and `vram_gb` from the canonical SKU.
7. Insert `canonical_offer` with FK back to `raw_observation_id`.

## Conservative principle

From ADR 0002:

- Only normalize factors that are clearly observable and documented.
- When in doubt, skip — don't guess.
- No continuous adjusters, no ML-based residual prediction.
- Preserving the residual is the project's thesis.

## Common tasks

### Add a new GPU mapping

Edit `canonicalize.py`:

```python
"NVIDIA HGX B200 SXM 192GB":   "b200_sxm_192gb",
```

Then run `uv run python run_normalize.py`. If the name appeared in historical raw rows, use `--reset`.

### Add a new commitment label

Edit `commitment.py`:

```python
COMMITMENT_TYPE_MAP = {
    ...
    "hourly_committed_7_days": "reserved_1w",
}
```

### Add a new region format

Edit `region.py`. Add a per-source branch and a parser function.

## Testing

`backend/tests/test_normalization.py`. Tests should cover:
- Exact strings observed in real data.
- Edge cases (empty, whitespace).
- Unknowns (return `None` / empty, don't raise).

## Output invariants

- Every canonical offer has a matching `raw_observation_id`.
- `gpu_sku_canonical` is always one of the values in `GPU_NAME_MAP`.
- `commitment_type` is always one of the canonical types above.
- `price_usd_per_hour` is copied verbatim from the raw observation (no adjustment here).
- `normalized_price_usd_per_hour` is `NULL` until Phase 3.

## Related

- Full guide: `docs/03-guides/add-normalization-rule.md`
- Philosophy: `docs/01-architecture/adr/0002-conservative-normalization.md`
- Schema: `docs/02-reference/database.md#canonical_offers`
