#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

case "${1:-}" in
  --all)
    stop_vm
    rm -f "$DISK_IMAGE" "$GOLDEN_IMAGE" "$PID_FILE" "$LAB_DIR"/serial.log
    rm -rf "$LAB_DIR/cache"
    echo "Laboratorio eliminado (imágenes y discos)."
    ;;
  01|02|03|04|"")
    if [ ! -f "$GOLDEN_IMAGE" ]; then
      echo "No existe la imagen dorada. Ejecuta ./scripts/setup.sh." >&2
      exit 1
    fi
    stop_vm
    rm -f "$DISK_IMAGE"
    qemu-img create -f qcow2 -F qcow2 -b "$GOLDEN_IMAGE" "$DISK_IMAGE" >/dev/null
    start_vm
    echo "Esperando a que la VM vuelva a arrancar..."
    wait_login 240
    echo "Laboratorio restaurado."
    ;;
  *)
    echo "Uso: $0 <01|02|03|04|--all>" >&2
    exit 1
    ;;
esac
