---
title: "🧩 Escenario: contraseña de root perdida — recuperar acceso desde GRUB"
level: "Intermedio"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "boot"
  - label: "Herramientas"
    value: "GRUB, `passwd`, consola"
  - label: "Archivos"
    value: "`labs/boot/scripts/break.sh`"
  - label: "Ver laboratorio"
    links:
      - id: "labs/boot-recovery"
        label: "Laboratorio de boot recovery"
---

# 🧩 Escenario: contraseña de root perdida — recuperar acceso desde GRUB

---

## 🎯 Problema

Nadie recuerda la contraseña de `root` y no hay otro usuario con `sudo`. La VM arranca bien, pero el login por consola rechaza las credenciales. Sin acceso físico o virtual a la consola, el sistema queda inutilizable. La recuperación clásica es arrancar con `init=/bin/bash`, cambiar la contraseña y volver al arranque normal.

---

## ⚡ Quick command (SRE)

```bash
cd public/labs/boot
./scripts/boot.sh --gui
```

En el menú de GRUB, selecciona la entrada de Debian y pulsa `e`.

---

## ✅ Salida esperada

- El login normal rechaza `root` con `Login incorrect`.
- El menú de GRUB permite editar la entrada (no está protegido con contraseña).
- Al arrancar con `init=/bin/bash`, aparece una shell de root sin pedir contraseña.
- Tras `passwd root` y `reboot`, el login acepta la nueva contraseña.

---

## 🧠 Diagnóstico

La contraseña de root se guarda en `/etc/shadow`. Si no tienes otra cuenta con privilegios, no puedes cambiarla desde el sistema en ejecución. La vía de recuperación es modificar el arranque para que el kernel ejecute una shell como `init`, sin pasar por systemd ni por el login.

Requisitos:

- acceso a la consola de la VM (física, IPMI, hypervisor o QEMU);
- GRUB editable (sin contraseña de arranque);
- posibilidad de remontar la raíz en escritura.

En el laboratorio, `break.sh 04` cambia la contraseña de `root` por un valor aleatorio y apaga la VM. La cuenta sigue existiendo; solo se desconoce la contraseña.

---

## 🛠️ Procedimiento (runbook)

### 1. Confirmar el escenario

```bash
cd public/labs/boot
./scripts/break.sh 04
./scripts/boot.sh --gui
```

Intenta entrar con `root` / `labroot`: debe fallar.

### 2. Arrancar con `init=/bin/bash`

En el menú de GRUB:

1. Selecciona la entrada de Debian.
2. Pulsa `e`.
3. En la línea `linux`, añade al final:
   ```text
   init=/bin/bash
   ```
   Si la línea termina en `ro`, puedes cambiarlo a `rw` para montar la raíz en escritura desde el principio:
   ```text
   linux /boot/vmlinuz-6.1.0-56-amd64 root=/dev/vda1 rw init=/bin/bash
   ```
4. Pulsa `Ctrl-X` o `F10`.

### 3. Cambiar la contraseña

Aparece una shell de root sin login. Remonta la raíz en escritura si hace falta:

```bash
mount -o remount,rw /
```

Cambia la contraseña:

```bash
passwd root
```

Escribe la nueva contraseña dos veces. Para el laboratorio puedes volver a `labroot`:

```text
New password: labroot
Retype new password: labroot
```

Sincroniza y vuelve al arranque normal:

```bash
sync
exec /sbin/init
```

También puedes reiniciar con `reboot -f`; `exec /sbin/init` evita un apagado brusco.

### 4. Verificar el acceso

Cuando aparezca el login:

```text
localhost login: root
Password: labroot
```

Debe entrar sin errores. Luego:

```bash
whoami
```

### 5. Comprobar el estado del sistema

```bash
./scripts/verify.sh
```

---

## 🧯 Mitigación

- Si `init=/bin/bash` no arranca, prueba `rd.break` o `single` según la distribución.
- Si la raíz está cifrada, necesitarás la passphrase de LUKS antes de llegar a la shell.
- Si GRUB está protegido, usa la consola del hipervisor o un medio de rescate.
- Si `/etc/shadow` está corrupto, restaura desde una copia o desde un snapshot.

---

## ✅ Verificación

- El login de `root` acepta la nueva contraseña.
- `passwd -S root` muestra `P` (password set).
- `systemctl is-system-running` responde `running` o `degraded` sin fallos críticos.
- `./scripts/reset.sh 04` restaura el laboratorio.

---

## 🎓 Prevención

- Usa un gestor de secretos para la contraseña de `root` y las cuentas de emergencia.
- Crea una cuenta administrativa con `sudo` y claves SSH; no dependas solo de `root`.
- Documenta el procedimiento de break-glass y quién puede ejecutarlo.
- En producción, protege GRUB con contraseña y restringe el acceso a la consola.
- Rota las credenciales después de una recuperación.

---

## 🚫 Qué no hacer

- **No dejes `init=/bin/bash`** en la configuración permanente; es una puerta abierta.
- **No edites `/etc/shadow` a mano** si puedes usar `passwd`.
- **No compartas la nueva contraseña** por chat o tickets.
- **No asumas que el acceso físico es seguro**: cualquiera con consola y GRUB editable puede repetir este procedimiento.
- **No olvides sincronizar** (`sync`) antes de reiniciar; puedes perder el cambio.

---

## 🔗 Referencias internas

- [Laboratorio de boot recovery](/learning-sys-admin-guides-web/labs/boot-recovery/) — VM, consola y reset.
- [Proceso de boot de Linux](/learning-sys-admin-guides-web/reference/boot-process/) — de GRUB a systemd.
- [systemd y journalctl](/learning-sys-admin-guides-web/guides/systemd_journalctl/) — diagnóstico posterior al arranque.
- [Escenario: fstab y emergency mode](/learning-sys-admin-guides-web/scenarios/boot-recovery/02-fstab-emergency/) — otra entrada a la shell de emergencia.
