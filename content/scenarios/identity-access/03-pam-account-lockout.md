---
title: "🧩 Escenario: bloqueo PAM — demasiados intentos fallidos"
level: "Intermedio"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "identity"
  - label: "Herramientas"
    value: "PAM, `faillock`, OpenSSH"
  - label: "Archivos"
    value: "`labs/identity/scripts/break.sh`"
  - label: "Ver laboratorio"
    links:
      - id: "labs/identity-access"
        label: "Laboratorio de identidad y acceso"
---

# 🧩 Escenario: bloqueo PAM — demasiados intentos fallidos

---

## 🎯 Problema

Un usuario intenta entrar con la contraseña correcta y recibe:

```text
The account is locked due to 3 failed logins.
(10 minutes left to unlock)
```

La cuenta no está borrada ni deshabilitada: PAM la bloqueó temporalmente tras varios fallos. El acceso por clave SSH puede seguir funcionando, lo que confunde el diagnóstico.

---

## ⚡ Quick command (SRE)

```bash
cd public/labs/identity
./scripts/break.sh 03
ssh -p 2222 -o PubkeyAuthentication=no \
  -o PreferredAuthentications=password learner@127.0.0.1 'id'
```

Introduce `learner` como contraseña. El bloqueo ya está activo; el comando debe rechazarla.

---

## ✅ Salida esperada

- `pamtester` o SSH por contraseña devuelve:
  ```text
  Authentication failure
  The account is locked due to 3 failed logins.
  (10 minutes left to unlock)
  ```
- Como root, `faillock --user learner` muestra tres registros `SVC login` con `Valid = V`.
- La clave SSH sigue entrando porque `faillock` actúa en la fase de autenticación por contraseña de PAM; la autenticación `publickey` no pasa por ese mismo flujo.

---

## 🧠 Diagnóstico

PAM aplica una pila de módulos a cada servicio (`sshd`, `login`, `sudo`, etc.). `pam_faillock` cuenta fallos por usuario y, al superar `deny`, bloquea durante `unlock_time`.

Configuración típica en Debian:

```text
# /etc/security/faillock.conf
deny = 3
unlock_time = 600
fail_interval = 900
```

El estado se guarda en `/var/run/faillock/` (o `tally` según la implementación). El comando `faillock` consulta y resetea ese estado.

Importante: **una clave SSH válida no necesariamente queda bloqueada**, porque el bloqueo se aplica al método de contraseña. Si el objetivo es bloquear toda autenticación, necesitas otra política (MFA, `AuthenticationMethods`, deshabilitar claves, etc.).

En el laboratorio, `break.sh 03` ejecuta tres autenticaciones fallidas con `pamtester` contra el servicio `login`, dejando la cuenta bloqueada.

---

## 🛠️ Procedimiento (runbook)

### 1. Confirmar el bloqueo

```bash
cd public/labs/identity
./scripts/break.sh 03
./scripts/exec.sh
faillock --user learner
```

Debes ver tres registros y la columna `Valid` en `V`.

### 2. Comparar métodos de acceso

Desde el host:

```bash
./scripts/ssh.sh learner 'id'
```

Si entra con clave, el bloqueo es solo de contraseña. Prueba contraseña explícitamente:

```bash
ssh -p 2222 -o PubkeyAuthentication=no \
  -o PreferredAuthentications=password learner@127.0.0.1 'id'
```

### 3. Desbloquear

Como root en la consola:

```bash
faillock --user learner --reset
faillock --user learner
```

La segunda orden debe mostrar la cuenta sin registros `V`.

### 4. Verificar

```bash
exit
ssh -p 2222 -o PubkeyAuthentication=no \
  -o PreferredAuthentications=password learner@127.0.0.1 'id'
```

Con la contraseña `learner` debe entrar.

### 5. Revisar la política

```bash
./scripts/exec.sh
grep -R 'faillock\|deny\|unlock_time' /etc/pam.d /etc/security/faillock.conf
```

Ajusta `deny` y `unlock_time` según el riesgo y el soporte.

---

## 🧯 Mitigación

- Desbloquea con `faillock --user <usuario> --reset` si el usuario es legítimo.
- Si el bloqueo es masivo, revisa si hay un ataque de fuerza bruta y bloquea la IP en el firewall.
- Si el usuario olvidó la contraseña, restablécela por un canal seguro; no desactives PAM.
- Si el bloqueo afecta a una cuenta de servicio, usa claves o un mecanismo de autenticación sin contraseña.
- Si `faillock` no está disponible, revisa la implementación (`pam_tally2`) y usa su comando correspondiente.

---

## ✅ Verificación

- `faillock --user learner` no muestra registros válidos.
- El login por contraseña funciona con `learner`.
- El login por clave sigue funcionando.
- `./scripts/reset.sh` restaura el contenedor.

---

## 🎓 Prevención

- Configura `deny` y `unlock_time` según la política de la organización.
- Monitoriza `faillock` y los fallos de autenticación; un pico puede ser un ataque.
- Combina contraseña con MFA para cuentas privilegiadas.
- Documenta el procedimiento de desbloqueo y quién puede ejecutarlo.
- No compartas cuentas; un bloqueo por fuerza bruta afecta a todos.
- Revisa que las cuentas de servicio no usen contraseña interactiva.

---

## ⚠️ Qué no hacer

- **No borres `/var/run/faillock` a mano** si puedes usar `faillock --reset`.
- **No desactives `pam_faillock`** para “arreglar” un bloqueo puntual.
- **No asumas que el bloqueo cubre las claves SSH**; comprueba el método.
- **No bloquees cuentas compartidas** sin un plan de comunicación.
- **No ignore un bloqueo masivo**: puede ser un ataque en curso.

---

## 🔗 Referencias internas

- [Laboratorio de identidad y acceso](/learning-sys-admin-guides-web/labs/identity-access/) — `pamtester`, `faillock` y reset.
- [Guía de SSH](/learning-sys-admin-guides-web/guides/ssh/) — métodos de autenticación.
- [Escenario: fuerza bruta SSH](/learning-sys-admin-guides-web/scenarios/networking/01-detect-ssh-brute-force/) — detección y respuesta.
