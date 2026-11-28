#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

compose down -v --remove-orphans >/dev/null 2>&1 || true
compose up -d
echo "Esperando sincronización NTP..."
wait_sync 90
bash scripts/verify.sh
echo "Laboratorio restaurado."
