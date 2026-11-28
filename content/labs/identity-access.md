---
title: "🧪 Laboratorio de identidad y acceso — SSH, sudo y PAM"
section: "labs"
meta:
  - label: "Requisitos"
    value: "Docker, `ssh`, `ssh-keygen`"
  - label: "Herramientas"
    value: "OpenSSH, sudo, PAM, `chage`, `faillock`"
  - label: "Escenarios relacionados"
    links:
      - id: "scenarios/identity-access/01-ssh-key-rejected"
        label: "Identidad/01 Clave SSH rechazada"
      - id: "scenarios/identity-access/02-sudoers-broken"
        label: "Identidad/02 sudoers roto"
      - id: "scenarios/identity-access/03-pam-account-lockout"
        label: "Identidad/03 Bloqueo PAM"
      - id: "scenarios/identity-access/04-expired-account"
        label: "Identidad/04 Cuenta expirada"
      - id: "scenarios/identity-access/05-suid-audit"
        label: "Identidad/05 Auditoría SUID"
---

# 🧪 Laboratorio de identidad y acceso — SSH, sudo y PAM

---

## 🎯 Cuándo usar esta sección

Para practicar los controles que deciden **quién entra y qué puede hacer** en un servidor Linux: claves SSH, permisos de `.ssh`, reglas de `sudo`, bloqueo de cuentas por PAM, expiración de cuentas y binarios con privilegios especiales.

El laboratorio levanta un contenedor Debian 12 con `sshd`, `sudo` y PAM. Es rápido de reiniciar y no necesita una VM completa; los fallos son de configuración, no del kernel.

---

## 🔄 Flujo recomendado

1. **Preparar** el contenedor con `./scripts/setup.sh`.
2. **Romper** el incidente con `./scripts/break.sh <id>`.
3. **Diagnosticar** por SSH o con la consola root.
4. **Reparar** siguiendo el escenario.
5. **Resetear** con `./scripts/reset.sh` antes del siguiente.

---

## 📋 Requisitos

- Docker con Compose.
- `ssh` y `ssh-keygen` en el host.
- Puerto `2222` libre.
- Unos 150 MB de imagen; el build inicial tarda menos de un minuto.

```bash
docker --version
docker compose version
ssh -V
```

---

## 🔐 Usuarios del laboratorio

| Usuario | Contraseña | Acceso | Uso |
|---|---|---|---|
| `learner` | `learner` | SSH con clave o contraseña | Cuenta normal, sin sudo |
| `admin` | `admin` | SSH con clave o contraseña | Sudo sin contraseña para reparar |
| `svc-deploy` | — | Sin shell | Cuenta de servicio |
| `root` | — | Solo consola del contenedor | Recuperación con `./scripts/exec.sh` |

La clave pública del host se copia a `learner` y `admin`; la privada se genera en `keys/` y está ignorada por git.

---

## 🧩 Incidentes disponibles

| # | Escenario | Síntoma | Guía |
|---|---|---|---|
| 01 | Clave SSH rechazada | `Permission denied (publickey,password)` | [Identidad/01](/learning-sys-admin-guides-web/scenarios/identity-access/01-ssh-key-rejected/) |
| 02 | `sudoers` roto | `sudo: syntax error` y el usuario pierde sudo | [Identidad/02](/learning-sys-admin-guides-web/scenarios/identity-access/02-sudoers-broken/) |
| 03 | Bloqueo PAM | `The account is locked due to 3 failed logins` | [Identidad/03](/learning-sys-admin-guides-web/scenarios/identity-access/03-pam-account-lockout/) |
| 04 | Cuenta expirada | `Your account has expired` | [Identidad/04](/learning-sys-admin-guides-web/scenarios/identity-access/04-expired-account/) |
| 05 | SUID plantado | Binario con bit SUID fuera de lo esperado | [Identidad/05](/learning-sys-admin-guides-web/scenarios/identity-access/05-suid-audit/) |

---

## 🛠️ Preparación

```bash
cd public/labs/identity
./scripts/setup.sh
```

El setup:

1. genera una clave Ed25519 en `keys/` si no existe;
2. construye la imagen Debian con `openssh-server`, `sudo`, PAM y `pamtester`;
3. crea `learner` y `admin`, la regla de sudo y la cuenta `svc-deploy`;
4. activa `pam_faillock` con `deny=3` y `unlock_time=600`;
5. arranca `sshd` en el puerto `2222` y valida el acceso.

---

## 🧪 Comandos de laboratorio

```bash
# Shell remota como learner
./scripts/ssh.sh learner 'id'

# Shell remota como admin (sudo sin contraseña)
./scripts/ssh.sh admin 'sudo -n true && echo OK'

# Sesión interactiva
./scripts/ssh.sh admin

# Consola root dentro del contenedor
./scripts/exec.sh

# Estado del laboratorio
./scripts/verify.sh

# Romper un incidente
./scripts/break.sh 01

# Restaurar el contenedor desde cero
./scripts/reset.sh
```

`reset.sh` elimina el contenedor y lo recrea; el estado de los escenarios no persiste.

---

## ⚠️ Notas

- Es un laboratorio local: no expongas el puerto `2222` a Internet.
- `admin` tiene sudo sin contraseña **a propósito** para poder reparar; en producción no lo harías sin una razón.
- El bloqueo PAM de `faillock` aplica a la autenticación por contraseña. La clave SSH puede seguir entrando: es una lección importante sobre el modelo de autenticación.
- El contenedor corre como root y no está endurecido; su objetivo es practicar identidad y acceso, no aislar cargas hostiles.
- `keys/` está en `.gitignore`; no versiones la clave privada.

---

## 🔗 Referencias internas

- [Guía de SSH](/learning-sys-admin-guides-web/guides/ssh/) — claves, config y diagnóstico.
- [Escenario: claves SSH no autorizadas](/learning-sys-admin-guides-web/scenarios/security/03-unauthorized-ssh-keys/) — auditoría de accesos.
- [Escenario: auditoría SUID](/learning-sys-admin-guides-web/scenarios/security/02-suid-audit-and-file-permissions/) — permisos especiales.
- [Escenario: intento de escalada](/learning-sys-admin-guides-web/scenarios/security/07-privilege-escalation-attempt/) — señales y respuesta.
