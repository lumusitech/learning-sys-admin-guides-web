---
title: "🧩 Escenario: sudoers roto — nadie puede usar sudo"
level: "Avanzado"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "identity"
  - label: "Herramientas"
    value: "`sudo`, `visudo`, consola root"
  - label: "Archivos"
    value: "`labs/identity/scripts/break.sh`"
  - label: "Ver laboratorio"
    links:
      - id: "labs/identity-access"
        label: "Laboratorio de identidad y acceso"
---

# 🧩 Escenario: sudoers roto — nadie puede usar sudo

---

## 🎯 Problema

Después de añadir una regla a `/etc/sudoers.d/`, cualquier intento de `sudo` falla:

```text
/etc/sudoers.d/90-lab:1:15: syntax error
admin ALL=(ALL
              ^
sudo: a password is required
```

El usuario `admin` pertenece al grupo `sudo`, pero la regla que le daba `NOPASSWD` quedó corrupta. El sistema sigue siendo accesible por SSH con clave; lo que se perdió es la capacidad de elevar privilegios.

---

## ⚡ Quick command (SRE)

```bash
cd public/labs/identity
./scripts/ssh.sh admin 'sudo -n true'
```

---

## ✅ Salida esperada

- `sudo` imprime `syntax error` y el nombre del archivo.
- `sudo -n true` termina con `sudo: a password is required` o `sudo: no valid sudoers sources`.
- `visudo -c` reporta el archivo y la línea:
  ```text
  /etc/sudoers.d/90-lab:1:15: syntax error
  ```
- La sesión SSH como `admin` sigue funcionando; el fallo es solo de autorización.

---

## 🧠 Diagnóstico

`sudo` lee `/etc/sudoers` y todos los archivos de `/etc/sudoers.d/` en orden. Un error de sintaxis en **cualquiera** de ellos puede invalidar la política y dejar a los usuarios sin sus reglas. Los síntomas dependen de la versión:

- aborta la lectura y no aplica ninguna regla;
- ignora el archivo roto y sigue con los demás;
- pide contraseña porque la regla `NOPASSWD` ya no se aplica.

Lo importante es no editar estos archivos con un editor normal ni con `echo >` sin validar. `visudo` bloquea el archivo, comprueba la sintaxis y evita dejar el sistema sin sudo.

En el laboratorio, `break.sh 02` reemplaza `/etc/sudoers.d/90-lab` por una línea incompleta. `admin` conserva el acceso SSH, pero pierde el `NOPASSWD`.

---

## 🛠️ Procedimiento (runbook)

### 1. Confirmar el fallo

```bash
cd public/labs/identity
./scripts/break.sh 02
./scripts/ssh.sh admin 'sudo -n true'
```

### 2. Entrar por la consola root

```bash
./scripts/exec.sh
visudo -c
```

`visudo -c` lista los archivos y marca el error. No intentes reparar con `sudo` desde `admin`: no tienes sudo.

### 3. Restaurar la regla

Como root, sobrescribe el archivo con una regla válida:

```bash
printf 'admin ALL=(ALL) NOPASSWD:ALL\n' > /etc/sudoers.d/90-lab
chmod 440 /etc/sudoers.d/90-lab
visudo -c
```

Si el archivo roto era otro, elimínalo o corrígelo:

```bash
rm /etc/sudoers.d/99-broken
visudo -c
```

### 4. Verificar desde `admin`

```bash
exit
./scripts/ssh.sh admin 'sudo -n true && echo SUDO_OK'
```

Debe imprimir `SUDO_OK` sin pedir contraseña.

### 5. Revisar el resto de reglas

```bash
./scripts/ssh.sh admin 'sudo -l'
./scripts/ssh.sh admin 'sudo visudo -c'
```

---

## 🧯 Mitigación

- Mantén una sesión root abierta antes de editar `sudoers`.
- Usa `visudo -f /etc/sudoers.d/<archivo>` para editar con validación.
- Si no tienes consola root, arranca en modo rescate o usa el usuario de break-glass del proveedor.
- Restaura `/etc/sudoers` y `/etc/sudoers.d/` desde una copia o imagen dorada.
- No reinicies el servidor esperando que “se arregle”: el archivo seguirá roto.

---

## ✅ Verificación

- `visudo -c` termina con `parsed OK`.
- `sudo -n true` como `admin` devuelve 0.
- `sudo -l` muestra la regla esperada.
- `./scripts/reset.sh` restaura el contenedor.

---

## 🎓 Prevención

- Edita siempre con `visudo` o `visudo -f`.
- Valida en CI/staging con `visudo -c` antes de desplegar.
- Versiona `/etc/sudoers.d/` y revisa los cambios en code review.
- Usa nombres de archivo claros y sin puntos conflictivos (`90-lab`, no `90.lab.bak`).
- Limita `NOPASSWD` a comandos concretos; evita `ALL` salvo en cuentas de laboratorio.
- Prueba el acceso con un usuario no root después de cada cambio.

---

## ⚠️ Qué no hacer

- **No edites `/etc/sudoers` con `vim` directamente**; un error puede dejarte sin sudo.
- **No hagas `chmod 777`** sobre archivos de sudoers.
- **No añadas reglas desde scripts sin `visudo -c`.**
- **No uses `NOPASSWD: ALL`** para cuentas humanas en producción.
- **No borres todo `/etc/sudoers.d/`** para “limpiar”; perderás reglas legítimas.

---

## 🔗 Referencias internas

- [Laboratorio de identidad y acceso](/learning-sys-admin-guides-web/labs/identity-access/) — `admin`, consola root y reset.
- [Guía de SSH](/learning-sys-admin-guides-web/guides/ssh/) — acceso de recuperación.
- [Escenario: intento de escalada](/learning-sys-admin-guides-web/scenarios/security/07-privilege-escalation-attempt/) — señales de abuso de sudo.
