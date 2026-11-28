---
title: "🧪 Laboratorio de tiempo — NTP, chrony y zonas horarias"
section: "labs"
meta:
  - label: "Requisitos"
    value: "Docker con Compose"
  - label: "Herramientas"
    value: "chrony, `chronyc`, `date`, `tzdata`"
  - label: "Escenarios relacionados"
    links:
      - id: "scenarios/time/01-timezone-wrong"
        label: "Tiempo/01 Zona horaria incorrecta"
      - id: "scenarios/time/02-chrony-wrong-server"
        label: "Tiempo/02 Cliente NTP mal apuntado"
      - id: "scenarios/time/03-ntp-server-down"
        label: "Tiempo/03 Servidor NTP caído"
      - id: "scenarios/time/04-ntp-acl-blocked"
        label: "Tiempo/04 ACL NTP bloqueada"
---

# 🧪 Laboratorio de tiempo — NTP, chrony y zonas horarias

---

## 🎯 Cuándo usar esta sección

Para practicar los fallos de tiempo que rompen logs, TLS, autenticación, cron y bases de datos: zona horaria incorrecta, cliente NTP apuntando al servidor equivocado, servidor NTP caído o ACL que impide sincronizar.

El laboratorio levanta dos contenedores Debian: un servidor `chrony` y un cliente. El cliente mide la sincronización, pero **no cambia el reloj del host**: Docker no concede `CAP_SYS_TIME` por defecto y el laboratorio arranca `chronyd -x` a propósito.

---

## 🔄 Flujo recomendado

1. **Preparar** el laboratorio con `./scripts/setup.sh`.
2. **Romper** el incidente con `./scripts/break.sh <id>`.
3. **Diagnosticar** con `chronyc`, `date` y `/etc/timezone`.
4. **Reparar** siguiendo el escenario.
5. **Resetear** con `./scripts/reset.sh`.

---

## 📋 Requisitos

- Docker con Compose.
- Puerto libre no requerido en el host: los contenedores hablan por una red interna.
- Unos 100 MB de imagen; el build inicial tarda menos de un minuto.

```bash
docker --version
docker compose version
```

---

## 🧩 Incidentes disponibles

| # | Escenario | Síntoma | Guía |
|---|---|---|---|
| 01 | Zona horaria incorrecta | `date` muestra UTC y los logs no cuadran | [Tiempo/01](/learning-sys-admin-guides-web/scenarios/time/01-timezone-wrong/) |
| 02 | Cliente NTP mal apuntado | `Leap status: Not synchronised`, fuente `^?` | [Tiempo/02](/learning-sys-admin-guides-web/scenarios/time/02-chrony-wrong-server/) |
| 03 | Servidor NTP caído | El cliente pierde la fuente y no sincroniza | [Tiempo/03](/learning-sys-admin-guides-web/scenarios/time/03-ntp-server-down/) |
| 04 | ACL NTP bloqueada | El servidor responde, pero no al cliente | [Tiempo/04](/learning-sys-admin-guides-web/scenarios/time/04-ntp-acl-blocked/) |

---

## 🛠️ Preparación

```bash
cd public/labs/time
./scripts/setup.sh
```

El setup:

1. construye una imagen Debian con `chrony` y `tzdata`;
2. arranca `time-ntp-server` (estrato local 8) y `time-client`;
3. configura el cliente con `server ntp-server iburst minpoll 4 maxpoll 4`;
4. espera a que `chronyc tracking` muestre `Leap status: Normal`;
5. ejecuta `verify.sh`.

Zona horaria del cliente: `America/Mexico_City`.

---

## 🧪 Comandos de laboratorio

```bash
# Estado del laboratorio
./scripts/verify.sh

# Fecha y zona horaria del cliente
docker compose exec time-client date
docker compose exec time-client cat /etc/timezone

# Estado de chrony
docker compose exec time-client chronyc tracking
docker compose exec time-client chronyc sources -v

# Consola del cliente
./scripts/exec.sh

# Romper un incidente
./scripts/break.sh 01

# Restaurar el laboratorio
./scripts/reset.sh
```

---

## ⚠️ Notas

- `chronyd -x` mide y registra la sincronización, pero no ajusta el reloj. En un host real usarías `timedatectl`, `chronyc makestep` o `chronyc sources` sin `-x`.
- El servidor NTP usa `local stratum 8`; no depende de Internet.
- El cliente resuelve `ntp-server` por DNS interno de Docker.
- `reset.sh` recrea los contenedores y vuelve a la configuración limpia.
- No expongas el servidor NTP a Internet sin ACL y rate limiting.

---

## 🔗 Referencias internas

- [systemd y journalctl](/learning-sys-admin-guides-web/guides/systemd_journalctl/) — timestamps y `--utc`.
- [Escenario: zona horaria incorrecta](/learning-sys-admin-guides-web/scenarios/time/01-timezone-wrong/) — primer incidente.
- [Escenario: cliente NTP mal apuntado](/learning-sys-admin-guides-web/scenarios/time/02-chrony-wrong-server/) — diagnóstico con `chronyc`.
- [Escenario: servidor NTP caído](/learning-sys-admin-guides-web/scenarios/time/03-ntp-server-down/) — alta disponibilidad.
