#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

require() {
  command -v "$1" >/dev/null 2>&1 || { echo "Falta '$1'." >&2; exit 1; }
}

require docker
require curl

compose up -d --build
echo "Esperando a Postfix y Dovecot..."
wait_mail 90
bash scripts/verify.sh

echo
echo "Enviar: ./scripts/send.sh alice@lab.local 'Asunto' 'Cuerpo'"
echo "IMAP:   ./scripts/imap.sh alice alice"
echo "Consola: ./scripts/exec.sh"
