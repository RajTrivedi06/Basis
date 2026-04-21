# Observability

## What this file is for

Where to look when something breaks or you want to know what the system has been doing.

## When to read/use this

- A cron run failed overnight.
- Collector count dropped unexpectedly.
- You want to verify data is still flowing.

---

## Logs

### Collection log

- **Path:** `backend/logs/collect.log`
- **Written by:** `backend/collect_cron.sh`
- **Rotation:** none (yet). Clean up manually if it grows large.

Quick tail:

```bash
tail -100 backend/logs/collect.log
```

Structure: each run is bracketed by a start line and a final "completed" / error line. Collectors log their own progress inline.

### Application log (uvicorn / manual runs)

Python's stdlib `logging` goes to stdout. No file handler configured. When you run `uv run python run_collect.py`, log lines go straight to your terminal.

Log levels in use:
- `INFO` — progress, counts
- `WARNING` — missing keys, skipped regions, unexpected response shapes
- `ERROR` — unhandled failures (rare; collectors are designed to soldier on)

---

## Health checks

### Is the DB up?

```bash
docker exec basis-db-1 psql -U basis -d basis -c "SELECT 1;"
```

### Is collection still running?

```bash
# Count observations collected in the last 24h
docker exec basis-db-1 psql -U basis -d basis -c "
SELECT source, count(*) 
FROM raw_observations 
WHERE collected_at > now() - interval '24 hours' 
GROUP BY source ORDER BY source;"
```

Expected rough volumes per 12-hour run: Vast ≈ 2,800, AWS Spot ≈ 300, RunPod ≈ 190, TensorDock ≈ 35.

### Is normalization keeping up?

```bash
# Raw observations that don't yet have a canonical offer
docker exec basis-db-1 psql -U basis -d basis -c "
SELECT count(*) AS pending
FROM raw_observations ro
LEFT JOIN canonical_offers co ON co.raw_observation_id = ro.id
WHERE co.id IS NULL;"
```

Ideally 0 (or whatever's been collected since the last normalization run). If this number grows unbounded, `run_normalize.py` needs to be added to cron.

---

## Cron

```bash
crontab -l                    # see current jobs
```

Current schedule:

```
0 8,20 * * * /Users/raaj/Documents/CS/Basis/backend/collect_cron.sh
```

**Dependencies:**
- Laptop awake at the scheduled times.
- Docker Desktop running (or whichever Docker engine you use).
- `.env` has required credentials (AWS especially).

macOS cron will silently skip firings when the laptop is asleep. There is no retry. If you see gaps in the observation time series, that's almost always the cause.

---

## Common failure modes

| Symptom | Probable cause | Fix |
|---------|---------------|-----|
| `AWS credentials not configured — skipping` | `.env` not loading | Run from backend/ via `uv run` (config resolves `.env` from repo root). |
| `UnauthorizedOperation` on AWS | IAM user missing permission | Attach `AmazonEC2ReadOnlyAccess` managed policy. |
| `Failed to parse TensorDock location` | Upstream API shape change | Inspect `provider_metadata` in recent raw rows; update `collectors/tensordock.py`. |
| `skipped_unknown_gpu > 0` | New GPU name from a provider | Add mapping to `normalization/canonicalize.py`; re-run `run_normalize.py`. |
| Empty log file despite cron being set | Laptop was asleep at schedule time | Run manually: `backend/collect_cron.sh`. |
| Gaps in time series after weekend | Same — sleep + cron | Check `backend/logs/collect.log` for missing timestamps. |

---

## What's NOT instrumented

By choice:

- No APM, no OpenTelemetry, no Sentry.
- No Prometheus / Grafana.
- No alerting.

This is a research tool, not a production service. Adding observability frameworks is explicitly out of scope per `AGENTS.md`. If we deploy publicly in the future, consider:
- Request logs at the ingress
- Daily digest email of `collect.log`
- Simple status endpoint that returns last-collection timestamps per source
