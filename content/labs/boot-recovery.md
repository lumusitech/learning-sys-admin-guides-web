---
title: "🧪 Laboratorio de boot recovery — Debian en QEMU"
section: "labs"
meta:
  - label: "Requisitos"
    value: "`qemu-system-x86_64`, `expect`, `nc`, `curl`"
  - label: "Herramientas"
    value: "QEMU, consola serie, GRUB, systemd"
  - label: "Escenarios relacionados"
    links:
      - id: "scenarios/boot-recovery/01-grub-rescue"
        label: "Boot/01 GRUB rescue"
      - id: "scenarios/boot-recovery/02-fstab-emergency"
        label: "Boot/02 fstab y emergency mode"
      - id: "scenarios/boot-recovery/03-bad-root-parameter"
        label: "Boot/03 root= inválido"
      - id: "scenarios/boot-recovery/04-root-password"
        label: "Boot/04 contraseña de root"
---

# 🧪 Laboratorio de boot recovery — Debian en QEMU

---

## 🎯 Cuándo usar esta sección

Para practicar fallos de arranque en una VM Debian real, sin tocar el host ni un servidor de producción. El laboratorio descarga una imagen cloud de Debian 12, la provisiona una vez y crea un disco desechable por escenario. Puedes romper GRUB, `/etc/fstab`, los parámetros del kernel o la contraseña de root, y recuperar la VM desde la consola gráfica o serie.

Cada incidente tiene su escenario con runbook; el laboratorio aporta la VM, la consola y el reset.

---

## 🔄 Flujo recomendado

1. **Preparar** la imagen dorada y arrancar la VM con `./scripts/setup.sh`.
2. **Romper** el incidente elegido con `./scripts/break.sh <id>`.
3. **Arrancar** la VM rota con `./scripts/boot.sh --gui` (GRUB) o `./scripts/console.sh` (serie).
4. **Diagnosticar** y **reparar** siguiendo el escenario.
5. **Resetear** el disco con `./scripts/reset.sh <id>` antes del siguiente.

---

## 📋 Requisitos

- QEMU (`qemu-system-x86_64` y `qemu-img`), `expect` y `nc`.
- Unos 1,5 GB de disco para la imagen base y las capas qcow2.
- En macOS ARM la VM x86_64 corre con TCG: arranca en decenas de segundos, no en milisegundos.
- Para los escenarios de GRUB conviene una sesión gráfica (`--gui`); en un host sin display usa la consola serie y reinicia con la consola conectada.

```bash
qemu-system-x86_64 --version
qemu-img --version
expect -v
nc -h 2>&1 | head -1
```

---

## 🧩 Incidentes disponibles

| # | Escenario | Síntoma | Guía |
|---|---|---|---|
| 01 | GRUB roto | El arranque se queda en `grub rescue>` | [Boot/01](/learning-sys-admin-guides-web/scenarios/boot-recovery/01-grub-rescue/) |
| 02 | fstab inválido | systemd entra en `emergency mode` | [Boot/02](/learning-sys-admin-guides-web/scenarios/boot-recovery/02-fstab-emergency/) |
| 03 | `root=` inválido | Kernel panic al montar la raíz | [Boot/03](/learning-sys-admin-guides-web/scenarios/boot-recovery/03-bad-root-parameter/) |
| 04 | Contraseña de root | No puedes entrar como root | [Boot/04](/learning-sys-admin-guides-web/scenarios/boot-recovery/04-root-password/) |

---

## 🛠️ Preparación

```bash
cd public/labs/boot
./scripts/setup.sh
```

El setup:

1. descarga `debian-12-nocloud-amd64.qcow2` (unos 400 MB) en `cache/`;
2. crea una imagen dorada `golden.qcow2` y la provisiona por consola serie:
   - contraseña de root `labroot`;
   - GRUB con menú de 30 segundos y salida por serie;
   - `multi-user.target` y `serial-getty` en `ttyS0`;
3. crea `disk.qcow2`, una capa desechable sobre la imagen dorada;
4. arranca la VM y ejecuta `verify.sh`.

La primera ejecución puede tardar varios minutos: descarga, arranque con TCG y provisión por serie. Las siguientes reutilizan la imagen dorada.

Credenciales y consola:

| Dato | Valor |
|---|---|
| Usuario | `root` |
| Contraseña | `labroot` |
| Consola serie | `127.0.0.1:4444` |
| Disco | `/dev/vda` (`/dev/vda1` es la raíz) |

---

## 🧪 Comandos de laboratorio

```bash
# Arrancar en modo headless (consola serie)
./scripts/boot.sh

# Ver la consola serie
./scripts/console.sh

# Arrancar con ventana gráfica (necesario para GRUB)
./scripts/boot.sh --gui

# Comprobar kernel, systemd y discos
./scripts/verify.sh

# Ejecutar un comando como root por la consola serie
./scripts/vm-exec.sh 'uname -r; systemctl is-system-running'

# Romper un incidente
./scripts/break.sh 01

# Restaurar el disco desde la imagen dorada
./scripts/reset.sh 01

# Borrar imágenes y discos
./scripts/reset.sh --all
```

`break.sh` modifica la VM, hace `sync` y la apaga; después arrancas tú para ver el fallo.

---

## 🧯 Reset y limpieza

- `./scripts/reset.sh <id>`: apaga la VM, borra `disk.qcow2` y lo recrea desde `golden.qcow2`. Todos los escenarios parten del mismo estado limpio.
- `./scripts/reset.sh --all`: elimina discos, imagen dorada y caché de descarga.
- La imagen base y los discos están en `.gitignore`; no se versionan.

---

## ⚠️ Notas

- Es una VM local y desechable: no expongas el puerto serie (`4444`) a una red no confiable.
- `root/labroot` y GRUB editable son parte del laboratorio; en producción exigirías contraseña de GRUB, consola física y arranque seguro.
- En macOS ARM, QEMU emula x86_64 con TCG. Si tienes Linux con KVM, el laboratorio lo detecta y acelera el arranque.
- `boot.sh --gui` abre una ventana de QEMU; en un host sin entorno gráfico usa `console.sh` y mantén la consola conectada durante el reinicio.
- El laboratorio no usa red para los escenarios: la consola serie y el disco son suficientes.

---

## 🔗 Referencias internas

- [Proceso de boot de Linux](/learning-sys-admin-guides-web/reference/boot-process/) — etapas y síntomas.
- [systemd y journalctl](/learning-sys-admin-guides-web/guides/systemd_journalctl/) — logs del arranque.
- [Layout de disco](/learning-sys-admin-guides-web/reference/disk-layout/) — particiones, UUID y montajes.
- [GRUB rescue](/learning-sys-admin-guides-web/scenarios/boot-recovery/01-grub-rescue/) — primer escenario del laboratorio.
