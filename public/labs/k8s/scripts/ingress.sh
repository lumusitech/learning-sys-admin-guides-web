#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

INGRESS_VERSION="${INGRESS_VERSION:-controller-v1.11.3}"
URL="https://raw.githubusercontent.com/kubernetes/ingress-nginx/${INGRESS_VERSION}/deploy/static/provider/kind/deploy.yaml"

echo "Instalando ingress-nginx ${INGRESS_VERSION}…"
kubectl apply -f "$URL"
kubectl -n ingress-nginx wait \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=240s
