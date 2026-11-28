#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

require "$TF_BIN"
require docker
require curl

echo "Inicializando Terraform..."
tf init -upgrade

echo "Aplicando infraestructura..."
tf apply -auto-approve

wait_http 30
bash scripts/verify.sh

echo
echo "Terraform: cd terraform && terraform plan"
echo "Servicio:  http://localhost:${PORT}/"
