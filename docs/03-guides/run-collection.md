# Guide: Run Collection

## What this file is for

How to run the collection pipeline manually, do dry-runs, reset, and catch up on missed days.

## When to read/use this

- First manual run after setup.
- A scheduled run failed and you want to catch up.
- Testing a new collector.
- Verifying a fix.

---

## Command cheatsheet

From `backend/`:

```bash
# All enabled collectors, save to DB
uv run python run_collect.py

# Dry-run (prints summary, no DB writes)
uv run python run_collect.py --dry-run

# Specific collector
uv run python run_collect.py vast
uv run python run_collect.py runpod
uv run python run_collect.py aws_spot
uv run python run_collect.py tensordock

# Specific collector, dry-run
uv run python run_collect.py vast --dry-run
```

---

## What a dry-run does

- Calls the provider's API.
- Parses the response.
- Builds `RawObservationCreate` objects in memory.
- Prints a summary (counts per GPU type).
- **Does not write to the database.**

Use dry-run when:

- Testing a new collector for the first time.
- Inspecting unfamiliar provider output.
- Verifying a collector fix before committing to DB writes.

---

## Catching up after a missed scheduled run

Production collection runs on an EC2 systemd timer (`basis-collect.timer`, `Persistent=true`), so firings missed while the instance was off are rerun on next boot. A run that *executed but errored* leaves a gap — to catch up, run the full chain manually (on EC2 or locally):

```bash
cd backend
uv run python run_collect.py        # full run, all sources
uv run python run_normalize.py      # normalize the new rows
uv run python run_analytics.py      # rebuild aggregates + decomposition
```

That puts one observation per source into the DB at the current timestamp. It doesn't reconstruct missed timestamps — those gaps are permanent.

### How to detect gaps

```sql
SELECT DATE(collected_at) AS day, source, count(*) 
FROM raw_observations 
GROUP BY 1, 2 
ORDER BY 1 DESC, 2;
```

Look for days with zero rows for a source you expect to be live.

---

## Full pipeline (collect → normalize → analytics)

```bash
cd backend
uv run python run_collect.py && uv run python run_normalize.py && uv run python run_analytics.py
```

`backend/collect_cron.sh` already runs the full chain — collect, then normalize, then `run_analytics.py` — so a scheduled run produces canonical offers and analytics, not just raw observations.

---

## Re-normalizing everything

If the mapping tables in `normalization/` change, run:

```bash
cd backend
uv run python run_normalize.py --reset
```

This wipes `canonical_offers` and regenerates from `raw_observations`. Raw data is untouched. Takes roughly 5–10 seconds per 1,000 rows on a local Postgres.

---

## Verifying success

```bash
# Counts per source
docker exec basis-db-1 psql -U basis -d basis -c "
SELECT source, count(*), max(collected_at) 
FROM raw_observations 
GROUP BY source ORDER BY source;"

# Any unknown GPUs that got skipped during normalization?
# (Search the output of run_normalize.py; 'skipped_unknown_gpu' should be 0.)
```

---

## Common issues

| Issue | Fix |
|-------|-----|
| `AWS credentials not configured` | `.env` not picked up — ensure you run from `backend/` with `uv run`. |
| AWS `UnauthorizedOperation` | Attach `AmazonEC2ReadOnlyAccess` IAM policy to the user. |
| TensorDock zero locations | Public feed drained (parked 2026-07-13). Expected — no action. |
| Very low Vast.ai count (~64) | Missing `VAST_API_KEY` — Vast caps keyless requests at 64 cheapest offers since 2026-06-23. |
| `skipped_unknown_gpu > 0` | New GPU name from a provider — add to `canonicalize.py` and re-run. |

See [troubleshooting.md](troubleshooting.md) for more.

---

## Related docs

- [../00-start-here/dev-commands.md](../00-start-here/dev-commands.md) — all commands.
- [../02-reference/observability.md](../02-reference/observability.md) — health checks.
- [add-collector.md](add-collector.md) — adding a new source.
