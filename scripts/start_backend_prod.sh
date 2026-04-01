#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-8000}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
PYTHON_EXE="$BACKEND_DIR/.venv/bin/python"

if [ ! -x "$PYTHON_EXE" ]; then
  echo "Python virtual environment was not found at $PYTHON_EXE" >&2
  exit 1
fi

cd "$BACKEND_DIR"
exec "$PYTHON_EXE" -m uvicorn app.main:app --host 127.0.0.1 --port "$PORT"
