---
title: "🧩 Escenario: GRUB roto — arrancar desde 'grub rescue>'"
level: "Avanzado"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "boot"
  - label: "Herramientas"
    value: "GRUB, QEMU, consola gráfica"
  - label: "Archivos"
    value: "`labs/boot/scripts/break.sh`, `labs/boot/scripts/boot.sh`"
  - label: "Ver laboratorio"
    links:
      - id: "labs/boot-recovery"
        label: "Laboratorio de boot recovery"
---

# 🧩 Escenario: GRUB roto — arrancar desde 'grub rescue>'

---

## 🎯 Problema

Después de una actualización o de una limpieza manual, la VM ya no muestra el menú de GRUB. El arranque termina en un prompt mínimo:

```text
error: file '/boot/grub/grub.cfg' not found.
Entering rescue mode...
grub rescue>
```

El sistema está sano, pero el cargador no encuentra su configuración y no sabe qué kernel cargar. Hay que localizar la partición de arranque, cargar el kernel y el initramfs a mano y regenerar la configuración.

---

## ⚡ Quick command (SRE)

```bash
cd public/labs/boot
./scripts/boot.sh --gui
```

Con la ventana de QEMU abierta, trabaja en el prompt `grub rescue>`.

---

## ✅ Salida esperada

- La VM se detiene antes del kernel, en `grub rescue>`.
- `ls` muestra discos y particiones, por ejemplo `(hd0) (hd0,gpt1) (hd0,gpt14) (hd0,gpt15)`.
- `ls (hd0,gpt1)/` lista `boot/`, `etc/`, `usr/`, `var/` y el resto del sistema.
- `ls (hd0,gpt1)/boot/` muestra `vmlinuz-*`, `initrd.img-*` y `grub/`.
- Si la configuración existiera, el arranque normal mostraría el menú de GRUB durante 30 segundos.

---

## 🧠 Diagnóstico

GRUB tiene varias etapas:

1. **BIOS/UEFI** carga el sector de arranque o el EFI binary.
2. **GRUB core** busca su configuración en `/boot/grub/grub.cfg`.
3. **GRUB normal** lee el menú y ejecuta `linux` + `initrd`.
4. El **kernel** monta la raíz indicada en `root=`.

En `grub rescue>` solo existe un subconjunto de comandos (`ls`, `set`, `insmod`, `linux`, `initrd`, `boot`). No hay menú ni variables de entorno cargadas. La causa típica es:

- `grub.cfg` ausente o corrupto;
- el UUID de la raíz cambió y el `search` de GRUB no encuentra la partición;
- una actualización dejó el `core.img` o el módulo `normal` desalineados.

En el laboratorio, el escenario borra `/boot/grub/grub.cfg`. El kernel y el initramfs siguen en su sitio: la recuperación es cargarlos a mano y ejecutar `update-grub`.

La salida serie de QEMU no muestra bien el `grub rescue>` cuando falta la configuración serie; por eso el escenario usa la consola gráfica (`--gui`). Si trabajas en un host sin display, arranca con `console.sh` **antes** de que empiece el arranque; el menú de GRUB y el kernel sí salen por serie, pero el rescue temprano puede no hacerlo.

---

## 🛠️ Procedimiento (runbook)

### 1. Confirmar el escenario

```bash
cd public/labs/boot
./scripts/break.sh 01
./scripts/boot.sh --gui
```

`break.sh` hace una copia en `/root/grub.cfg.bak`, borra `/boot/grub/grub.cfg`, sincroniza y apaga la VM.

### 2. Localizar la raíz

En `grub rescue>`:

```text
ls
```

Prueba cada partición hasta encontrar la que contiene el sistema:

```text
ls (hd0,gpt1)/
ls (hd0,gpt1)/boot/
```

