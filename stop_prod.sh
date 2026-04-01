#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
PID_DIR="$REPO_ROOT/.run"

stop_from_pid() {
  local file="$1"
  if [ -f "$file" ]; then
    local pid
    pid="$(cat "$file")"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" || true
    fi
    rm -f "$file"
  fi
}

stop_from_pid "$PID_DIR/backend.pid"
stop_from_pid "$PID_DIR/frontend.pid"

pkill -f "uvicorn app.main:app --host 127.0.0.1 --port 8000" 2>/dev/null || true
pkill -f "next start" 2>/dev/null || true

echo "Stopped MusicGen listeners if they were running."
