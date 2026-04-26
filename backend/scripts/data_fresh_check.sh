#!/usr/bin/env bash
set -euo pipefail

LATEST=$(docker compose -f /home/ubuntu/Basis/docker-compose.yml exec -T db \
  psql -U basis -d basis -tAc \
  "SELECT COALESCE(EXTRACT(EPOCH FROM (NOW() - MAX(collected_at)))::bigint, 999999) FROM raw_observations;")

LATEST="${LATEST//[[:space:]]/}"

if [ "$LATEST" -lt 46800 ]; then
    if [ -n "${HC_DATA_FRESH_PING_URL:-}" ]; then
        curl -fsS -m 10 --retry 5 -o /dev/null "$HC_DATA_FRESH_PING_URL" || true
    fi
fi