En la imagen Debian del laboratorio la raíz es `(hd0,gpt1)` y `/boot` está en la misma partición. Si `ls` responde `unknown filesystem`, esa no es la partición correcta o le falta el módulo; prueba la siguiente.

### 3. Cargar el kernel y el initramfs

Ajusta el nombre exacto que viste en `ls (hd0,gpt1)/boot/`:

```text
set root=(hd0,gpt1)
linux /boot/vmlinuz-6.1.0-56-amd64 root=/dev/vda1 ro
initrd /boot/initrd.img-6.1.0-56-amd64
boot
```

Si el kernel usa `root=PARTUUID=...` o `root=UUID=...`, también puedes usar el dispositivo (`/dev/vda1`) para arrancar una vez. El objetivo es entrar al sistema, no dejarlo así de forma permanente.

### 4. Regenerar la configuración

Ya dentro de Debian, como `root`:

```bash
ls -l /boot/grub/grub.cfg
update-grub
```

`update-grub` vuelve a generar el menú con los kernels instalados y la raíz detectada. Comprueba que el archivo existe y tiene contenido:

```bash
grep -E '^menuentry|linux /boot/vmlinuz' /boot/grub/grub.cfg
```

### 5. Reiniciar y verificar

```bash
reboot
```

El arranque debe pasar por el menú de GRUB y llegar al login. Si el menú sigue sin aparecer, revisa que `GRUB_TIMEOUT` y `GRUB_TERMINAL` no se hayan perdido en `/etc/default/grub`.

---

## 🧯 Mitigación

- Si `update-grub` falla, conserva `/root/grub.cfg.bak` y restáuralo:
  ```bash
  cp /root/grub.cfg.bak /boot/grub/grub.cfg
  ```
- Si el sistema no arranca ni con el kernel a mano, arranca desde un ISO live, monta la raíz y ejecuta `grub-install` + `update-grub` desde `chroot`.
- Si el problema es el UUID, compara `blkid` con el `root=` de `/boot/grub/grub.cfg`.

---

## ✅ Verificación

```bash
./scripts/verify.sh
```

Debe mostrar el kernel, `systemd is-system-running` en `running` (o `degraded` sin fallos críticos) y `/dev/vda1` montado en `/`. Tras el reinicio, el menú de GRUB aparece durante 30 segundos y el login responde con `root` / `labroot`.

---

## 🎓 Prevención

- Versiona `/etc/default/grub` y prueba `update-grub` en una VM antes de aplicarlo en producción.
- No borres `/boot/grub/grub.cfg` a mano; si necesitas limpiar kernels, usa `apt autoremove` y revisa el espacio de `/boot`.
- Mantén una entrada de rescate o un kernel anterior instalado.
- En servidores remotos, ten acceso a consola IPMI/KVM antes de tocar GRUB.
- Documenta el UUID de la raíz y cómo recuperarlo desde un live USB.

---

## 🚫 Qué no hacer

- **No reinstales el sistema** por un `grub rescue>`: el sistema de archivos suele estar intacto.
- **No borres `/boot`** para “empezar de cero”; perderás kernels e initramfs.
- **No ejecutes `grub-install` a ciegas** sobre el disco equivocado.
- **No cambies `root=` a un dispositivo que no existe** y reinicies sin probar; el kernel entrará en pánico.
- **No desactives la consola de rescate** en un servidor sin acceso físico.

---

## 🔗 Referencias internas

- [Laboratorio de boot recovery](/learning-sys-admin-guides-web/labs/boot-recovery/) — setup, consola y reset.
- [Proceso de boot de Linux](/learning-sys-admin-guides-web/reference/boot-process/) — etapas y responsabilidades.
- [Layout de disco](/learning-sys-admin-guides-web/reference/disk-layout/) — particiones, UUID y puntos de montaje.
- [Escenario: root= inválido](/learning-sys-admin-guides-web/scenarios/boot-recovery/03-bad-root-parameter/) — el siguiente fallo de la cadena de arranque.
