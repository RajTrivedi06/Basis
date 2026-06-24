# Guide: Troubleshooting

## What this file is for

Symptoms you'll see and how to fix them. Living document — add new entries as you encounter them.

## When to read/use this

- Something broke. Check here first before digging into code.

---

## Collection

### `AWS credentials not configured — skipping AWS Spot collection`

**Cause:** `pydantic-settings` isn't finding `.env`.

**Fix:**
- Confirm `.env` exists at the repo root: `ls /Users/raaj/Documents/CS/Basis/.env`
- Confirm it has `AWS_ACCESS_KEY_ID=AKIA...` and `AWS_SECRET_ACCESS_KEY=...`
- Run from `backend/` via `uv run python run_collect.py aws_spot`.

The path resolution in `basis/config.py` walks up three directories from `config.py` to find `.env` — if you relocated the file, update `_REPO_ROOT`.

### `UnauthorizedOperation` on AWS

**Cause:** IAM user lacks `ec2:DescribeSpotPriceHistory`.

**Fix:** In AWS Console → IAM → Users → your user → Add permissions → attach `AmazonEC2ReadOnlyAccess` managed policy.

### TensorDock requests time out

**Cause:** Their API is occasionally slow.

**Fix:** Retry. If persistent, inspect directly:

```bash
curl -s https://dashboard.tensordock.com/api/v2/locations | jq '.data.locations | length'
```

If curl also fails, it's upstream — try again later.

### Vast.ai returns very few offers

**Cause:** Rate limiting without an API key.

**Fix:** Get a free key from Vast.ai and add `VAST_API_KEY=...` to `.env`.

### `Failed to parse TensorDock location <id>`

**Cause:** Upstream API shape changed (happened once when `gpus` was a list instead of a dict).

**Fix:**
- Inspect a fresh response: `curl -s https://dashboard.tensordock.com/api/v2/locations | jq '.data.locations[0]' | head -50`
- Update `collectors/tensordock.py` `_parse_location` to match.

---

## Normalization

### `skipped_unknown_gpu > 0`

**Cause:** A new GPU name appeared that isn't in `GPU_NAME_MAP`.

**Fix:**
1. Find the unknown name:
   ```sql
   SELECT DISTINCT gpu_model_reported 
   FROM raw_observations ro
   LEFT JOIN canonical_offers co ON co.raw_observation_id = ro.id
   WHERE co.id IS NULL;
   ```
2. Add a mapping to `backend/basis/normalization/canonicalize.py`.
3. Re-run `uv run python run_normalize.py`.

### Canonical offer count doesn't match raw count

**Cause:** Either unknown GPU names (see above) or parse errors during normalization.

**Fix:** Check `run_normalize.py` output for skip counts. If neither accounts for the gap, add logging at row-parse level and re-run.

---

## Database

### `docker: command not found` or connection refused

**Cause:** Docker Desktop isn't running.

**Fix:** Start Docker Desktop, then `docker compose up -d`.

### `relation "raw_observations" does not exist`

**Cause:** Migrations haven't run.

**Fix:**
```bash
cd backend
uv run alembic upgrade head
```

### Port 5433 already in use

**Cause:** Something else is bound to `127.0.0.1:5433` (Compose publishes `127.0.0.1:5433:5432`).

**Fix:** Either stop whatever holds the port or change the published port in `docker-compose.yml` (and update `DATABASE_URL` in `.env`).

---

## Scheduled collection

In production, collection runs on EC2 via the `basis-collect.timer` systemd timer (08:00 / 20:00 UTC), which invokes `collect_cron.sh` (collect → normalize → analytics). The cases below assume that environment; the manual-run guidance also applies to local dev.

### A scheduled run didn't happen

**Cause:** Timer inactive, or the run errored (Docker down, bad `.env`, upstream API).

**Fix:**
```bash
# On EC2 (ssh basis-prod):
systemctl list-timers basis-collect.timer        # confirm it is active + next firing
journalctl -u basis-collect.service -n 100       # read the last run's output / error
```
If inactive: `systemctl enable --now basis-collect.timer`. If it errored, fix the cause and run the pipeline manually to catch up (`run_collect.py && run_normalize.py && run_analytics.py`). `Persistent=true` reruns firings missed while the instance was off, but not ones that ran and failed.

### `collect_cron.sh: command not found`

**Cause:** Not executable, or path is wrong.

**Fix:**
```bash
chmod +x ~/Basis/backend/collect_cron.sh
ls -la ~/Basis/backend/collect_cron.sh
```

### Script runs but no DB writes

**Cause:** `.env` not loading, or Docker (Postgres) not running for the service.

**Fix:** Confirm Postgres is up (`docker ps`) and `.env` is valid. On EC2, AWS credentials come from the instance IAM role, so the AWS key vars stay blank; everything else (`DATABASE_URL`, `POSTGRES_PASSWORD`) must be set.

---

## Frontend

### `fetch failed` in the browser console

**Cause:** Backend not running, or CORS blocking.

**Fix:**
- Start backend: `cd backend && uv run uvicorn basis.api.main:app --reload`
- Check `NEXT_PUBLIC_API_URL` in `frontend/.env.local`.

---

## When stuck

- Check `backend/logs/collect.log` for recent collection runs.
- Run in dry-mode (`--dry-run`) to isolate collector vs DB issues.
- Drop into `psql` and check raw vs canonical counts — where does the pipeline stop?
- Read the relevant context pack in [../05-llm/](../05-llm/) for denser context.
