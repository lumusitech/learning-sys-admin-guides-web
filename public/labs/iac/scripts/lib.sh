#!/usr/bin/env bash
set -euo pipefail

LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF_DIR="$LAB_DIR/terraform"
TF_BIN="${TF_BIN:-terraform}"
PORT="${PORT:-8088}"

tf() {
  (cd "$TF_DIR" && "$TF_BIN" "$@")
}

require() {
  command -v "$1" >/dev/null 2>&1 || { echo "Falta '$1'." >&2; exit 1; }
}

wait_http() {
  local attempts="${1:-30}"
  for _ in $(seq 1 "$attempts"); do
    if curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "El servicio no responde en el puerto $PORT." >&2
  return 1
}
