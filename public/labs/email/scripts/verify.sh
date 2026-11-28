#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

echo "== Contenedor =="
compose ps
echo
echo "== Postfix =="
compose exec -T mail postfix status || true
echo
echo "== Dovecot auth =="
compose exec -T mail doveadm auth test alice alice || true
echo
echo "== Cola =="
compose exec -T mail mailq || true
echo
echo "== IMAP =="
imap_list alice alice | head -20 || true
