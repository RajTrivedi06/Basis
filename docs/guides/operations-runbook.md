---
title: Operations Runbook
tags: [area:guides, audience:ops, status:active]
owner: Raj
last_updated: 2026-04-20
---

# Operations Runbook

Daily and as-needed operational tasks. Covers health checks, routine jobs, and incident response.

---

## Health Checks

```bash
# DB is up?
docker exec basis-db-1 psql -U basis -d basis -c "SELECT 1;"

# Has collection run recently?
docker exec basis-db-1 psql -U basis -d basis -c "
SELECT source, count(*), max(collected_at)
FROM raw_observations
WHERE collected_at > now() - interval '24 hours'
GROUP BY source ORDER BY source;"

# Are raw observations getting normalized?
docker exec basis-db-1 psql -U basis -d basis -c "
SELECT count(*) AS pending_normalization
FROM raw_observations ro
LEFT JOIN canonical_offers co ON co.raw_observation_id = ro.id
WHERE co.id IS NULL;"

# API up?
curl -sf http://localhost:8000/docs > /dev/null && echo OK || echo DOWN

# Frontend up?
curl -sf http://localhost:3000 > /dev/null && echo OK || echo DOWN
```

Expected volumes per 12-hour run: Vast ≈ 2,800, AWS Spot ≈ 300, RunPod ≈ 190, TensorDock ≈ 35.

---

## Routine Tasks

### Manual collection catch-up

If cron missed a run (laptop asleep):

```bash
cd backend
uv run python run_collect.py && uv run python run_normalize.py
```

### Re-normalize after mapping-table change

```bash
cd backend
uv run python run_normalize.py --reset
```

### Regenerate analytics (Phase 3, when implemented)

```bash
cd backend
uv run python run_analytics.py --reset   # planned
```

### Rotate log

```bash
mv backend/logs/collect.log backend/logs/collect.log.$(date +%Y%m%d)
touch backend/logs/collect.log
```

---

## Cron

```bash
crontab -l       # list
crontab -e       # edit
```

Current schedule:

```
0 8,20 * * * /Users/raaj/Documents/CS/Basis/backend/collect_cron.sh
```

**Hard dependencies for cron to actually run:**

1. Laptop is awake at 08:00 / 20:00.
2. Docker Desktop is running.
3. `.env` file is valid (especially AWS credentials).
4. `uv` is on PATH for the user that owns the crontab.

macOS silently skips cron firings while the laptop is asleep. There is no automatic backfill — missed runs leave permanent gaps in the time series.

---

## Incident Response

### Collection returns zero for one source

1. Run the source in dry-run: `uv run python run_collect.py <source> --dry-run`.
2. If the request fails at HTTP level → network issue or upstream API change. Check provider status page.
3. If the request succeeds but returns 0 offers → inspect the response shape. The provider may have changed their API (happened once with TensorDock: `gpus` field went dict → list).
4. If auth is the issue → verify the relevant env var in `.env`. For AWS, verify IAM permissions.

### `skipped_unknown_gpu > 0` in `run_normalize.py`

New GPU name from a provider. Find it and add to the map:

```sql
SELECT DISTINCT ro.source, ro.gpu_model_reported
FROM raw_observations ro
LEFT JOIN canonical_offers co ON co.raw_observation_id = ro.id
WHERE co.id IS NULL;
```

Then add to `backend/basis/normalization/canonicalize.py` and run `uv run python run_normalize.py --reset`.

### DB down

```bash
docker compose up -d
# Wait a few seconds
docker exec basis-db-1 psql -U basis -d basis -c "SELECT 1;"
```

If the container won't start, check `docker ps -a` for its error code and `docker logs basis-db-1`.

### Disk filling up

The two big consumers:
- Postgres data volume (grows with raw observations)
- `backend/logs/collect.log`

Quick check:
```bash
docker system df
du -sh backend/logs/
```

Mitigation: rotate the log; consider pruning raw observations older than N months (not yet needed).

### Cron hasn't run in days

Likely the laptop was asleep. Confirm:

```bash
stat -f "%Sm" backend/logs/collect.log       # last modified
grep "Starting collection" backend/logs/collect.log | tail -5   # last start lines
```

Run manually to catch up. Consider installing `caffeinate` or a wake schedule if chronic.

---

## Deployment

Not deployed. Local-only until Phase 7. See [../roadmap.md#phase-7--deploy-deferred](../roadmap.md).

---

## Related

- [Troubleshooting guide](../03-guides/troubleshooting.md)
- [Observability reference](../02-reference/observability.md)
- [Dev commands](../00-start-here/dev-commands.md)
