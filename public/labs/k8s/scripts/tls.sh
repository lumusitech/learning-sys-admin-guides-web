#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v openssl >/dev/null 2>&1; then
  echo "Falta openssl en el PATH."
  exit 1
fi

cat > /tmp/k8s-lab-openssl.cnf <<'EOF'
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = app.local

[v3_req]
subjectAltName = DNS:app.local
EOF

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /tmp/k8s-lab-app.key \
  -out /tmp/k8s-lab-app.crt \
  -config /tmp/k8s-lab-openssl.cnf

kubectl -n k8s-lab create secret tls app-tls \
  --cert=/tmp/k8s-lab-app.crt \
  --key=/tmp/k8s-lab-app.key \
  --dry-run=client -o yaml | kubectl apply -f -
