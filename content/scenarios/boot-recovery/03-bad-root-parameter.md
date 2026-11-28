---
title: "🧩 Escenario: root= inválido — kernel panic al montar la raíz"
level: "Avanzado"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "boot"
  - label: "Herramientas"
    value: "GRUB, kernel, QEMU"
  - label: "Archivos"
    value: "`labs/boot/scripts/break.sh`"
  - label: "Ver laboratorio"
    links:
      - id: "labs/boot-recovery"
        label: "Laboratorio de boot recovery"
---

# 🧩 Escenario: root= inválido — kernel panic al montar la raíz

---

## 🎯 Problema

El menú de GRUB aparece y el kernel empieza a arrancar, pero se queda en un **kernel panic** porque no encuentra la partición raíz:

```text
VFS: Cannot open root device "vda999" or unknown-block(0,0): error -6
Please append a correct "root=" boot option; here are the available partitions:
...
Kernel panic - not syncing: VFS: Unable to mount root fs on unknown-block(0,0)
```

El sistema de archivos está intacto. El problema está en el parámetro `root=` de la entrada de GRUB, que apunta a un dispositivo que no existe.

---

## ⚡ Quick command (SRE)

```bash
cd public/labs/boot
./scripts/boot.sh --gui
```

Selecciona la entrada de Debian en el menú y pulsa `e` para editarla antes de arrancar.

---

## ✅ Salida esperada

- El menú de GRUB aparece con las entradas de Debian.
- Al arrancar, el kernel llega hasta `Run /init as init process` o similar y falla al montar la raíz.
- `VFS: Unable to mount root fs on unknown-block(0,0)`.
- `lsblk`/`blkid` desde un entorno de rescate muestran que `/dev/vda1` sí existe.

---

## 🧠 Diagnóstico

El kernel recibe la raíz por línea de comandos. Si el valor de `root=` no corresponde a ningún dispositivo visible en ese momento, el kernel no puede montar `/` y entra en pánico. Causas habituales:

- un `root=UUID=...` que quedó obsoleto tras clonar o restaurar un disco;
- un `root=/dev/sdX` que cambió de nombre al añadir discos;
- una entrada de GRUB editada a mano con un typo (`/dev/vda999`);
- un initramfs que no incluye el driver del controlador de disco.

La diferencia con un fallo de GRUB es la fase: aquí GRUB sí cargó el kernel; el que falla es el kernel al montar la raíz.

En el laboratorio, `break.sh 03` reemplaza el `root=PARTUUID=...` (o `root=UUID=...`) por `root=/dev/vda999` en `/boot/grub/grub.cfg`. El identificador real sigue en `/etc/fstab` y en el disco; solo está rota la línea de arranque.

---

## 🛠️ Procedimiento (runbook)

### 1. Confirmar el escenario

```bash
cd public/labs/boot
./scripts/break.sh 03
./scripts/boot.sh --gui
```

### 2. Editar la entrada en GRUB

En el menú de GRUB:

1. Selecciona la entrada de Debian (no la de recovery si no la necesitas).
2. Pulsa `e`.
3. Busca la línea que empieza por `linux` y contiene `root=/dev/vda999`.
4. Cambia el valor por el dispositivo correcto:
   ```text
   linux /boot/vmlinuz-6.1.0-56-amd64 root=/dev/vda1 ro
   ```
5. Pulsa `Ctrl-X` o `F10` para arrancar.

Si no conoces el dispositivo, en el prompt de GRUB puedes usar `ls` para listar particiones. La raíz del laboratorio es `/dev/vda1`.

### 3. Corregir la configuración permanente

Ya dentro del sistema:

```bash
blkid
findmnt -n -o SOURCE /
grep -n 'root=' /boot/grub/grub.cfg | head
```

Comprueba que `/etc/default/grub` no tenga un `GRUB_CMDLINE_LINUX` con un `root=` incorrecto. Lo normal es que la raíz la genere `update-grub` a partir de la configuración del sistema, no que esté escrita a mano.

Regenera el menú:

```bash
update-grub
```

### 4. Reiniciar y verificar

```bash
reboot
```

El arranque debe completar sin panic y llegar al login.

```bash
./scripts/verify.sh
```

---

## 🧯 Mitigación

- Si el kernel no ve el disco, arranca un kernel anterior desde el menú de GRUB.
- Si el UUID cambió, actualiza `/etc/fstab` y regenera el initramfs:
  ```bash
  update-initramfs -u -k all
  update-grub
  ```
- Si el disco es nuevo, comprueba que el controlador (virtio, AHCI, RAID) esté en el initramfs.
- Si el sistema usa LVM, verifica que el volumen esté activo (`vgchange -ay`) antes de montar.

---

## ✅ Verificación

- `findmnt -n -o SOURCE /` muestra `/dev/vda1` (o el UUID correcto).
- `grep -n 'root=' /boot/grub/grub.cfg` muestra el valor correcto.
- El sistema arranca sin panic y `systemctl is-system-running` responde `running`.
- `./scripts/reset.sh 03` devuelve el laboratorio al estado limpio.

---

## 🎓 Prevención

- No edites `grub.cfg` a mano; edita `/etc/default/grub` y ejecuta `update-grub`.
- Tras clonar una VM o restaurar un disco, revisa UUID y `root=`.
- Mantén un kernel anterior y una entrada de rescate.
- Prueba el arranque en una VM antes de reiniciar producción.
- Documenta el mapa de discos y el gestor de volúmenes (LVM, RAID, cifrado).

---

## 🚫 Qué no hacer

- **No reinstales el sistema** por un panic de `root=`: el disco suele estar bien.
- **No cambies `root=` a `/dev/sda1`** sin comprobar que ese es el dispositivo real; en virtio suele ser `/dev/vda`.
- **No regeneres el initramfs** sin saber qué driver falta; primero diagnostica.
- **No borres la entrada de GRUB** que funciona: conserva una copia.
- **No ignores el panic** y sigas reiniciando; el mismo parámetro vuelve a fallar.

---

## 🔗 Referencias internas

- [Laboratorio de boot recovery](/learning-sys-admin-guides-web/labs/boot-recovery/) — VM y comandos.
- [Proceso de boot de Linux](/learning-sys-admin-guides-web/reference/boot-process/) — kernel, initramfs y raíz.
- [Layout de disco](/learning-sys-admin-guides-web/reference/disk-layout/) — dispositivos y UUID.
- [Escenario: GRUB roto](/learning-sys-admin-guides-web/scenarios/boot-recovery/01-grub-rescue/) — cuando falla antes del kernel.
