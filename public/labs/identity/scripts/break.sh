#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

case "${1:-}" in
  01)
    echo "Escenario 01: permisos débiles en authorized_keys..."
    exec_root 'chmod 666 /home/learner/.ssh/authorized_keys'
    echo "Prueba: ./scripts/ssh.sh learner 'id' (debe fallar)."
    ;;
  02)
    echo "Escenario 02: línea inválida en /etc/sudoers.d..."
    exec_root 'printf "admin ALL=(ALL\n" > /etc/sudoers.d/90-lab; chmod 440 /etc/sudoers.d/90-lab'
    echo "Prueba: ./scripts/ssh.sh admin 'sudo -n true' (debe fallar por sintaxis)."
    ;;
  03)
    echo "Escenario 03: tres intentos fallidos y bloqueo PAM..."
    exec_root '
      faillock --user learner --reset >/dev/null 2>&1 || true
      for _ in 1 2 3; do
        echo wrong | pamtester login learner authenticate >/dev/null 2>&1 || true
      done
      faillock --user learner
    '
    echo "Prueba: ./scripts/ssh.sh learner 'id' (debe rechazar la cuenta bloqueada)."
    ;;
  04)
    echo "Escenario 04: cuenta expirada..."
    exec_root 'chage -E 0 learner; chage -l learner'
    echo "Prueba: ./scripts/ssh.sh learner 'id' (debe rechazar la cuenta expirada)."
    ;;
  05)
    echo "Escenario 05: binario SUID plantado..."
    exec_root 'cp /bin/bash /usr/local/bin/suid-bash; chmod 4755 /usr/local/bin/suid-bash; ls -l /usr/local/bin/suid-bash'
    echo "Prueba: auditoría con find / -perm -4000."
    ;;
  *)
    echo "Uso: $0 <01|02|03|04|05>" >&2
    exit 1
    ;;
esac
