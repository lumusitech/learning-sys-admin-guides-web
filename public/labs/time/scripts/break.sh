#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

case "${1:-}" in
  01)
    echo "Escenario 01: zona horaria incorrecta en el cliente..."
    client_exec sh -c 'ln -sf /usr/share/zoneinfo/UTC /etc/localtime; echo UTC > /etc/timezone'
    client_exec date
    echo "Comprueba: ./scripts/verify.sh (date en UTC frente a la zona esperada)."
    ;;
  02)
    echo "Escenario 02: cliente apuntando a un servidor NTP inexistente..."
    client_exec cp /etc/chrony/client.conf /etc/chrony/client.conf.bak
    client_exec sed -i 's/^server .*/server ntp-offline iburst minpoll 4 maxpoll 4/' /etc/chrony/client.conf
    compose restart time-client >/dev/null
    sleep 3
    client_exec chronyc tracking
    echo "Comprueba: ./scripts/verify.sh (Leap status: Not synchronised)."
    ;;
  03)
    echo "Escenario 03: servidor NTP caído..."
    compose stop ntp-server >/dev/null
    compose restart time-client >/dev/null
    sleep 3
    client_exec chronyc tracking
    echo "Comprueba: ./scripts/verify.sh (fuente inalcanzable)."
    ;;
  04)
    echo "Escenario 04: ACL del servidor NTP bloquea al cliente..."
    compose exec -T ntp-server cp /etc/chrony/server.conf /etc/chrony/server.conf.bak
    compose exec -T ntp-server sed -i 's/^allow .*/allow 127.0.0.1/' /etc/chrony/server.conf
    compose restart ntp-server >/dev/null
    compose restart time-client >/dev/null
    sleep 3
    client_exec chronyc tracking
    echo "Comprueba: ./scripts/verify.sh (cliente sin fuente válida)."
    ;;
  *)
    echo "Uso: $0 <01|02|03|04>" >&2
    exit 1
    ;;
esac
