#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

phase="${1:-all}"

break_db_email() {
  echo "== Fase 1: datos y correo =="
  run_lab db break.sh 01
  run_lab email break.sh 01
}

break_identity_time() {
  echo "== Fase 2: acceso y tiempo =="
  run_lab identity break.sh 03
  run_lab time break.sh 02
}

break_iac_k8s() {
  echo "== Fase 3: infraestructura y entrega =="
  run_lab iac break.sh 01
  if kind_ok; then
    echo "Service web con selector incorrecto..."
    kubectl -n k8s-lab patch svc web --type=merge       -p '{"spec":{"selector":{"app":"web-wrong"}}}' >/dev/null
    kubectl -n k8s-lab get endpoints web
  else
    echo "kind no está presente: se omite el fallo de Kubernetes."
  fi
}

case "$phase" in
  1) break_db_email ;;
  2) break_identity_time ;;
  3) break_iac_k8s ;;
  all)
    break_db_email
    break_identity_time
    break_iac_k8s
    ;;
  *)
    echo "Uso: $0 <1|2|3|all>" >&2
    exit 1
    ;;
esac

echo
echo "Incidente inyectado. Abre el escenario y empieza por el triaje."
