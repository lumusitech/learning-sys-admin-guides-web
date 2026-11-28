#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

echo "== Contenedor =="
compose ps
echo
echo "== Usuario learner =="
ssh_run learner 'id; getent passwd learner'
echo
echo "== Admin y sudo =="
ssh_run admin 'id; sudo -n true && echo ADMIN_SUDO_OK'
echo
echo "== Clave autorizada =="
ssh_run learner 'stat -c "%a %U:%G %n" ~/.ssh ~/.ssh/authorized_keys'
