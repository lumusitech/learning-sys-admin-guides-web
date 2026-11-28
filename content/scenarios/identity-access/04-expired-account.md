---
title: "🧩 Escenario: cuenta expirada — chage y acceso bloqueado"
level: "Intermedio"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "identity"
  - label: "Herramientas"
    value: "`chage`, `usermod`, `passwd`, OpenSSH"
  - label: "Archivos"
    value: "`labs/identity/scripts/break.sh`"
  - label: "Ver laboratorio"
    links:
      - id: "labs/identity-access"
        label: "Laboratorio de identidad y acceso"
---

# 🧩 Escenario: cuenta expirada — chage y acceso bloqueado

---

## 🎯 Problema

La clave SSH es correcta y la cuenta existe, pero el servidor cierra la conexión:

```text
Your account has expired; please contact your system administrator.
Connection closed by 127.0.0.1 port 2222
```

La cuenta tiene una fecha de expiración pasada. No es un problema de contraseña ni de permisos de `.ssh`: PAM rechaza la cuenta en la fase `account`.

---

## ⚡ Quick command (SRE)

```bash
cd public/labs/identity
./scripts/break.sh 04
./scripts/ssh.sh learner 'id'
```

---

## ✅ Salida esperada

- SSH rechaza la conexión con `Your account has expired`.
- `chage -l learner` muestra:
  ```text
  Account expires : Jan 01, 1970
  ```
- El usuario sigue en `/etc/passwd` y la clave sigue en `authorized_keys`; el bloqueo es de política de cuenta.

---

## 🧠 Diagnóstico

Linux separa dos conceptos:

- **expiración de la contraseña** (`chage -M`, `chage -W`): obliga a cambiarla o bloquea el login por contraseña;
- **expiración de la cuenta** (`chage -E`): inhabilita la cuenta completa, incluso con clave SSH.

En el laboratorio, `break.sh 04` ejecuta `chage -E 0 learner`. La fecha `0` se interpreta como el epoch (`1970-01-01`), es decir, la cuenta ya expiró. PAM (`pam_unix` en `account`) devuelve `account expired` y `sshd` cierra la sesión.

Comandos de diagnóstico:

```bash
getent passwd learner
chage -l learner
passwd -S learner
```

`passwd -S` puede mostrar `L` (locked) o `P` (password set), pero la expiración de cuenta se ve mejor con `chage -l`.

---

## 🛠️ Procedimiento (runbook)

### 1. Confirmar el estado

```bash
cd public/labs/identity
./scripts/break.sh 04
./scripts/exec.sh
chage -l learner
```

### 2. Reactivar la cuenta

Como root:

```bash
chage -E -1 learner
```

`-1` significa “sin expiración”. Alternativa:

```bash
usermod -e '' learner
```

### 3. Verificar

```bash
chage -l learner
```

`Account expires` debe mostrar `never`.

```bash
exit
./scripts/ssh.sh learner 'id'
```

### 4. Revisar la política de expiración

```bash
./scripts/exec.sh
grep -E '^PASS_(MAX_DAYS|MIN_DAYS|WARN_AGE)' /etc/login.defs
```

Si la organización exige rotación, documenta la fecha y el proceso de renovación.

---

## 🧯 Mitigación

- Reactiva la cuenta solo tras validar la identidad del usuario y la autorización.
- Si la cuenta es de servicio, usa una cuenta sin expiración interactiva y claves rotadas.
- Si la expiración fue un error de aprovisionamiento, corrige la fuente (IdP, Ansible, script).
- Si la cuenta debe permanecer expirada, elimina también las claves y los accesos residuales.
- Revisa otros servicios que usen la misma cuenta (cron, systemd, bases de datos).

---

## ✅ Verificación

- `chage -l learner` muestra `Account expires: never`.
- El login por clave funciona.
- El login por contraseña funciona con `learner`.
- `./scripts/reset.sh` restaura el laboratorio.

---

## 🎓 Prevención

- Define una política de ciclo de vida: cuentas humanas, de servicio y de emergencia.
- Monitoriza cuentas que expiran pronto (`chage -l` en inventario).
- Integra la rotación con el proveedor de identidad (LDAP, OIDC, AD).
- Documenta qué cuentas pueden expirar y cuáles no.
- Prueba la expiración en staging antes de aplicarla masivamente.
- Elimina cuentas inactivas en lugar de dejarlas expiradas para siempre.

---

## ⚠️ Qué no hacer

- **No confundas contraseña expirada con cuenta expirada**: revisa `chage -l`.
- **No pongas `-E -1` a todas las cuentas** sin política.
- **No reactives una cuenta comprometida** sin investigar.
- **No olvides las claves SSH** al deshabilitar una cuenta.
- **No dependas de una sola cuenta de servicio** sin plan de rotación.

---

## 🔗 Referencias internas

- [Laboratorio de identidad y acceso](/learning-sys-admin-guides-web/labs/identity-access/) — usuarios y reset.
- [Guía de SSH](/learning-sys-admin-guides-web/guides/ssh/) — autenticación y diagnóstico.
- [Escenario: bloqueo PAM](/learning-sys-admin-guides-web/scenarios/identity-access/03-pam-account-lockout/) — otro bloqueo de autenticación.
