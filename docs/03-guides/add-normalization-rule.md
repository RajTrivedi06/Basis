# Guide: Add a Normalization Rule

## What this file is for

How to extend the mapping tables that turn raw observations into canonical offers.

## When to read/use this

- A new GPU model appears and shows up as `skipped_unknown_gpu` in `run_normalize.py`.
- A provider starts reporting a new commitment type.
- A region string doesn't parse cleanly.

---

## Which module?

| You're adding | Edit |
|---------------|------|
| GPU name → canonical SKU | `backend/basis/normalization/canonicalize.py` |
| Region string → (country, state, city) | `backend/basis/normalization/region.py` |
| Commitment label → canonical commitment | `backend/basis/normalization/commitment.py` |
| Bundled resource extraction | `backend/basis/normalization/bundle.py` |

---

## Principle: conservative

Only normalize when you're confident the inputs genuinely represent the same thing. When in doubt, **don't normalize**. A larger residual is a feature, not a bug — see [../01-architecture/adr/0002-conservative-normalization.md](../01-architecture/adr/0002-conservative-normalization.md).

- Different form factors (SXM vs PCIe) → different canonical SKUs, even if both say "H100".
- Different VRAM → different canonical SKUs (`a100_sxm_40gb` ≠ `a100_sxm_80gb`).
- Ambiguous names ("H100" with no form factor) → do not guess. Leave out of the map; it'll be skipped and flagged.

---

## Example: adding a new GPU

A new provider reports `"NVIDIA HGX B200 SXM 192GB"`.

1. Check that the canonical SKU doesn't already exist:

```python
# In canonicalize.py
"B200":                         "b200_sxm_192gb",  # already there
```

2. Add the new display string as a new key mapping to the existing canonical:

```python
"NVIDIA HGX B200 SXM 192GB":   "b200_sxm_192gb",
```

3. Re-run normalization for the affected rows:

```bash
# If only new data has the new string, run normally:
uv run python run_normalize.py

# If historical raw rows also had this name and were skipped,
# you'll need to wipe and re-normalize (still safe — raw is untouched):
uv run python run_normalize.py --reset
```

4. Verify `skipped_unknown_gpu` is 0 at the end of the run.

---

## Example: adding a new commitment type

Provider reports `"hourly_committed_7_days"`.

Decide what it maps to. If it's a 7-day commitment, add `reserved_1w` as a canonical type (already supported) and map:

```python
# commitment.py
COMMITMENT_TYPE_MAP: dict[str, str] = {
    ...
    "hourly_committed_7_days": "reserved_1w",
}
```

---

## Example: adding a new region format

Provider reports `"Tokyo (JP-east)"`.

If the collector sets `source == "my_provider"`, extend `region.py`:

```python
def normalize_region(source: str, region_reported: str | None) -> NormalizedRegion:
    ...
    elif source == "my_provider":
        return _normalize_my_provider_region(region_reported)

def _normalize_my_provider_region(region: str) -> NormalizedRegion:
    # Parse "Tokyo (JP-east)" -> NormalizedRegion(country="JP", state="Tokyo")
    ...
```

Keep the per-provider function local to `region.py` — don't spread parsing across the codebase.

---

## Testing

Every new rule should have a test in `backend/tests/test_normalization.py`:

```python
def test_canonicalize_b200():
    assert canonicalize_gpu("NVIDIA HGX B200 SXM 192GB") == "b200_sxm_192gb"

def test_normalize_my_provider_region():
    result = normalize_region("my_provider", "Tokyo (JP-east)")
    assert result.country == "JP"
    assert result.state == "Tokyo"
```

Tests should cover:
- The exact input string that appeared in real data.
- Edge cases (empty, whitespace, missing fields).
- Unknown inputs (should return `None` / empty, not raise).

---

## When NOT to add a rule

- **The factor is continuous.** Don't build a rule that "adjusts H100 prices down 5% for high-reliability instances." Leave reliability in the residual. That's what ML-style adjusters would do, and ADR 0002 says we don't.
- **The mapping is a guess.** If you're not certain `"H100 Gen3"` means the same thing as `"H100 SXM"`, don't map it. Leave it skipped until you confirm.
- **The fix belongs upstream.** If the collector is producing garbage strings, fix the collector, not the normalization layer.

---

## Checklist

- [ ] Identified the right module
- [ ] Mapping preserves meaningful distinctions (form factor, VRAM, etc.)
- [ ] Re-ran `run_normalize.py` (or `--reset` if historical rows affected)
- [ ] `skipped_unknown_gpu` is 0 or only contains genuinely new / unmapped inputs
- [ ] Unit test added
- [ ] If a new canonical SKU was introduced, mentioned in [../02-reference/database.md](../02-reference/database.md) if relevant

---

## Related docs

- [../01-architecture/adr/0002-conservative-normalization.md](../01-architecture/adr/0002-conservative-normalization.md) — philosophy.
- [add-collector.md](add-collector.md) — collector side of the contract.
- [../05-llm/context-packs/normalization-pack.md](../05-llm/context-packs/normalization-pack.md) — dense context for AI agents.
