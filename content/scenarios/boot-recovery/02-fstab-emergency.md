---
title: "🧩 Escenario: /etc/fstab inválido — systemd en emergency mode"
level: "Intermedio"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "boot"
  - label: "Herramientas"
    value: "systemd, `findmnt`, `journalctl`"
  - label: "Archivos"
    value: "`labs/boot/scripts/break.sh`"
  - label: "Ver laboratorio"
    links:
      - id: "labs/boot-recovery"
        label: "Laboratorio de boot recovery"
---

# 🧩 Escenario: /etc/fstab inválido — systemd en emergency mode

---

## 🎯 Problema

La VM arranca, pero systemd se detiene antes del login con un mensaje de **emergency mode**. El culpable es una entrada de `/etc/fstab` que apunta a un UUID inexistente o a un punto de montaje que no se puede preparar. El sistema queda en una shell de emergencia con la raíz montada en modo lectura o parcialmente montada.

---

## ⚡ Quick command (SRE)

```bash
cd public/labs/boot
./scripts/boot.sh --gui
```

En el menú de GRUB elige la entrada normal. Si no hay menú visible, usa `./scripts/console.sh` y mantén la consola conectada durante el arranque.

---

## ✅ Salida esperada

- Mensajes de systemd del tipo:
  ```text
  [FAILED] Failed to mount /mnt/broken.
  [DEPEND] Dependency failed for Local File Systems.
  You are in emergency mode.
  ```
- Un prompt `Give root password for maintenance` o `root@localhost:~#` sin login normal.
- `systemctl is-system-running` responde `emergency`.
- `findmnt --verify` señala la entrada inválida.

---

## 🧠 Diagnóstico

`/etc/fstab` declara montajes que systemd intenta materializar en `local-fs.target`. Una línea con un UUID que no existe hace que la unidad `.mount` falle; si el montaje es requerido, systemd no llega a `multi-user.target` y abre una shell de emergencia.

El orden de diagnóstico es:

1. **¿Qué unidad falló?** `systemctl --failed`.
2. **¿Qué dice el journal?** `journalctl -xb` y busca `Failed to mount`, `dependency`, `fsck`.
3. **¿Qué entrada es?** `cat /etc/fstab` y `findmnt --verify`.
4. **¿El dispositivo existe?** `blkid`, `lsblk -f`.

En el laboratorio, `break.sh 02` añade una línea con `UUID=00000000-...` y punto de montaje `/mnt/broken`. La raíz sigue siendo válida; por eso la shell de emergencia es utilizable.

---

## 🛠️ Procedimiento (runbook)

### 1. Entrar y comprobar el estado

En el prompt de emergencia, inicia sesión con `root` / `labroot` si lo pide. Luego:

```bash
systemctl --failed
journalctl -xb --no-pager | tail -n 80
cat /etc/fstab
findmnt --verify
```

### 2. Remontar la raíz en escritura

La shell de emergencia puede dejar `/` en modo lectura. Para poder editar:

```bash
mount -o remount,rw /
```

Verifica:

```bash
findmnt -n -o OPTIONS /
```

Debe incluir `rw`.

### 3. Corregir `/etc/fstab`

La forma segura es restaurar la copia que dejó el laboratorio:

```bash
cp /root/fstab.bak /etc/fstab
```

Si no tienes copia, elimina o comenta solo la línea inválida. Ejemplo con `sed` (ajusta el UUID exacto que veas):

```bash
sed -i '/00000000-0000-0000-0000-000000000000/d' /etc/fstab
```

Antes de reiniciar, valida la sintaxis y los montajes:

```bash
findmnt --verify
systemctl daemon-reload
```

### 4. Salir del modo emergencia

```bash
systemctl reboot
```

Si el arranque vuelve a emergencia, revisa el journal del intento anterior:

```bash
journalctl -b -1 -p err --no-pager
```

### 5. Verificar el arranque normal

```bash
./scripts/verify.sh
```

Debe responder `running` (o `degraded` sin unidades fallidas) y mostrar la raíz montada.

---

## 🧯 Mitigación

- Si el montaje es opcional, añade `nofail` y un timeout:
  ```text
  UUID=... /mnt/data ext4 defaults,nofail,x-systemd.device-timeout=5s 0 2
  ```
- Si el UUID cambió, actualízalo con `blkid` en lugar de borrar la línea.
- Si el sistema no deja editar `/etc/fstab`, arranca con `init=/bin/bash` y remonta la raíz en escritura; luego corrige el archivo.
- Si el fallo es de `fsck`, revisa el estado del filesystem antes de forzar el montaje.

---

## ✅ Verificación

- `systemctl --failed` no muestra unidades `failed`.
- `findmnt --verify` termina sin errores.
- El login normal aparece y `systemctl is-system-running` responde `running` o `degraded` por servicios no críticos.
- `./scripts/reset.sh 02` restaura el disco limpio para repetir el ejercicio.

---

## 🎓 Prevención

- Valida `/etc/fstab` en staging antes de reiniciar un servidor.
- Usa `nofail` para discos de datos que no son necesarios para arrancar.
- Versiona `/etc/fstab` y documenta los UUID con `blkid`.
- Evita montajes por nombre de dispositivo (`/dev/sdb1`); usa UUID o `PARTUUID`.
- Prueba el arranque en una VM después de cambiar discos o migrar datos.

---

## 🚫 Qué no hacer

- **No ignores el emergency mode** y sigas trabajando: el sistema está incompleto.
- **No desactives `fsck`** para “arreglar” un montaje que falla por corrupción.
- **No borres `/etc/fstab` entero**; perderás la raíz y otros montajes necesarios.
- **No inventes un UUID** para que el montaje “exista”.
- **No reinicies en bucle** sin leer `journalctl -xb`; el mismo error volverá.

---

## 🔗 Referencias internas

- [Laboratorio de boot recovery](/learning-sys-admin-guides-web/labs/boot-recovery/) — comandos y reset.
- [systemd y journalctl](/learning-sys-admin-guides-web/guides/systemd_journalctl/) — lectura de logs de arranque.
- [Layout de disco](/learning-sys-admin-guides-web/reference/disk-layout/) — UUID, particiones y montajes.
- [Proceso de boot de Linux](/learning-sys-admin-guides-web/reference/boot-process/) — dónde encaja `local-fs.target`.
