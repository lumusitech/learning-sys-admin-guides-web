#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

require_tools "$QEMU_BIN" qemu-img curl expect nc

mkdir -p "$LAB_DIR/cache"

if [ ! -s "$BASE_IMAGE" ] || [ "$(wc -c < "$BASE_IMAGE")" -lt 100000000 ]; then
  echo "Descargando la imagen base de Debian (unos 400 MB)..."
  curl -L --fail --output "$BASE_IMAGE.part" "$BASE_URL"
  mv "$BASE_IMAGE.part" "$BASE_IMAGE"
fi

if [ ! -f "$GOLDEN_IMAGE" ]; then
  echo "Creando y provisionando la imagen dorada..."
  stop_vm
  qemu-img create -f qcow2 -F qcow2 -b "$BASE_IMAGE" "$GOLDEN_IMAGE" >/dev/null
  start_image "$GOLDEN_IMAGE"

  provision_commands \
    'sed -i "s/^GRUB_TIMEOUT=.*/GRUB_TIMEOUT=30/" /etc/default/grub' \
    'grep -q "^GRUB_TIMEOUT_STYLE=" /etc/default/grub || echo "GRUB_TIMEOUT_STYLE=menu" >> /etc/default/grub' \
    'grep -q "^GRUB_TERMINAL=" /etc/default/grub || echo "GRUB_TERMINAL=\"serial console\"" >> /etc/default/grub' \
    'grep -q "^GRUB_SERIAL_COMMAND=" /etc/default/grub || echo "GRUB_SERIAL_COMMAND=\"serial --speed=115200 --unit=0 --word=8 --parity=no --stop=1\"" >> /etc/default/grub' \
    'sed -i "s/^GRUB_CMDLINE_LINUX=.*/GRUB_CMDLINE_LINUX=\"console=tty0 console=ttyS0,115200n8\"/" /etc/default/grub' \
    'update-grub' \
    'systemctl enable serial-getty@ttyS0.service >/dev/null 2>&1 || true' \
    'systemctl set-default multi-user.target >/dev/null 2>&1 || true' \
    'sync' \
    'echo "root:labroot" | chpasswd'

  stop_vm
fi

if [ ! -f "$DISK_IMAGE" ]; then
  echo "Creando el disco desechable desde la imagen dorada..."
  qemu-img create -f qcow2 -F qcow2 -b "$GOLDEN_IMAGE" "$DISK_IMAGE" >/dev/null
fi

start_vm
echo "Esperando a que la VM arranque..."
wait_login 240
echo
bash scripts/verify.sh

echo
echo "VM lista. Consola serie: ./scripts/console.sh"
echo "Consola gráfica: ./scripts/boot.sh --gui"
