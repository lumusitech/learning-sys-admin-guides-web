#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
exec docker compose exec postgres-primary psql -U app -d app "$@"
