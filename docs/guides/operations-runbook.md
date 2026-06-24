---
title: Operations Runbook
tags: [area:guides, audience:ops, status:active]
owner: Raj
last_updated: 2026-06-23
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

In production, collection runs automatically via the EC2 systemd timer (see [Cron](#cron) below). To run the full chain by hand — locally, or on EC2 to backfill after a missed/failed timer:

```bash
cd backend
uv run python run_collect.py && uv run python run_normalize.py && uv run python run_analytics.py
```

### Re-normalize after mapping-table change

```bash
cd backend
uv run python run_normalize.py --reset
```

### Regenerate analytics

```bash
cd backend
uv run python run_analytics.py --reset
```

### Rotate log

```bash
mv backend/logs/collect.log backend/logs/collect.log.$(date +%Y%m%d)
touch backend/logs/collect.log
```

---

## Cron (EC2 systemd timer)

Production collection runs on the EC2 instance via a systemd timer, **not** laptop cron:

```bash
# On EC2 (ssh basis-prod):
systemctl status basis-collect.timer       # is it active / when next?
systemctl list-timers basis-collect.timer  # last / next firing
journalctl -u basis-collect.service -n 100 # recent run output
```

`basis-collect.timer` fires at **08:00 and 20:00 UTC** with `Persistent=true`, so a firing missed while the instance was down (e.g. a reboot) is run on next boot — no silent gaps the way macOS cron had. The service runs `backend/collect_cron.sh` (collect → normalize → analytics) and pings healthchecks.io via `HC_PING_URL` on success.

**Dependencies for the timer to succeed:**

1. Docker (Postgres) running on the instance.
2. `.env` valid. On EC2, AWS credentials come from the instance IAM role, so the AWS key vars are left blank.
3. `uv` on PATH for the service user.

Local dev can still trigger a manual run instead — see [Manual collection catch-up](#manual-collection-catch-up).

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

### Collection hasn't run recently

On EC2, check the timer and the service journal first:

```bash
systemctl list-timers basis-collect.timer       # last / next firing
journalctl -u basis-collect.service -n 100       # recent run output, including errors
```

If the timer is inactive, `systemctl enable --now basis-collect.timer`. If a run failed (bad `.env`, Docker down, upstream API), fix the cause and trigger a manual run to catch up (`run_collect.py && run_normalize.py && run_analytics.py`). `Persistent=true` covers firings missed while the instance was off, but not ones that ran and errored.

---

## Deployment

Production is live: FastAPI on AWS EC2 (behind Caddy, app under `nohup uvicorn`) plus the Vercel frontend, with collection driven by the EC2 systemd timer above. See [deployment.md](deployment.md) for the topology and [dev-setup.md](dev-setup.md#run-against-production-data-polish-loop) for the operate-against-prod workflow.

---

## Related

- [Troubleshooting guide](../03-guides/troubleshooting.md)
- [Observability reference](../02-reference/observability.md)
- [Dev commands](../00-start-here/dev-commands.md)
