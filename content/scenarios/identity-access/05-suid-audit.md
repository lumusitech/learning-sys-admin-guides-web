---
title: "🧩 Escenario: binario SUID plantado — auditoría de privilegios"
level: "Avanzado"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "identity"
  - label: "Herramientas"
    value: "`find`, `getcap`, `dpkg -V`, `sudo -l`"
  - label: "Archivos"
    value: "`labs/identity/scripts/break.sh`"
  - label: "Ver laboratorio"
    links:
      - id: "labs/identity-access"
        label: "Laboratorio de identidad y acceso"
---

# 🧩 Escenario: binario SUID plantado — auditoría de privilegios

---

## 🎯 Problema

Una auditoría rápida encuentra un binario inesperado con el bit SUID de root:

```text
-rwsr-xr-x 1 root root 1346480 /usr/local/bin/suid-bash
```

No es parte de ningún paquete y permite obtener una shell con privilegios de root. Puede ser un resto de una intrusión, una mala práctica de instalación o una puerta trasera. Hay que confirmarlo, contenerlo y erradicarlo.

---

## ⚡ Quick command (SRE)

```bash
cd public/labs/identity
./scripts/break.sh 05
./scripts/ssh.sh admin 'sudo find / -xdev -perm -4000 -type f -ls 2>/dev/null'
```

---

## ✅ Salida esperada

- `find` lista `/usr/local/bin/suid-bash` con `-rwsr-xr-x` y propietario `root`.
- `dpkg -S /usr/local/bin/suid-bash` no encuentra paquete (archivo no gestionado).
- `dpkg -V` puede no reportar nada si el archivo está fuera de un paquete; por eso hay que buscar en `/usr/local`.
- `getcap -r /` no muestra capacidades, pero el SUID ya es suficiente para escalar.

---

## 🧠 Diagnóstico

El bit SUID (`4000`) hace que un ejecutable corra con el UID de su propietario. Si el propietario es `root`, cualquier usuario puede obtener una shell de root si el binario lo permite (por ejemplo, una copia de `bash`).

Los SUID legítimos en Debian incluyen `su`, `sudo`, `passwd`, `mount`, `umount`, `chsh`, `chfn`, `newgrp`, `gpasswd` y pocos más. Un `bash` SUID en `/usr/local/bin` no es normal.

La auditoría combina:

1. **SUID/SGID**: `find / -xdev -perm -4000 -o -perm -2000`.
2. **Capacidades**: `getcap -r / 2>/dev/null`.
3. **Reglas sudo**: `sudo -l` y `/etc/sudoers.d/`.
4. **Integridad de paquetes**: `dpkg -V` y `debsums`.
5. **Propiedad y fechas**: archivos en `/usr/local` o `/tmp` con owner root y fecha reciente.

En el laboratorio, `break.sh 05` copia `/bin/bash` a `/usr/local/bin/suid-bash` y le pone `4755`.

---

## 🛠️ Procedimiento (runbook)

### 1. Confirmar el hallazgo

```bash
cd public/labs/identity
./scripts/break.sh 05
./scripts/ssh.sh admin 'sudo find / -xdev -perm -4000 -type f -ls 2>/dev/null'
```

### 2. Verificar que no es legítimo

```bash
./scripts/ssh.sh admin 'dpkg -S /usr/local/bin/suid-bash || echo NO_PACKAGE'
./scripts/ssh.sh admin 'ls -l /usr/local/bin/suid-bash'
./scripts/ssh.sh admin 'getcap -r / 2>/dev/null'
```

Si el archivo no pertenece a un paquete y está en una ruta de usuario, trátalo como sospechoso.

### 3. Contener

Si sospechas compromiso, no lo ejecutes. Aísla el host de la red, conserva evidencia y revisa procesos, cron, claves SSH y logs antes de borrar.

Para el laboratorio, elimina el binario:

```bash
./scripts/ssh.sh admin 'sudo rm -f /usr/local/bin/suid-bash'
```

### 4. Verificar la limpieza

```bash
./scripts/ssh.sh admin 'sudo find / -xdev -perm -4000 -type f -ls 2>/dev/null'
```

No debe aparecer `suid-bash`. Revisa también SGID y capacidades:

```bash
./scripts/ssh.sh admin 'sudo find / -xdev \( -perm -4000 -o -perm -2000 \) -type f -ls 2>/dev/null'
./scripts/ssh.sh admin 'sudo getcap -r / 2>/dev/null'
```

### 5. Buscar persistencia

```bash
./scripts/ssh.sh admin 'sudo crontab -l; sudo ls -la /etc/cron.*'
./scripts/ssh.sh admin 'sudo find /home -name authorized_keys -ls'
./scripts/ssh.sh admin 'sudo ss -lntup'
```

---

## 🧯 Mitigación

- Elimina el binario solo después de preservar evidencia si hay sospecha de intrusión.
- Rota credenciales y claves SSH del host.
- Revisa `sudoers`, unidades systemd, cron y `authorized_keys`.
- Si el host está comprometido, reconstruye desde una imagen confiable en lugar de limpiar a mano.
- Aplica el principio de mínimo privilegio y montajes `nosuid` donde sea posible.

---

## ✅ Verificación

- `find` no muestra el binario plantado.
- `dpkg -V` no reporta archivos modificados de paquetes.
- `sudo -l` no contiene reglas nuevas o sospechosas.
- `./scripts/reset.sh` restaura el laboratorio.

---

## 🎓 Prevención

- Mantén inventario de SUID/SGID y alerta cuando aparezca uno nuevo.
- Usa `auditd` para vigilar `chmod` con bits SUID y escrituras en `/usr/local/bin`.
- Monta `/home`, `/tmp` y datos con `nosuid,nodev,noexec` cuando aplique.
- Restringe `sudo` y revisa `sudoers.d` en cada cambio.
- Usa imágenes mínimas y firmadas; evita instalar software desde fuentes no confiables.
- Ejecuta `dpkg -V`/`debsums` periódicamente.

---

## ⚠️ Qué no hacer

- **No ejecutes el binario** para “ver qué hace” en un host sospechoso.
- **No borres evidencia** antes de decidir si hay que investigar.
- **No asumas que un SUID es legítimo** solo porque está en `/usr/bin`.
- **No desactives la auditoría** para evitar falsos positivos.
- **No limpies a mano un host comprometido** sin plan de reconstrucción.

---

## 🔗 Referencias internas

- [Laboratorio de identidad y acceso](/learning-sys-admin-guides-web/labs/identity-access/) — `admin`, consola root y reset.
- [Escenario: auditoría SUID y permisos](/learning-sys-admin-guides-web/scenarios/security/02-suid-audit-and-file-permissions/) — versión de auditoría.
- [Escenario: intento de escalada](/learning-sys-admin-guides-web/scenarios/security/07-privilege-escalation-attempt/) — respuesta a incidentes.
- [Escenario: claves SSH no autorizadas](/learning-sys-admin-guides-web/scenarios/security/03-unauthorized-ssh-keys/) — persistencia por acceso.
