# Guide: Add a New Collector

## What this file is for

Step-by-step to add a new provider as a data source.

## When to read/use this

- Bringing a new cloud provider online.
- Replacing a dropped source (e.g., if we ever re-enable Lambda Labs).

---

## Prerequisites

- You know the provider's endpoint (API or page) and auth model.
- You've confirmed collection is legal and free (public pricing, no TOS violation).
- You've read [../01-architecture/system-overview.md](../01-architecture/system-overview.md) to understand where collectors sit.

---

## Steps

### 1. Create the collector file

Path: `backend/basis/collectors/<provider_name>.py`

Inherit from `BaseCollector`:

```python
"""<Provider Name> collector.

Data source: <URL>
Auth: <what's needed>
Format: <JSON/GraphQL/HTML/etc.>

See docs/02-reference/data-sources.md for full documentation.
"""

import logging
import httpx
from basis.collectors.base import BaseCollector
from basis.schemas.raw import RawObservationCreate

logger = logging.getLogger(__name__)


class MyProviderCollector(BaseCollector):
    source_name = "my_provider"

    async def collect(self) -> list[RawObservationCreate]:
        now = self.now_utc()
        data = await self._fetch()
        observations: list[RawObservationCreate] = []
        for item in data:
            try:
                obs = self._parse(item, now)
                if obs:
                    observations.append(obs)
            except Exception:
                logger.warning("Failed to parse item %s", item.get("id"), exc_info=True)
        return observations

    async def _fetch(self) -> list[dict]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get("https://...")
            response.raise_for_status()
            return response.json()

    @staticmethod
    def _parse(item: dict, collected_at) -> RawObservationCreate | None:
        ...
        return RawObservationCreate(
            source="my_provider",
            collected_at=collected_at,
            raw_payload=item,
            gpu_model_reported=...,
            price_hourly=...,
            region_reported=...,
            commitment_type_reported="on_demand",
            provider_metadata={...},
        )
```

### 2. Contract requirements

Every collector must:

- Set `source_name` to a unique lowercase identifier (snake_case, e.g., `my_provider`).
- Implement `async def collect() -> list[RawObservationCreate]`.
- Store the **full** API response in `raw_payload` — never discard fields.
- Extract at minimum: `gpu_model_reported`, `price_hourly`, `region_reported`, `commitment_type_reported`.
- Return **price per GPU per hour** in USD. If the provider quotes per-instance or per-month, convert here.
- Log and skip on per-item errors. Don't crash the whole run.
- Handle missing auth gracefully — if a required API key is empty, log a warning and return `[]`.

### 3. Register in the runner

Add to `backend/run_collect.py`:

```python
from basis.collectors.my_provider import MyProviderCollector

AVAILABLE = {
    "vast": VastCollector,
    ...
    "my_provider": MyProviderCollector,
}
```

### 4. Add config (if the provider needs auth)

In `backend/basis/config.py`:

```python
class Settings(BaseSettings):
    ...
    my_provider_api_key: str = ""
```

In `.env.example`:

```
# My Provider: <where to get a key>
MY_PROVIDER_API_KEY=
```

Document it in [../02-reference/config-and-env.md](../02-reference/config-and-env.md).

### 5. Dry-run test

```bash
cd backend
uv run python run_collect.py my_provider --dry-run
```

Expected output: a summary of observations per GPU type, no DB writes. Verify:

- Counts look reasonable (not 0, not 10×expected).
- GPU names show up as expected.
- Prices are sensibly per-GPU-per-hour.

### 6. Add normalization mappings

Run the dry-run output and look at `gpu_model_reported` values. For each one:

- Add to `backend/basis/normalization/canonicalize.py` `GPU_NAME_MAP`.
- If the provider uses a custom commitment label, add to `normalization/commitment.py`.
- If the region string has a new format, extend `normalization/region.py`.
- If there are bundled resources worth extracting, extend `normalization/bundle.py`.

See [add-normalization-rule.md](add-normalization-rule.md).

### 7. Real run

```bash
uv run python run_collect.py my_provider
uv run python run_normalize.py
```

Verify:

```sql
SELECT source, count(*) FROM raw_observations WHERE source = 'my_provider';
SELECT provider, count(*) FROM canonical_offers WHERE provider = 'my_provider';
```

The two counts should match (no unknown-GPU skips).

### 8. Document the source

Add a section to [../02-reference/data-sources.md](../02-reference/data-sources.md) covering:

- Endpoint
- Auth
- Format
- Commitment types captured
- Any quirks

### 9. Add a test

`backend/tests/test_collectors.py` — parse a saved sample API response and assert the collector produces the expected observations.

---

## Checklist

- [ ] Collector file in `backend/basis/collectors/<name>.py`
- [ ] Inherits from `BaseCollector`, sets `source_name`
- [ ] Stores full response in `raw_payload`
- [ ] Handles missing auth gracefully
- [ ] Registered in `run_collect.py`
- [ ] Config field added if auth required
- [ ] `.env.example` updated
- [ ] Dry-run output inspected
- [ ] Normalization mappings added (no unknown-GPU skips)
- [ ] Real run succeeds, canonical offers count matches raw count
- [ ] Data source documented in `docs/02-reference/data-sources.md`
- [ ] Test added in `backend/tests/test_collectors.py`
- [ ] Updated `docs/project-status.md` data volumes table

---

## Related docs

- [../01-architecture/system-overview.md](../01-architecture/system-overview.md) — where collectors fit.
- [../02-reference/data-sources.md](../02-reference/data-sources.md) — provider-specific details.
- [add-normalization-rule.md](add-normalization-rule.md) — mapping tables.
- [../01-architecture/adr/0002-conservative-normalization.md](../01-architecture/adr/0002-conservative-normalization.md) — why normalization is conservative.
