#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
scenario="${1:-}"

if [[ -z "$scenario" ]]; then
  echo "Uso: $0 <01|02|03|04|05|06>"
  exit 1
fi

shopt -s nullglob
files=(manifests/broken/"$scenario"-*.yaml)
shopt -u nullglob

if [[ ${#files[@]} -eq 0 ]]; then
  echo "No existe el escenario $scenario."
  exit 1
fi

kubectl apply -f "${files[@]}"
kubectl -n k8s-lab get pods,pvc,ingress
