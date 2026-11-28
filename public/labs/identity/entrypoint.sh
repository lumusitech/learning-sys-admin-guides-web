#!/usr/bin/env bash
set -euo pipefail

mkdir -p /run/sshd

create_user() {
  local user="$1" password="$2" shell="${3:-/bin/bash}"
  if ! id "$user" >/dev/null 2>&1; then
    useradd -m -s "$shell" "$user"
  fi
  echo "$user:$password" | chpasswd
}

create_user learner learner
create_user admin admin

# admin puede administrar; learner es una cuenta normal.
usermod -aG sudo admin
echo 'admin ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/90-lab
chmod 440 /etc/sudoers.d/90-lab

# Cuenta de servicio sin shell interactiva.
if ! id svc-deploy >/dev/null 2>&1; then
  useradd -r -m -s /usr/sbin/nologin svc-deploy
fi

# Clave pública del laboratorio para learner y admin.
for user in learner admin; do
  install -d -m 700 -o "$user" -g "$user" "/home/$user/.ssh"
  if [ -f /lab-keys/id_ed25519.pub ]; then
    install -m 600 -o "$user" -g "$user" \
      /lab-keys/id_ed25519.pub "/home/$user/.ssh/authorized_keys"
  fi
done

# faillock: 3 intentos fallidos y bloqueo temporal de 10 minutos.
cat > /etc/security/faillock.conf <<'EOF'
deny = 3
unlock_time = 600
fail_interval = 900
EOF

# Debian 12 no trae perfil pam-auth-update para faillock; se configura
# explícitamente. success=2 salta authfail y pam_deny cuando pam_unix acierta.
cat > /etc/pam.d/common-auth <<'PAMEOF'
auth    required        pam_faillock.so preauth
auth    [success=2 default=ignore] pam_unix.so nullok
auth    [default=die]   pam_faillock.so authfail
auth    requisite       pam_deny.so
auth    required        pam_permit.so
PAMEOF

exec /usr/sbin/sshd -D -e
