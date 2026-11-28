#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

echo "== Contenedores de los labs =="
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' \
  | grep -E '^(NAMES|identity-lab|mail-lab|time-|iac-|postgres-|mysql|redis|mongo)' || true

echo
echo "== Cluster kind =="
if kind_ok; then
  echo "sysadmin-lab: presente"
  kubectl -n k8s-lab get pods,svc,ingress 2>/dev/null || true
else
  echo "sysadmin-lab: no presente (opcional)"
fi

echo
echo "== Scripts disponibles =="
for lab in db email identity time iac k8s; do
  if [ -x "$LABS/$lab/scripts/setup.sh" ]; then
    echo "- $lab"
  fi
done

echo
echo "== Estado rápido =="
for lab in email identity time iac; do
  if [ -x "$LABS/$lab/scripts/verify.sh" ]; then
    echo "--- $lab"
    ( cd "$LABS/$lab" && ./scripts/verify.sh ) 2>&1 | tail -8 || true
  fi
done
