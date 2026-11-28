#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

case "${1:-}" in
  01)
    echo "Escenario 01: dominio local fuera de mydestination + relay muerto..."
    compose exec -T mail bash -lc "
      postconf -e 'mydestination = localhost'
      postconf -e 'relayhost = [127.0.0.1]:2526'
      postfix reload
    "
    echo "Prueba: ./scripts/send.sh alice@lab.local 'Cola' 'Hola'; luego revisa mailq."
    ;;
  02)
    echo "Escenario 02: credencial de alice eliminada de Dovecot..."
    compose exec -T mail bash -lc "sed -i '/^alice:/d' /etc/dovecot/users; doveadm reload"
    echo "Prueba: ./scripts/imap.sh alice alice (debe fallar la autenticación)."
    ;;
  03)
    echo "Escenario 03: Maildir de alice con propietario incorrecto..."
    compose exec -T mail bash -lc "chown -R root:root /home/alice/Maildir"
    echo "Prueba: ./scripts/send.sh alice@lab.local 'Permisos' 'Hola'; luego revisa mailq."
    ;;
  04)
    echo "Escenario 04: mynetworks restringido a localhost..."
    compose exec -T mail bash -lc "
      postconf -e 'mynetworks = 127.0.0.1/32'
      postfix reload
    "
    echo "Prueba: ./scripts/send.sh destino@example.com 'Relay' 'Hola' (debe dar Relay access denied)."
    ;;
  *)
    echo "Uso: $0 <01|02|03|04>" >&2
    exit 1
    ;;
esac
