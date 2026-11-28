---
title: "🧩 Escenario: servidor NTP caído — el cliente pierde la fuente"
level: "Intermedio"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "time"
  - label: "Herramientas"
    value: "`chronyc`, Docker Compose"
  - label: "Archivos"
    value: "`labs/time/scripts/break.sh`"
  - label: "Ver laboratorio"
    links:
      - id: "labs/time"
        label: "Laboratorio de tiempo"
---

# 🧩 Escenario: servidor NTP caído — el cliente pierde la fuente

---

## 🎯 Problema

El cliente estaba sincronizado, pero el servidor NTP dejó de responder. `chronyc sources` ya no muestra una fuente válida y `chronyc tracking` vuelve a `Not synchronised`. Si el cliente mantiene la hora por el RTC, el fallo puede pasar desapercibido hasta que el reloj derive.

---

## ⚡ Quick command (SRE)

```bash
cd public/labs/time
./scripts/break.sh 03
docker compose exec time-client chronyc tracking
```

---

## ✅ Salida esperada

- `chronyc tracking` muestra `Leap status: Not synchronised`.
- `chronyc sources -v` no tiene `^*` o muestra `^?` para el servidor.
- `docker compose ps` muestra `time-ntp-server` detenido.
- Los logs del cliente pueden incluir `No suitable source` o timeouts.
- La hora local no cambia de inmediato: el reloj sigue funcionando, pero sin corrección.

---

## 🧠 Diagnóstico

NTP es un protocolo de **mantenimiento**, no de arranque: si el servidor cae, el cliente conserva la última hora conocida y sigue contando con su reloj. El problema aparece cuando la deriva supera el umbral de la aplicación (TLS, tokens, cron, bases de datos).

Diagnóstico:

1. **Servicio**: `docker compose ps`, `docker compose logs ntp-server`.
2. **Fuente**: `chronyc sources -v` (estado `^?`, `Reach` 0).
3. **Conectividad**: `getent hosts ntp-server`; UDP/123.
4. **Cliente**: `chronyc tracking`, `chronyc activity`.
5. **Impacto**: compara `date` con una referencia externa y revisa errores de TLS/autenticación.

En el laboratorio, `break.sh 03` detiene `ntp-server` y reinicia el cliente para que arranque sin fuente.

---

## 🛠️ Procedimiento (runbook)

### 1. Confirmar la caída

```bash
cd public/labs/time
./scripts/break.sh 03
docker compose ps
docker compose logs --tail=30 ntp-server
docker compose exec time-client chronyc tracking
```

### 2. Levantar el servidor

```bash
docker compose start ntp-server
docker compose restart time-client
sleep 20
docker compose exec time-client chronyc tracking
```

Debe volver a `Leap status: Normal` y `^*` en `chronyc sources -v`.

### 3. Verificar la hora

```bash
docker compose exec time-client date -u
docker compose exec time-client chronyc sources -v
./scripts/verify.sh
```

### 4. Revisar el impacto

En un host real, si el reloj derivó:

```bash
timedatectl
chronyc tracking
journalctl -u chrony --since "1 hour ago"
```

Si el offset es grande, coordina el `makestep` con los servicios afectados.

---

## 🧯 Mitigación

- Arranca el servidor NTP y fuerza una resincronización controlada.
- Si el servidor no vuelve, apunta el cliente a una fuente secundaria.
- Si el reloj derivó, corrige antes de reiniciar servicios que validan certificados o tokens.
- Si el fallo es de infraestructura, revisa el hipervisor, la red y el firewall.
- Si el servidor es único, añade redundancia: dos servidores internos o un pool controlado.

---

## ✅ Verificación

- `chronyc tracking` en `Normal`.
- `chronyc sources -v` con `^*` y `Reach` distinto de 0.
- `./scripts/verify.sh` termina sin error.
- `./scripts/reset.sh` restaura el laboratorio.

---

## 🎓 Prevención

- Usa al menos dos servidores NTP y monitoriza ambos.
- Alerta si el cliente pierde sincronización durante más de X minutos.
- Supervisa la deriva y el offset, no solo el estado del servicio.
- Documenta el impacto del tiempo en TLS, Kerberos, OAuth y bases de datos.
- Prueba la caída de un servidor NTP en un juego de caos.
- Mantén el RTC y la configuración de arranque coherentes.

---

## ⚠️ Qué no hacer

- **No cambies la hora a mano** en un servidor en producción sin coordinación.
- **No reinicies todos los servicios** antes de estabilizar el reloj.
- **No asumas que “sigue funcionando”** significa que la hora es correcta.
- **No dejes un único servidor NTP** como única fuente.
- **No ignores los errores de certificados**: pueden ser síntoma de deriva.

---

## 🔗 Referencias internas

- [Laboratorio de tiempo](/learning-sys-admin-guides-web/labs/time/) — servidor, cliente y reset.
- [Escenario: cliente NTP mal apuntado](/learning-sys-admin-guides-web/scenarios/time/02-chrony-wrong-server/) — configuración incorrecta.
- [Escenario: ACL NTP bloqueada](/learning-sys-admin-guides-web/scenarios/time/04-ntp-acl-blocked/) — el servidor está vivo pero no responde.
