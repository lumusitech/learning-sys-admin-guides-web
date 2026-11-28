#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

if ! qemu_running; then
  start_vm
  wait_login 240
fi

case "${1:-}" in
  01)
    echo "Escenario 01: borrar la configuración de GRUB..."
    vm_exec '
      cp /boot/grub/grub.cfg /root/grub.cfg.bak
      rm -f /boot/grub/grub.cfg
      sync
    '
    stop_vm
    echo "Arranca con ./scripts/boot.sh --gui y repara desde 'grub rescue>'."
    ;;
  02)
    echo "Escenario 02: añadir una entrada inválida a /etc/fstab..."
    vm_exec '
      cp /etc/fstab /root/fstab.bak
      echo "UUID=00000000-0000-0000-0000-000000000000 /mnt/broken ext4 defaults 0 2" >> /etc/fstab
      sync
    '
    stop_vm
    echo "Arranca con ./scripts/boot.sh --gui; systemd debe caer en emergency mode."
    ;;
  03)
    echo "Escenario 03: romper el parámetro root= del kernel..."
    vm_exec '
      cp /boot/grub/grub.cfg /root/grub.cfg.bak
      sed -i "s#root=[^ ]*#root=/dev/vda999#g" /boot/grub/grub.cfg
      sync
    '
    stop_vm
    echo "Arranca con ./scripts/boot.sh --gui y corrige la entrada desde el menú de GRUB."
    ;;
  04)
    echo "Escenario 04: cambiar la contraseña de root por una desconocida..."
    vm_exec '
      NEW=$(head -c 16 /dev/urandom | od -An -tx1 | tr -d " \n")
      echo "root:$NEW" | chpasswd
      sync
    '
    stop_vm
    echo "Arranca con ./scripts/boot.sh --gui y usa init=/bin/bash desde GRUB."
    ;;
  *)
    echo "Uso: $0 <01|02|03|04>" >&2
    exit 1
    ;;
esac
