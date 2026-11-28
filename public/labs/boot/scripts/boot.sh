#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

case "${1:-}" in
  --gui)
    if [ ! -f "$DISK_IMAGE" ]; then
      echo "No existe el disco. Ejecuta ./scripts/setup.sh." >&2
      exit 1
    fi
    qemu_gui
    ;;
  "")
    start_vm
    echo "VM en marcha. Consola serie: ./scripts/console.sh"
    ;;
  *)
    echo "Uso: $0 [--gui]" >&2
    exit 1
    ;;
esac
