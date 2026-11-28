#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

echo "== Contenedores =="
compose ps
echo
echo "== Zona horaria =="
client_exec date
client_exec cat /etc/timezone
echo
echo "== Chrony =="
client_exec chronyc tracking
echo
echo "== Fuentes =="
client_exec chronyc sources -v
