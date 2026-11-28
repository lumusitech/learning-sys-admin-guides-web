#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

failed=0

fail() {
  echo "FALLO: $*"
  failed=1
}

check() {
  local lab="$1"
  echo "== $lab =="
  if ( cd "$LABS/$lab" && ./scripts/verify.sh ); then
    echo "OK: $lab"
  else
    fail "$lab"
  fi
}

check_email_real() {
  echo "== email (cola y login) =="
  if ! ( cd "$LABS/email" && ./scripts/imap.sh alice alice ) | grep -q 'SEARCH'; then
    fail "email: IMAP no autentica"
    return
  fi
  if ! docker compose -f "$LABS/email/docker-compose.yml" exec -T mail mailq \
      | grep -q 'Mail queue is empty'; then
    fail "email: la cola no está vacía"
    return
  fi
  echo "OK: email"
}

check_time_real() {
  echo "== time (sincronización) =="
  if docker compose -f "$LABS/time/docker-compose.yml" exec -T time-client chronyc tracking \
      | grep -q 'Leap status.*Normal'; then
    echo "OK: time"
  else
    fail "time: cliente sin sincronizar"
  fi
}

check_k8s_real() {
  echo "== k8s (endpoints de web) =="
  local eps
  eps="$(kubectl -n k8s-lab get endpointslice     -l kubernetes.io/service-name=web     -o jsonpath='{range .items[*]}{.endpoints[*].addresses[*]}{end}' 2>/dev/null || true)"
  if [ -n "$eps" ]; then
    echo "OK: k8s"
  else
    fail "k8s: el Service web no tiene endpoints"
  fi
}

check_iac_real() {
  echo "== iac (plan sin drift) =="
  if ( cd "$LABS/iac/terraform" && terraform plan -detailed-exitcode -input=false >/dev/null 2>&1 ); then
    echo "OK: iac"
  else
    fail "iac: hay drift o el plan falla"
  fi
}

check email
check identity
check time
check iac
check db

check_email_real
check_time_real
check_iac_real

if kind_ok; then
  check k8s
  check_k8s_real
else
  echo "== k8s =="
  echo "omitido: kind no está presente"
fi

if [ "$failed" -ne 0 ]; then
  echo
  echo "Capstone NO está cerrado: quedan verificaciones en rojo."
  exit 1
fi

echo
echo "Capstone cerrado: los labs verifican en verde."
