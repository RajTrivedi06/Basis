#!/usr/bin/env bash
set -euo pipefail

# Find repo root from script location (works on any machine)
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$REPO_DIR/backend"
cd "$BACKEND_DIR"

UV="$HOME/.local/bin/uv"
[ -x "$UV" ] || UV="$(command -v uv)"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] basis-collect starting"

"$UV" run python run_collect.py
"$UV" run python run_normalize.py
"$UV" run python run_analytics.py

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] basis-collect done"

# Ping healthchecks.io on success
if [ -n "${HC_PING_URL:-}" ]; then
    curl -fsS -m 10 --retry 5 -o /dev/null "$HC_PING_URL" || true
fi

# Per-provider volume anomaly check. Non-fatal: collection already succeeded;
# this only decides whether to raise a *separate* alert. `if` guards it from
# `set -e`. On anomaly (exit 1) ping the /fail endpoint so healthchecks.io
# alerts within one cycle; otherwise ping success.
if "$UV" run python scripts/check_collection_volume.py; then
    VOLUME_STATUS="success"
else
    VOLUME_STATUS="fail"
fi
if [ -n "${HC_VOLUME_PING_URL:-}" ]; then
    if [ "$VOLUME_STATUS" = "success" ]; then
        curl -fsS -m 10 --retry 5 -o /dev/null "$HC_VOLUME_PING_URL" || true
    else
        curl -fsS -m 10 --retry 5 -o /dev/null "$HC_VOLUME_PING_URL/fail" || true
    fi
fi
