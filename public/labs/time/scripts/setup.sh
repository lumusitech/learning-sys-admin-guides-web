#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

require() {
  command -v "$1" >/dev/null 2>&1 || { echo "Falta '$1'." >&2; exit 1; }
}

require docker

compose up -d --build
echo "Esperando sincronización NTP..."
wait_sync 90
bash scripts/verify.sh

echo
echo "Cliente: docker compose exec time-client bash"
echo "Chrony:  docker compose exec time-client chronyc tracking"
