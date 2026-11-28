#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

send_mail "${1:-alice@lab.local}" "${2:-Prueba}" "${3:-Hola desde el laboratorio}"
echo "Mensaje aceptado por SMTP."
