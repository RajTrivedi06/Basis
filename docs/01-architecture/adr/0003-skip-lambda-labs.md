# ADR 0003: Drop Lambda Labs as a data source

## Status

Accepted (2026-04-20)

## Context

The original plan called for 5 data sources: Vast.ai, RunPod, AWS Spot, TensorDock, and Lambda Labs. The Lambda Labs collector was built and ready (`backend/basis/collectors/lambda_labs.py`), pending an API key.

When attempting to create a free API key at `https://cloud.lambda.ai/api-keys`, Lambda Labs required a payment method on file before issuing the key. The project has a hard constraint: **total data cost must remain $0.**

## Decision

Drop Lambda Labs as a primary data source. The collector code is kept in the repo but is not registered in `run_collect.py`'s `AVAILABLE` dict. Anyone who wants to add it later can do so by adding a free-or-paid card — but this is not Raj's path.

## Options Considered

### Option A — Drop Lambda Labs (chosen)

**Pros:**
- Zero risk of accidental charges.
- 4 providers still covers marketplace (Vast.ai), neocloud (RunPod, TensorDock), and hyperscaler (AWS Spot). That's the full spread the thesis needs.
- Removes a noisy "missing API key" warning from every collection run.

**Cons:**
- One fewer neocloud data point. Lambda is reputable and would have added coverage.

### Option B — Keep Lambda Labs and add a payment method

**Pros:**
- 5 providers instead of 4.
- Their API is clean (simple REST, well-documented).

**Cons:**
- Even with no usage, a payment method on file creates non-zero risk (accidental charges, billing alerts, etc.).
- Violates the $0 data cost constraint.

### Option C — Scrape the public pricing page

**Pros:**
- Keeps Lambda Labs in the dataset at zero cost.

**Cons:**
- Fragile (page structure can change).
- Misses availability and regional breakdown that the API provides.
- Additional maintenance burden for marginal analytical value.

## Consequences

**Positive:**
- Unambiguous $0 data cost.
- No API key management for Lambda Labs.
- Run logs are cleaner (no recurring "key not configured" warning).

**Negative:**
- The dataset has 4 providers instead of the originally-planned 5.
- If Lambda Labs later becomes an important point of comparison, we'll have to revisit.

**Neutral:**
- The collector code remains in the tree, ready to re-enable if the constraint changes.

## Links

- Code: `backend/basis/collectors/lambda_labs.py` (unused but kept)
- Runner: `backend/run_collect.py` — `AVAILABLE` dict excludes `lambda_labs`
- Config: `backend/basis/config.py` — `lambda_api_key` field **removed** from Settings (commit `49f4d84`); no Lambda config remains
