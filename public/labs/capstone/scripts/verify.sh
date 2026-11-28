#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

failed=0

check() {
  local lab="$1"
  echo "== $lab =="
  if ( cd "$LABS/$lab" && ./scripts/verify.sh ); then
    echo "OK: $lab"
  else
    echo "FALLO: $lab"
    failed=1
  fi
}

check email
check identity
check time
check iac
check db

if kind_ok; then
  check k8s
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
