#!/usr/bin/env bash
# Configuración y funciones compartidas del laboratorio de boot recovery.
set -euo pipefail

LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$LAB_DIR"

SERIAL_PORT="${SERIAL_PORT:-4444}"
ROOT_PASS="${ROOT_PASS:-labroot}"
QEMU_BIN="${QEMU_BIN:-qemu-system-x86_64}"
BASE_URL="https://cloud.debian.org/images/cloud/bookworm/latest/debian-12-nocloud-amd64.qcow2"
BASE_IMAGE="$LAB_DIR/cache/debian-12-nocloud-amd64.qcow2"
GOLDEN_IMAGE="$LAB_DIR/golden.qcow2"
DISK_IMAGE="$LAB_DIR/disk.qcow2"
PID_FILE="$LAB_DIR/qemu.pid"

qemu_running() {
  [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

qemu_accel() {
  if [ -w /dev/kvm ]; then
    echo "kvm"
  else
    echo "tcg"
  fi
}

start_image() {
  local image="$1"
  local accel
  accel="$(qemu_accel)"

  if qemu_running; then
    return 0
  fi

  if [ ! -f "$image" ]; then
    echo "No existe la imagen $image. Ejecuta ./scripts/setup.sh." >&2
    exit 1
  fi

  "$QEMU_BIN" \
    -machine q35 \
    -accel "$accel" \
    -m 1024 \
    -smp 2 \
    -drive "file=$image,if=virtio,format=qcow2" \
    -netdev user,id=net0 \
    -device virtio-net-pci,netdev=net0 \
    -display none \
    -serial "tcp:127.0.0.1:${SERIAL_PORT},server=on,wait=off" \
    -daemonize \
    -pidfile "$PID_FILE"
}

start_vm() {
  start_image "$DISK_IMAGE"
}

stop_vm() {
  if ! qemu_running; then
    rm -f "$PID_FILE"
    return 0
  fi

  local pid
  pid="$(cat "$PID_FILE")"
  kill "$pid" 2>/dev/null || true
  for _ in $(seq 1 20); do
    if ! kill -0 "$pid" 2>/dev/null; then
      break
    fi
    sleep 0.5
  done
  kill -9 "$pid" 2>/dev/null || true
  rm -f "$PID_FILE"
}

require_tools() {
  local missing=0
  for tool in "$@"; do
    if ! command -v "$tool" >/dev/null 2>&1; then
      echo "Falta '$tool' en el PATH." >&2
      missing=1
    fi
  done
  if [ "$missing" -ne 0 ]; then
    exit 1
  fi
}

# Ejecuta un comando como root por la consola serie. La contraseña ya está
# configurada en la imagen dorada.
vm_exec() {
  local command="$1"
  local encoded
  encoded="$(printf '%s' "$command" | base64 | tr -d '\n')"

  expect <<EOF
set timeout 60
spawn nc 127.0.0.1 $SERIAL_PORT
send "\r"
expect {
  "login:" { send "root\r" }
  timeout { puts "No apareció el login serie."; exit 1 }
}
expect {
  "Password:" { send "$ROOT_PASS\r"; exp_continue }
  "# " { }
}
send "echo $encoded | base64 -d | bash\r"
expect "# "
send "exit\r"
expect {
  "login:" { }
  eof { }
  timeout { }
}
close
EOF
}

wait_login() {
  local timeout="${1:-240}"
  local encoded
  encoded="$(printf '%s' "echo READY" | base64 | tr -d '\n')"

  expect <<EOF
set timeout $timeout
spawn nc 127.0.0.1 $SERIAL_PORT
send "\r"
expect {
  "login:" { send "root\r" }
  timeout { puts "La VM no llegó al login."; exit 1 }
}
expect {
  "Password:" { send "$ROOT_PASS\r"; exp_continue }
  "# " { }
}
send "echo $encoded | base64 -d | bash\r"
expect "READY"
send "exit\r"
expect {
  "login:" { }
  eof { }
  timeout { }
}
close
EOF
}

gui_display() {
  case "$(uname -s)" in
    Darwin) echo "cocoa" ;;
    Linux) if [ -n "${DISPLAY:-}" ]; then echo "gtk"; else echo "none"; fi ;;
    *) echo "none" ;;
  esac
}

qemu_gui() {
  local display
  display="$(gui_display)"
  local accel
  accel="$(qemu_accel)"

  if [ "$display" = "none" ]; then
    echo "No hay display gráfico disponible; usa ./scripts/console.sh." >&2
    exit 1
  fi

  if qemu_running; then
    stop_vm
  fi

  exec "$QEMU_BIN" \
    -machine q35 \
    -accel "$accel" \
    -m 1024 \
    -smp 2 \
    -drive "file=$DISK_IMAGE,if=virtio,format=qcow2" \
    -netdev user,id=net0 \
    -device virtio-net-pci,netdev=net0 \
    -display "$display" \
    -serial "tcp:127.0.0.1:${SERIAL_PORT},server=on,wait=off" \
    -pidfile "$PID_FILE"
}
