#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

require_docker

echo "== Restaurando email =="
run_lab email reset.sh

echo "== Restaurando identidad =="
run_lab identity reset.sh

echo "== Restaurando tiempo =="
run_lab time reset.sh

echo "== Restaurando IaC =="
run_lab iac reset.sh

echo "== Restaurando bases de datos =="
run_lab db reset.sh --all
run_lab db setup.sh

if kind_ok; then
  echo "== Restaurando Kubernetes =="
  run_lab k8s reset.sh
  kubectl -n k8s-lab patch svc web --type=merge     -p '{"spec":{"selector":{"app":"web"}}}' >/dev/null 2>&1 || true
else
  echo "kind no está presente: se omite Kubernetes."
fi

echo
bash scripts/status.sh
