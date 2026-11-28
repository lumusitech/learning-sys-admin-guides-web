#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

for cmd in docker kind kubectl; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Falta $cmd en el PATH."
    exit 1
  fi
done

if ! kind get clusters | grep -qx sysadmin-lab; then
  kind create cluster --config kind-config.yaml
fi

kubectl apply -f manifests/base/namespace.yaml
kubectl apply -f manifests/base/pv-local.yaml
kubectl apply -f manifests/base/app-deployment.yaml -f manifests/base/app-service.yaml
kubectl -n k8s-lab rollout status deploy/web --timeout=180s

./scripts/ingress.sh
./scripts/tls.sh
kubectl apply -f manifests/base/app-ingress.yaml

./scripts/verify.sh
