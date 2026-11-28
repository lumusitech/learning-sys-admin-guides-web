---
title: "🧩 Escenario: clave SSH rechazada — permisos de .ssh"
level: "Intermedio"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "identity"
  - label: "Herramientas"
    value: "OpenSSH, `ssh -vvv`, `chmod`, `chown`"
  - label: "Archivos"
    value: "`labs/identity/scripts/break.sh`"
  - label: "Ver laboratorio"
    links:
      - id: "labs/identity-access"
        label: "Laboratorio de identidad y acceso"
---

# 🧩 Escenario: clave SSH rechazada — permisos de .ssh

---

## 🎯 Problema

La clave pública está en `~/.ssh/authorized_keys`, pero el servidor rechaza la autenticación por clave y pide contraseña o corta la conexión:

```text
learner@127.0.0.1: Permission denied (publickey,password).
```

El archivo existe y la clave es correcta. El problema son los **permisos** de `~/.ssh` o de `authorized_keys`: `sshd` aplica `StrictModes` y se niega a usar un archivo que cualquiera pueda modificar.

---

## ⚡ Quick command (SRE)

```bash
cd public/labs/identity
./scripts/ssh.sh learner 'id'
```

Si pide contraseña, la clave no se está usando. Fuerza solo clave pública para ver el fallo:

```bash
ssh -i keys/id_ed25519 -p 2222 \
  -o PasswordAuthentication=no -o StrictHostKeyChecking=no \
  learner@127.0.0.1 'id'
```

---

## ✅ Salida esperada

- `Permission denied (publickey,password)`.
- En `ssh -vvv`, líneas como:
  ```text
  debug1: Offering public key: ...
  debug3: receive packet: type 51
  Authentications that can continue: publickey,password
  ```
- En el log de `sshd` (o `docker compose logs identity`):
  ```text
  Authentication refused: bad ownership or modes for file /home/learner/.ssh/authorized_keys
  ```
- `stat -c '%a %U:%G %n' ~/.ssh ~/.ssh/authorized_keys` muestra permisos demasiado abiertos, por ejemplo `666`.

---

## 🧠 Diagnóstico

OpenSSH no confía en claves que un tercero pueda alterar. Con `StrictModes yes` (valor por defecto), comprueba:

- que `~/.ssh` sea del usuario y no tenga escritura para grupo/otros (`700` es lo habitual);
- que `authorized_keys` sea del usuario y no tenga escritura para grupo/otros (`600` es lo habitual);
- que el directorio home no sea escribible por otros.

Si falla, `sshd` ignora la clave y continúa con el siguiente método. Por eso el síntoma es “la clave no funciona”, no un error de clave inválida.

En el laboratorio, `break.sh 01` cambia `authorized_keys` a `666`. La clave sigue siendo válida; solo deja de ser confiable para `sshd`.

---

## 🛠️ Procedimiento (runbook)

### 1. Confirmar el estado

```bash
cd public/labs/identity
./scripts/break.sh 01
./scripts/ssh.sh learner 'id'
```

Con la consola root:

```bash
./scripts/exec.sh
stat -c '%a %U:%G %n' /home/learner/.ssh /home/learner/.ssh/authorized_keys
```

### 2. Corregir propietario y permisos

Dentro del contenedor, como root:

```bash
chown -R learner:learner /home/learner/.ssh
chmod 700 /home/learner/.ssh
chmod 600 /home/learner/.ssh/authorized_keys
```

Si el home también está mal:

```bash
chmod go-w /home/learner
```

### 3. Verificar la autenticación por clave

```bash
exit
./scripts/ssh.sh learner 'id'
```

Debe entrar sin pedir contraseña. Si sigue fallando, revisa el log:

```bash
docker compose logs --tail=50 identity
```

### 4. Revisar el resto de cuentas

```bash
./scripts/ssh.sh admin 'stat -c "%a %U:%G %n" ~/.ssh ~/.ssh/authorized_keys'
```

Aplica la misma corrección si `admin` tiene permisos abiertos.

---

## 🧯 Mitigación

- Restaura permisos desde una plantilla de provisión (Ansible, cloud-init, imagen base).
- Si el usuario no puede entrar, usa la consola del proveedor o un usuario de break-glass.
- Si sospechas manipulación, compara el contenido de `authorized_keys` con el inventario y rota las claves.
- No desactives `StrictModes` para “arreglarlo”: elimina la causa.

---

## ✅ Verificación

- `ssh -i keys/id_ed25519 ... learner@127.0.0.1 'id'` responde sin contraseña.
- `stat` muestra `700` para `.ssh` y `600` para `authorized_keys`.
- `sshd` no registra `bad ownership or modes`.
- `./scripts/reset.sh` devuelve el laboratorio al estado limpio.

---

## 🎓 Prevención

- Provisiona `.ssh` con `700` y `authorized_keys` con `600` desde el primer login.
- Audita permisos con `find /home -name authorized_keys -exec stat ...`.
- No copies claves con `scp` sin revisar el `umask`; usa `install -m 600`.
- Rota claves y elimina las antiguas de `authorized_keys`.
- En servidores críticos, combina clave con MFA o `AuthenticationMethods publickey,password`.

---

## ⚠️ Qué no hacer

- **No pongas `StrictModes no`** en producción para evitar el error.
- **No uses `chmod 777`** en `.ssh` ni en `authorized_keys`.
- **No pegues claves privadas** en `authorized_keys`; solo la pública.
- **No compartas la misma clave** entre personas o servicios.
- **No ignores el log de `sshd`**: dice exactamente qué archivo o directorio tiene malos permisos.

---

## 🔗 Referencias internas

- [Laboratorio de identidad y acceso](/learning-sys-admin-guides-web/labs/identity-access/) — usuarios, claves y reset.
- [Guía de SSH](/learning-sys-admin-guides-web/guides/ssh/) — configuración y diagnóstico.
- [Escenario: claves SSH no autorizadas](/learning-sys-admin-guides-web/scenarios/security/03-unauthorized-ssh-keys/) — qué hacer si aparece una clave desconocida.
