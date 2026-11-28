#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

echo "== Outputs =="
tf output

echo
echo "== Contenedor =="
docker ps --filter "name=iac-web" --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

echo
echo "== Plan =="
set +e
tf plan -detailed-exitcode -input=false
code=$?
set -e
if [ "$code" -eq 0 ]; then
  echo "Plan: sin cambios."
elif [ "$code" -eq 2 ]; then
  echo "Plan: hay drift (cambios pendientes)."
else
  echo "Plan: error ($code)." >&2
  exit "$code"
fi

echo
echo "== HTTP =="
curl -fsS "http://127.0.0.1:${PORT}/" | grep -o '<title>[^<]*</title>' || true
