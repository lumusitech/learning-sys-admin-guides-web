#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

docker rm -f iac-web iac-conflict >/dev/null 2>&1 || true
rm -f "$TF_DIR"/terraform.tfstate "$TF_DIR"/terraform.tfstate.* "$TF_DIR"/.terraform.tfstate.lock.info

echo "Reinicializando Terraform..."
tf init -upgrade >/dev/null
tf apply -auto-approve
wait_http 30
bash scripts/verify.sh
echo "Laboratorio restaurado."
