#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ "${1:-}" == "--all" ]]; then
  kind delete cluster --name sysadmin-lab
  exit 0
fi

kubectl delete -f manifests/broken/ --ignore-not-found
kubectl -n k8s-lab get pods,pvc,ingress
