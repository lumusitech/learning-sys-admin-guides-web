#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

if [ $# -eq 0 ]; then
  echo "Uso: $0 '<comando>'" >&2
  exit 1
fi

if ! qemu_running; then
  start_vm
  wait_login 240
fi

vm_exec "$*"
