#!/usr/bin/env bash
set -euo pipefail

LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$LAB_DIR"

CONTAINER="identity-lab"
SSH_PORT="${SSH_PORT:-2222}"
KEY="$LAB_DIR/keys/id_ed25519"

compose() {
  docker compose "$@"
}

wait_ssh() {
  local attempts="${1:-60}"
  for _ in $(seq 1 "$attempts"); do
    if ssh -i "$KEY" -p "$SSH_PORT" \
        -o BatchMode=yes -o ConnectTimeout=1 \
        -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
        learner@127.0.0.1 true >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "SSH no respondió en el puerto $SSH_PORT." >&2
  return 1
}

ssh_run() {
  local user="${1:-learner}"
  shift || true
  ssh -i "$KEY" -p "$SSH_PORT" \
    -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
    "$user"@127.0.0.1 "$@"
}

exec_root() {
  compose exec -T identity bash -lc "$*"
}
