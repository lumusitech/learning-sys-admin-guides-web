#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

kubectl -n k8s-lab get pods,svc,ingress,pvc

echo
if command -v curl >/dev/null 2>&1; then
  echo "Ingress app.local (certificado self-signed):"
  curl -ksS --resolve app.local:8443:127.0.0.1 https://app.local:8443/ | head -n 5 || true
fi
