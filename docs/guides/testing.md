---
title: Testing
tags: [area:guides, audience:developers, status:stub]
owner: Raj
last_updated: 2026-04-20
---

# Testing

## Status: minimal

Tests live in `backend/tests/` but coverage is thin. This is a known gap — see [../TASKS/README.md](../TASKS/README.md) "Cross-cutting / nice-to-haves".

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
    observations = VastCollector._parse_response(sample, utc_now())
    assert len(observations) > 0
    assert observations[0].source == "vast"
    assert observations[0].price_hourly > 0
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

### 4. Analytics (Phase 3, once implemented)

- Percentile calculation against a hand-computed example.
- Variance decomposition sums ≤ total variance.
- Residual is non-negative.

### 5. API endpoints (Phase 4, once wired)

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
