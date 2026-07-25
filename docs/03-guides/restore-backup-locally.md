# Restore an S3 Backup into Local Docker Postgres

**Purpose:** replace the local `basis` database (currently the frozen pre-EC2
snapshot — disposable) with the latest production backup from S3, then bring it
to the Alembic migration head. This doubles as the backup-restore verification
drill: a backup you haven't restored is not a backup.

**You need:** AWS credentials with read access to `basis-backups-rajt-2026`
(your IAM user, or `aws configure` a profile), the `aws` CLI, Docker running
with the local stack's `db` container up, and ~10 minutes.

**Format note:** backups are plain-SQL dumps (`pg_dump | gzip -9`, see
`backend/scripts/backup.sh`) — restore with `psql`, **not** `pg_restore`.

---

## 1. Find and download the latest dump

```bash
aws s3 ls s3://basis-backups-rajt-2026/daily/ | sort | tail -5
# pick the newest, e.g. basis-2026-07-24.sql.gz
aws s3 cp s3://basis-backups-rajt-2026/daily/basis-2026-07-24.sql.gz ~/Downloads/
gunzip -t ~/Downloads/basis-2026-07-24.sql.gz && echo "gzip OK"
```

## 2. Stop anything using the local DB

Stop any running `uvicorn`/pytest/collection processes. The Docker `db`
container itself stays up:

```bash
cd ~/Documents/CS/Basis
docker compose ps   # db should be running/healthy
```

## 3. Drop and recreate the local database

> ⚠️ Destructive to the **local** DB only. The local snapshot (33,525 rows,
> Apr 2026) is disposable — production and its S3 backups are untouched.
> Confirm you are pointed at `127.0.0.1:5433` (the local container) before
> proceeding.

```bash
docker compose exec -T db psql -U basis -d postgres \
  -c "DROP DATABASE basis WITH (FORCE);" \
  -c "CREATE DATABASE basis OWNER basis;"
```

## 4. Restore the dump

```bash
gunzip -c ~/Downloads/basis-2026-07-24.sql.gz \
  | docker compose exec -T db psql -U basis -d basis -q
```

A stream of `CREATE TABLE` / `COPY` / `ALTER TABLE` output is normal. Errors
about roles/ownership can be ignored if the only role is `basis`; any
`ERROR` on a `COPY` is not fine — stop and investigate.

## 5. Bring the schema to migration head

The production DB got the `ix_canonical_raw_obs_id` index manually on
2026-07-12; the migration uses `CREATE INDEX IF NOT EXISTS`, so this is safe
and idempotent regardless of what the dump contains:

```bash
cd backend
uv run alembic upgrade head
uv run alembic current   # must print: b7f3a9c2d1e4 (head)
```

## 6. Sanity checks

```bash
PGPASSWORD=basis psql -h 127.0.0.1 -p 5433 -U basis -d basis \
  -c "SELECT count(*) AS raw FROM raw_observations;" \
  -c "SELECT count(*) AS canonical FROM canonical_offers;" \
  -c "SELECT source, count(*) FROM raw_observations GROUP BY source ORDER BY source;" \
  -c "SELECT max(collected_at) AS newest FROM raw_observations;"
```

Expected (as of 2026-07-24): raw ≈ 318k, canonical ≈ 316k, four sources
(vast dominant), `newest` within the last ~16 h (collection runs 08:00 and
20:00 UTC). If numbers are wildly off, you restored an old dump — check step 1.

## 7. Afterwards

- `uv run pytest` from `backend/` should now pass its data-freshness tests
  (`test_basis_timeseries` needed recent decompositions).
- The destructive normalization test stays skipped unless you export
  `BASIS_ALLOW_DESTRUCTIVE_TESTS=1` — on a fresh restore that's safe but will
  re-normalize the full corpus (minutes, not seconds).
- Delete the downloaded dump when done, or keep it as a local cold copy.
