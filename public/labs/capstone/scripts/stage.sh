#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

require_docker

with_k8s=0
if [ "${1:-}" = "--with-k8s" ]; then
  with_k8s=1
fi

echo "== Preparando email =="
run_lab email setup.sh

echo "== Preparando identidad =="
run_lab identity setup.sh

echo "== Preparando tiempo =="
run_lab time setup.sh

echo "== Preparando IaC =="
run_lab iac setup.sh

echo "== Preparando bases de datos =="
run_lab db setup.sh

if [ "$with_k8s" -eq 1 ]; then
  echo "== Preparando Kubernetes =="
  run_lab k8s setup.sh
else
  echo "Kubernetes no se prepara (usa --with-k8s si tienes kind)."
fi

echo
bash scripts/status.sh
