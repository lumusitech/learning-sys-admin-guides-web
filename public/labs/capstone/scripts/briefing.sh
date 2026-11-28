#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

cat <<'EOF'
============================================================
  CAPSTONE DE GUARDIA — INCIDENTE NOCTURNO
============================================================

02:07  La web devuelve 502 de forma intermitente.
02:09  El panel de pedidos muestra errores de conexión.
02:12  El correo de alertas empieza a acumularse.
02:15  Un operador no puede entrar por SSH con contraseña.
02:18  Los logs llegan con marcas de tiempo inconsistentes.
02:21  Terraform detecta drift en el servicio web.
02:24  Kubernetes no encuentra endpoints para el servicio.

No hay un único culpable. Hay varios fallos independientes
que coinciden en la misma guardia.

Tu trabajo:
  1. Delimitar el alcance y preservar evidencia.
  2. Resolver primero lo que afecta a usuarios.
  3. No reiniciar todo a ciegas.
  4. Cerrar con verificaciones y postmortem.

Comandos:
  ./scripts/status.sh      estado de los labs
  ./scripts/stage.sh       preparar labs Docker
  ./scripts/break.sh 1     fase datos/correo
  ./scripts/break.sh 2     fase acceso/tiempo
  ./scripts/break.sh 3     fase IaC/Kubernetes
  ./scripts/break.sh all   todas las fases
  ./scripts/verify.sh      criterio de cierre
  ./scripts/reset.sh       restaurar todo
EOF
