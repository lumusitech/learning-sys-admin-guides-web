---
title: "🧩 Escenario: ACL NTP bloqueada — el servidor ignora al cliente"
level: "Avanzado"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "time"
  - label: "Herramientas"
    value: "chrony, `chronyc`, ACL"
  - label: "Archivos"
    value: "`labs/time/scripts/break.sh`"
  - label: "Ver laboratorio"
    links:
      - id: "labs/time"
        label: "Laboratorio de tiempo"
---

# 🧩 Escenario: ACL NTP bloqueada — el servidor ignora al cliente

---

## 🎯 Problema

El servidor NTP está en marcha y responde en el puerto 123, pero el cliente no sincroniza. En el servidor, la directiva `allow` solo permite `127.0.0.1`; el cliente de la red Docker queda fuera. El servidor descarta las peticiones sin un error visible para el cliente.

---

## ⚡ Quick command (SRE)

```bash
cd public/labs/time
./scripts/break.sh 04
docker compose exec time-client chronyc tracking
```

---

## ✅ Salida esperada

- `chronyc tracking` muestra `Leap status: Not synchronised`.
- `chronyc sources -v` muestra `^?` con `Reach` 0.
- El servidor está `Up` y su log no muestra errores de arranque.
- `docker compose exec ntp-server cat /etc/chrony/server.conf` muestra `allow 127.0.0.1`.
- Desde el cliente, `getent hosts ntp-server` resuelve, pero no hay respuesta NTP útil.

---

## 🧠 Diagnóstico

`chrony` usa la directiva `allow` para decidir qué redes pueden consultar el servidor. Si la red del cliente no está incluida, el servidor no responde; el cliente lo interpreta como timeout y marca la fuente como inalcanzable.

No es lo mismo que:

- **servidor caído**: no hay proceso escuchando;
- **firewall**: el paquete se descarta antes de llegar;
- **ACL**: el paquete llega, pero chrony lo ignora.

Diagnóstico:

```bash
docker compose ps
docker compose exec ntp-server sh -c 'grep -E "^allow|^deny" /etc/chrony/server.conf'
docker compose exec time-client getent hosts ntp-server
docker compose exec time-client chronyc sources -v
docker compose logs ntp-server
```

En el laboratorio, `break.sh 04` cambia `allow 172.16.0.0/12` por `allow 127.0.0.1` y reinicia servidor y cliente.

---

## 🛠️ Procedimiento (runbook)

### 1. Confirmar la ACL

```bash
cd public/labs/time
./scripts/break.sh 04
docker compose exec ntp-server sh -c 'grep -E "^allow" /etc/chrony/server.conf'
docker compose exec time-client chronyc sources -v
```

### 2. Restaurar la ACL

En el servidor:

```bash
docker compose exec ntp-server cp /etc/chrony/server.conf.bak /etc/chrony/server.conf
docker compose restart ntp-server
docker compose restart time-client
```

O edita la línea:

```text
allow 172.16.0.0/12
```

### 3. Esperar y verificar

```bash
sleep 20
docker compose exec time-client chronyc tracking
docker compose exec time-client chronyc sources -v
./scripts/verify.sh
```

Debe aparecer `^* ntp-server` y `Leap status: Normal`.

### 4. Revisar el firewall del host

Si la ACL está bien y sigue sin funcionar:

```bash
sudo nft list ruleset | grep -i ntp
sudo ss -lunp | grep ':123'
```

---

## 🧯 Mitigación

- Ajusta `allow` a las redes internas necesarias, no a `0.0.0.0/0`.
- Si el cliente está en otra red, añade la subred correcta o usa un relay NTP.
- Si hay firewall, abre UDP/123 solo entre cliente y servidor.
- Si el servidor es compartido, documenta las redes autorizadas.
- Si el cambio es urgente, usa una fuente NTP alternativa mientras corriges la ACL.

---

## ✅ Verificación

- `chronyc tracking` en `Normal`.
- `chronyc sources -v` con `^*` y `Reach` distinto de 0.
- `./scripts/verify.sh` termina sin error.
- `./scripts/reset.sh` restaura el laboratorio.

---

## 🎓 Prevención

- Define ACL explícitas por subred y revísalas al cambiar la red.
- No uses `allow all` en servidores accesibles desde Internet.
- Añade rate limiting (`ratelimit`) y monitorización de peticiones.
- Versiona la configuración de chrony y valida en staging.
- Documenta el flujo cliente → servidor NTP → red.
- Prueba desde la misma subred que el cliente real, no solo desde localhost.

---

## ⚠️ Qué no hacer

- **No abras `allow 0.0.0.0/0`** para “que funcione”.
- **No confundas ACL con firewall**: revisa ambas capas.
- **No reinicies el servidor NTP** sin comprobar si otros clientes dependen de él.
- **No uses `localhost`** como fuente para clientes remotos.
- **No ignores el `Reach` 0** en `chronyc sources`: es la pista.

---

## 🔗 Referencias internas

- [Laboratorio de tiempo](/learning-sys-admin-guides-web/labs/time/) — servidor, cliente y reset.
- [Escenario: servidor NTP caído](/learning-sys-admin-guides-web/scenarios/time/03-ntp-server-down/) — cuando no hay proceso.
- [Escenario: cliente NTP mal apuntado](/learning-sys-admin-guides-web/scenarios/time/02-chrony-wrong-server/) — cuando el cliente apunta mal.
- [Guía de nftables](/learning-sys-admin-guides-web/guides/nftables/) — reglas de firewall.
