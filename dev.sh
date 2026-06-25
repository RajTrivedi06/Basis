#!/usr/bin/env bash
# Start Basis against live EC2 data (polish loop) in one command.
#
# Prerequisites (one-time):
#   - Host basis-prod in ~/.ssh/config
#   - basis-sg allows SSH from your IP
#   - cd frontend && npm install
#
# Usage:
#   ./dev.sh          # EC2 API + tunnel + frontend (default)
#   ./dev.sh local    # fully local stack (Docker + local API + frontend)

set -euo pipefail

SSH_HOST="${BASIS_SSH_HOST:-basis-prod}"
LOCAL_API_PORT="${BASIS_LOCAL_API_PORT:-8000}"
LOCAL_WEB_PORT="${BASIS_LOCAL_WEB_PORT:-3000}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

info() { printf '→ %s\n' "$*"; }
die() { printf '✗ %s\n' "$*" >&2; exit 1; }

local_health() {
  curl -sf "http://127.0.0.1:${LOCAL_API_PORT}/health" 2>/dev/null || true
}

check_ssh() {
  info "Checking SSH to ${SSH_HOST}..."
  if ! ssh -o ConnectTimeout=12 -o BatchMode=yes "${SSH_HOST}" true 2>/dev/null; then
    die "Cannot SSH to ${SSH_HOST}. Is EC2 running? Is your IP allowed in basis-sg? (curl -4 ifconfig.me)"
  fi
}

ensure_remote_api() {
  info "Ensuring API is running on EC2..."
  ssh -o ConnectTimeout=15 -o BatchMode=yes "${SSH_HOST}" bash <<'REMOTE'
set -e
if curl -sf http://127.0.0.1:8000/health | grep -q '"status":"ok"'; then
  echo "API already running on EC2"
  exit 0
fi
echo "Starting uvicorn on EC2..."
pkill -f 'uvicorn basis.api.main' 2>/dev/null || true
sleep 1
cd ~/Basis/backend
nohup uv run uvicorn basis.api.main:app --host 127.0.0.1 --port 8000 > /tmp/uvicorn.log 2>&1 &
sleep 3
curl -sf http://127.0.0.1:8000/health >/dev/null
echo "uvicorn started on EC2"
REMOTE
}

ensure_tunnel() {
  local health
  health="$(local_health)"

  if echo "${health}" | grep -q '"environment":"prod"'; then
    info "API reachable at localhost:${LOCAL_API_PORT} (prod)"
    return
  fi

  if echo "${health}" | grep -q '"environment":"dev"'; then
    die "localhost:${LOCAL_API_PORT} is a local dev backend, not EC2. Stop it first: lsof -i :${LOCAL_API_PORT}"
  fi

  info "Starting SSH tunnel (localhost:${LOCAL_API_PORT} → EC2:8000)..."
  ssh -f -N -o ExitOnForwardFailure=yes -L "${LOCAL_API_PORT}:127.0.0.1:8000" "${SSH_HOST}"

  sleep 1
  health="$(local_health)"
  if ! echo "${health}" | grep -q '"environment":"prod"'; then
    die "Tunnel started but health check failed. Try: ssh ${SSH_HOST} 'tail -20 /tmp/uvicorn.log'"
  fi
  info "Tunnel up — localhost:${LOCAL_API_PORT} → EC2"
}

pick_web_port() {
  if ! lsof -i ":${LOCAL_WEB_PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
    return
  fi

  # Port busy — try 3001, 3002, ...
  local port="${LOCAL_WEB_PORT}"
  while lsof -i ":${port}" -sTCP:LISTEN >/dev/null 2>&1; do
    port=$((port + 1))
  done
  if [[ "${port}" != "${LOCAL_WEB_PORT}" ]]; then
    info "Port ${LOCAL_WEB_PORT} is in use (another app?) — using ${port} instead"
    LOCAL_WEB_PORT="${port}"
  fi
}

start_frontend() {
  pick_web_port
  info "Starting frontend at http://localhost:${LOCAL_WEB_PORT}"
  info "Press Ctrl+C to stop the frontend (tunnel keeps running in background)"
  cd "${REPO_ROOT}/frontend"
  exec npm run dev -- -p "${LOCAL_WEB_PORT}"
}

start_local() {
  info "Starting local stack (Docker Postgres + local API + frontend)..."

  if ! docker info >/dev/null 2>&1; then
    die "Docker is not running. Start Docker Desktop first."
  fi

  docker compose -f "${REPO_ROOT}/docker-compose.yml" up -d

  local health
  health="$(local_health)"
  if ! echo "${health}" | grep -q '"status":"ok"'; then
    info "Starting local API on port ${LOCAL_API_PORT}..."
    cd "${REPO_ROOT}/backend"
    uv run uvicorn basis.api.main:app --host 127.0.0.1 --port "${LOCAL_API_PORT}" --reload &
    local api_pid=$!
    trap 'kill "${api_pid}" 2>/dev/null || true' EXIT

    for _ in $(seq 1 15); do
      health="$(local_health)"
      if echo "${health}" | grep -q '"status":"ok"'; then
        break
      fi
      sleep 1
    done
  fi

  health="$(local_health)"
  if ! echo "${health}" | grep -q '"status":"ok"'; then
    die "Local API failed to start on port ${LOCAL_API_PORT}"
  fi

  info "Local API up at http://localhost:${LOCAL_API_PORT}"
  start_frontend
}

start_polish() {
  check_ssh
  ensure_remote_api
  ensure_tunnel
  start_frontend
}

case "${1:-polish}" in
  polish|prod|"") start_polish ;;
  local) start_local ;;
  -h|--help|help)
    cat <<EOF
Usage: ./dev.sh [polish|local]

  polish   Live EC2 data via SSH tunnel (default)
  local    Docker Postgres + local FastAPI + frontend

Environment:
  BASIS_SSH_HOST=${SSH_HOST}
  BASIS_LOCAL_API_PORT=${LOCAL_API_PORT}
  BASIS_LOCAL_WEB_PORT=${LOCAL_WEB_PORT}
EOF
    ;;
  *)
    die "Unknown mode: ${1}. Use: ./dev.sh [polish|local]"
    ;;
esac
