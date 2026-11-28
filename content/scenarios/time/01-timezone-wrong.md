---
title: "🧩 Escenario: zona horaria incorrecta — logs que no cuadran"
level: "Básico"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "time"
  - label: "Herramientas"
    value: "`date`, `tzdata`, `chronyc`"
  - label: "Archivos"
    value: "`labs/time/scripts/break.sh`"
  - label: "Ver laboratorio"
    links:
      - id: "labs/time"
        label: "Laboratorio de tiempo"
---

# 🧩 Escenario: zona horaria incorrecta — logs que no cuadran

---

## 🎯 Problema

El reloj está sincronizado, pero los logs y las aplicaciones muestran una hora distinta a la esperada. Un evento que ocurrió a las 00:21 en Ciudad de México aparece como 06:21 UTC, y al correlacionar con otros sistemas los timestamps no coinciden.

La causa no es NTP: es la **zona horaria** del sistema o de la aplicación.

---

## ⚡ Quick command (SRE)

```bash
cd public/labs/time
./scripts/break.sh 01
docker compose exec time-client date
```

---

## ✅ Salida esperada

- `date` muestra `UTC` en lugar de `CST`/`CDT` (America/Mexico_City).
- `cat /etc/timezone` devuelve `UTC`.
- `readlink /etc/localtime` apunta a `/usr/share/zoneinfo/UTC`.
- `date -u` y `date` coinciden; en la zona correcta deberían diferir 6 horas (o 5 en horario de verano, según la regla vigente).
- `chronyc tracking` sigue mostrando `Leap status: Normal`: el reloj está bien, la zona está mal.

---

## 🧠 Diagnóstico

Linux guarda el reloj del sistema en UTC (o en la escala que configure el kernel) y aplica la zona horaria al mostrar la hora. La zona se resuelve con:

- `/etc/localtime`, normalmente un symlink a `/usr/share/zoneinfo/<zona>`;
- `/etc/timezone`, usado por algunas herramientas y por Debian;
- la variable `TZ`, que **tiene prioridad** sobre los archivos para el proceso que la define.

Si `TZ=UTC` está exportada en el servicio, cambiar `/etc/localtime` no basta. Revisa el entorno del proceso y la configuración de systemd (`Environment=TZ=...`) o del contenedor.

Comandos útiles:

```bash
date
date -u
timedatectl                 # en hosts con systemd
cat /etc/timezone
readlink -f /etc/localtime
env | grep '^TZ='
```

En el laboratorio, `break.sh 01` cambia el symlink y `/etc/timezone` a UTC. El contenedor no usa systemd; en un host real usarías `timedatectl set-timezone`.

---

## 🛠️ Procedimiento (runbook)

### 1. Confirmar la zona

```bash
cd public/labs/time
./scripts/break.sh 01
docker compose exec time-client date
docker compose exec time-client sh -c 'cat /etc/timezone; readlink -f /etc/localtime'
```

### 2. Corregir la zona

En el contenedor:

```bash
docker compose exec time-client sh -c '
  ln -sf /usr/share/zoneinfo/America/Mexico_City /etc/localtime
  echo America/Mexico_City > /etc/timezone
  date
'
```

En un host con systemd:

```bash
sudo timedatectl set-timezone America/Mexico_City
timedatectl
```

### 3. Revisar `TZ`

```bash
docker compose exec time-client env | grep '^TZ=' || echo "TZ no definida"
```

Si un servicio define `TZ=UTC`, cámbialo en su unidad, compose o variables de entorno. No edites `/etc/localtime` esperando que gane sobre `TZ`.

### 4. Verificar

```bash
docker compose exec time-client date
docker compose exec time-client date -u
./scripts/verify.sh
```

La diferencia entre `date` y `date -u` debe corresponder a la zona. `chronyc tracking` debe seguir en `Normal`.

---

## 🧯 Mitigación

- Si la aplicación usa su propia zona, corrige su configuración (`TZ`, `timezone` en Java, `time_zone` en MySQL, etc.).
- Si los logs están en UTC a propósito, no cambies el sistema: normaliza la correlación con `--utc`.
- Si el cambio afecta a cron, revisa que las tareas estén en la zona correcta.
- Si hay contenedores, recrea el servicio después de cambiar variables de entorno.

---

## ✅ Verificación

- `date` muestra la hora local esperada.
- `date -u` muestra UTC.
- `/etc/timezone` y `/etc/localtime` coinciden con la zona objetivo.
- `chronyc tracking` sigue sincronizado.
- `./scripts/reset.sh` restaura el laboratorio.

---

## 🎓 Prevención

- Define la zona en la imagen base y en la configuración de cada servicio.
- Estandariza logs en UTC y convierte solo en la presentación.
- Documenta la zona de negocio y la de infraestructura.
- Prueba los cambios de horario (DST) en staging.
- No dependas de la zona del host para aplicaciones críticas.

---

## ⚠️ Qué no hacer

- **No cambies el reloj** para “arreglar” la zona; son cosas distintas.
- **No ignores `TZ`**: puede sobrescribir `/etc/localtime`.
- **No mezcles logs locales y UTC** sin indicar la zona.
- **No asumas que todos los sistemas usan la misma zona.**
- **No cambies la zona de una base de datos** sin revisar timestamps existentes.

---

## 🔗 Referencias internas

- [Laboratorio de tiempo](/learning-sys-admin-guides-web/labs/time/) — cliente, servidor y reset.
- [systemd y journalctl](/learning-sys-admin-guides-web/guides/systemd_journalctl/) — timestamps y `--utc`.
- [Escenario: cliente NTP mal apuntado](/learning-sys-admin-guides-web/scenarios/time/02-chrony-wrong-server/) — cuando el problema sí es la sincronización.
