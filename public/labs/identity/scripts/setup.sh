#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

require() {
  command -v "$1" >/dev/null 2>&1 || { echo "Falta '$1'." >&2; exit 1; }
}

require docker
require ssh
require ssh-keygen

mkdir -p "$LAB_DIR/keys"
chmod 700 "$LAB_DIR/keys"
if [ ! -f "$KEY" ]; then
  ssh-keygen -t ed25519 -N '' -f "$KEY" >/dev/null
fi
chmod 600 "$KEY"

compose up -d --build
echo "Esperando a que SSH acepte la clave del laboratorio..."
wait_ssh 90
bash scripts/verify.sh

echo
echo "SSH: ./scripts/ssh.sh [learner|admin] [comando]"
echo "Consola root: ./scripts/exec.sh"
