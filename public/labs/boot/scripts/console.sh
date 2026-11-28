#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

require_tools nc

if ! qemu_running; then
  start_vm
fi

exec nc 127.0.0.1 "$SERIAL_PORT"
