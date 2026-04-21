#!/bin/bash
# Cron wrapper for the full Basis pipeline.
# Called by crontab twice daily. Logs to backend/logs/collect.log.
# Runs: collect -> normalize -> analytics

set -euo pipefail

REPO_DIR="/Users/raaj/Documents/CS/Basis"
BACKEND_DIR="$REPO_DIR/backend"
LOG_DIR="$BACKEND_DIR/logs"
LOG_FILE="$LOG_DIR/collect.log"

mkdir -p "$LOG_DIR"

cd "$BACKEND_DIR"

echo "" >> "$LOG_FILE"
echo "=== Pipeline run: $(date -u '+%Y-%m-%d %H:%M:%S UTC') ===" >> "$LOG_FILE"

# Use the full path to uv
UV="$HOME/.local/bin/uv"
if [ ! -f "$UV" ]; then
    UV="$(which uv 2>/dev/null || echo uv)"
fi

echo "--- collect ---" >> "$LOG_FILE"
$UV run python run_collect.py >> "$LOG_FILE" 2>&1

echo "--- normalize ---" >> "$LOG_FILE"
$UV run python run_normalize.py >> "$LOG_FILE" 2>&1

echo "--- analytics ---" >> "$LOG_FILE"
$UV run python run_analytics.py >> "$LOG_FILE" 2>&1

echo "=== Completed: $(date -u '+%Y-%m-%d %H:%M:%S UTC') ===" >> "$LOG_FILE"
