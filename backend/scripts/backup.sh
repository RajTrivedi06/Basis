#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_DIR"

BUCKET="basis-backups-rajt-2026"
TODAY="$(date -u +%Y-%m-%d)"
BACKUP_FILE="/tmp/basis-${TODAY}.sql.gz"

docker compose exec -T db pg_dump -U basis basis | gzip -9 > "$BACKUP_FILE"

aws s3 cp "$BACKUP_FILE" "s3://${BUCKET}/daily/basis-${TODAY}.sql.gz"

find /tmp -name 'basis-*.sql.gz' -mtime +7 -delete

if [ -n "${HC_BACKUP_PING_URL:-}" ]; then
    curl -fsS -m 10 --retry 5 -o /dev/null "$HC_BACKUP_PING_URL" || true
fi
