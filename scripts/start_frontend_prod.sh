#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-3000}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$REPO_ROOT/frontend"

cd "$FRONTEND_DIR"
export PORT
exec npm run start
