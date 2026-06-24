---
title: Testing
tags: [area:guides, audience:developers, status:active]
owner: Raj
last_updated: 2026-06-23
---

# Testing

## Status

`backend/tests/` covers all four layers: `test_collectors.py`, `test_normalization.py`, `test_analytics.py`, and `test_api.py` (~24 test functions total). The sections below describe the intent behind each layer and where to add new cases — see also [../TASKS/README.md](../TASKS/README.md) for remaining nice-to-haves.

---

## Running what exists

```bash
cd backend
uv run pytest                              # all tests
uv run pytest tests/test_normalization.py  # specific file
uv run pytest -v --tb=short                # verbose with short tracebacks
uv run pytest --cov=basis                  # with coverage report
```

---

## What should be covered (priority order)

### 1. Collectors — parse-fixture tests

For each collector, save a real API response as a fixture under `backend/tests/fixtures/<source>.json` and assert the parser produces the expected `RawObservationCreate` list.

```python
def test_vast_parses_sample_response():
    with open("tests/fixtures/vast_response.json") as f:
        sample = json.load(f)
    obs = VastCollector._parse_offer(sample[0], utc_now())
    assert obs is not None
    assert obs.source == "vast"
    assert obs.price_hourly > 0
```

This catches API shape changes the moment they happen instead of finding out at cron time.

### 2. Normalization — mapping coverage

One test per mapping table; parameterized over every entry.

```python
@pytest.mark.parametrize("raw,canonical", GPU_NAME_MAP.items())
def test_canonicalize_gpu(raw, canonical):
    assert canonicalize_gpu(raw) == canonical
```

Plus: unknown inputs return `None`, not raise.

### 3. Region / commitment / bundle parsers

Edge cases: empty strings, missing fields, unicode, international characters.

### 4. Analytics (`test_analytics.py`)

- Percentile calculation against a hand-computed example.
- Variance decomposition sums ≤ total variance.
- Residual is non-negative.

### 5. API endpoints (`test_api.py`)

- Filter parameters behave as documented.
- Responses match Pydantic response schemas.
- 404s for unknown `gpu_sku`.

---

## What NOT to test

- Third-party libraries (`httpx`, `boto3`, `sqlalchemy`).
- Exact `print` / logging output.
- Implementation details of lookup tables (test inputs/outputs, not internals).

---

## DB in tests

Current tests don't hit the DB. If that changes, use a transactional fixture:

```python
@pytest.fixture
async def session():
    async with async_session_factory() as s:
        yield s
        await s.rollback()
```

Do not share a session across tests.

---

## Related

- [Add-collector guide](../03-guides/add-collector.md) — every new collector should add at least one parse test.
- [Add-normalization-rule guide](../03-guides/add-normalization-rule.md) — every new mapping should add a test.
