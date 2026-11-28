#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

case "${1:-}" in
  01)
    echo "Escenario 01: contenedor eliminado fuera de Terraform (drift)..."
    docker rm -f iac-web >/dev/null 2>&1 || true
    set +e
    tf plan -detailed-exitcode -input=false
    code=$?
    set -e
    echo "Plan exit code: $code (2 = drift detectado)."
    echo "Repara con: (cd terraform && terraform apply -auto-approve)"
    ;;
  02)
    echo "Escenario 02: recurso eliminado del state..."
    tf state rm docker_container.web
    echo "Terraform ya no conoce el contenedor; el contenedor real sigue existiendo."
    echo "Repara con: terraform import docker_container.web \"$(docker inspect -f '{{.Id}}' iac-web)\""
    ;;
  03)
    echo "Escenario 03: state corrupto..."
    cp "$TF_DIR/terraform.tfstate" "$TF_DIR/terraform.tfstate.valid"
    printf '{ "version": 4, "resources": [\n' > "$TF_DIR/terraform.tfstate"
    set +e
    tf plan -input=false
    code=$?
    set -e
    echo "Plan exit code: $code (debe fallar por state inválido)."
    echo "Repara con: cp terraform.tfstate.valid terraform.tfstate"
    ;;
  04)
    echo "Escenario 04: conflicto de puerto en apply..."
    docker rm -f iac-web >/dev/null 2>&1 || true
    docker rm -f iac-conflict >/dev/null 2>&1 || true
    docker run -d --name iac-conflict -p "${PORT}:80" nginx:1.27-alpine >/dev/null
    sleep 2
    set +e
    tf apply -auto-approve
    code=$?
    set -e
    echo "Apply exit code: $code (debe fallar por puerto ocupado)."
    echo "Repara con: docker rm -f iac-conflict && terraform apply -auto-approve"
    ;;
  *)
    echo "Uso: $0 <01|02|03|04>" >&2
    exit 1
    ;;
esac
