#!/usr/bin/env bash
set -euo pipefail

LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$LAB_DIR"

compose() {
  docker compose "$@"
}

client_exec() {
  compose exec -T time-client "$@"
}

wait_sync() {
  local attempts="${1:-90}"
  for _ in $(seq 1 "$attempts"); do
    if client_exec chronyc tracking 2>/dev/null | grep -q 'Leap status.*Normal'; then
      return 0
    fi
    sleep 1
  done
  echo "El cliente no sincronizó con NTP." >&2
  client_exec chronyc tracking >&2 || true
  return 1
}
