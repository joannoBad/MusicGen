#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
PID_DIR="$REPO_ROOT/.run"
mkdir -p "$PID_DIR"

nohup "$SCRIPT_DIR/start_backend_prod.sh" 8000 > "$PID_DIR/backend.log" 2>&1 &
echo $! > "$PID_DIR/backend.pid"

nohup "$SCRIPT_DIR/start_frontend_prod.sh" 3000 > "$PID_DIR/frontend.log" 2>&1 &
echo $! > "$PID_DIR/frontend.pid"

echo "MusicGen production services are starting."
echo "Frontend: http://127.0.0.1:3000"
echo "Backend:  http://127.0.0.1:8000/api/health"
