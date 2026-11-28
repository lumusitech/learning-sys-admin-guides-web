#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

if ! qemu_running; then
  start_vm
  wait_login 240
fi

vm_exec '
  echo "== Kernel =="
  uname -a
  echo
  echo "== systemd =="
  systemctl is-system-running || true
  echo
  echo "== Raíz =="
  findmnt -n -o SOURCE,FSTYPE,TARGET /
  echo
  echo "== Discos =="
  lsblk -o NAME,FSTYPE,SIZE,MOUNTPOINT
  echo
  echo VERIFY_OK
'
