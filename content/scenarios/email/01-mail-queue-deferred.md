---
title: "🧩 Escenario: cola de correo diferida — relay muerto"
level: "Intermedio"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "email"
  - label: "Herramientas"
    value: "Postfix, `mailq`, `postqueue`, `postconf`"
  - label: "Archivos"
    value: "`labs/email/scripts/break.sh`"
  - label: "Ver laboratorio"
    links:
      - id: "labs/email"
        label: "Laboratorio de correo"
---

# 🧩 Escenario: cola de correo diferida — relay muerto

---

## 🎯 Problema

Un usuario envía un correo a `alice@lab.local` y el servidor lo acepta, pero el mensaje nunca llega. `mailq` muestra una entrada atascada:

```text
(connect to 127.0.0.1[127.0.0.1]:2526: Connection refused)
                                         alice@lab.local
```

El dominio local quedó fuera de `mydestination` y el relay apunta a un puerto donde no hay SMTP. Postfix considera el mensaje “externo”, intenta relayarlo y lo deja en cola.

---

## ⚡ Quick command (SRE)

```bash
cd public/labs/email
./scripts/break.sh 01
./scripts/send.sh alice@lab.local 'Cola' 'Hola'
docker compose exec -T mail mailq
```

---

## ✅ Salida esperada

- `send.sh` responde con `250 2.0.0 Ok: queued as ...`.
- `mailq` muestra `Connection refused` y el destinatario.
- `/var/log/mail.log` contiene intentos `status=deferred` y `connect to ... Connection refused`.
- El buzón de `alice` no tiene el mensaje todavía.

---

## 🧠 Diagnóstico

Postfix decide la ruta con:

- `mydestination`: dominios que considera locales;
- `relayhost`: siguiente salto para el correo externo;
- `transport_maps`: rutas específicas por dominio;
- `local_recipient_maps`: usuarios válidos para entrega local.

Si `lab.local` no está en `mydestination`, `alice@lab.local` deja de ser local. Postfix lo envía al relay; si el relay no responde, el mensaje queda en `deferred` y se reintenta con backoff.

En el laboratorio, `break.sh 01` cambia `mydestination` a `localhost` y pone `relayhost = [127.0.0.1]:2526`, un puerto cerrado. La cola es el síntoma, no la causa.

---

## 🛠️ Procedimiento (runbook)

### 1. Confirmar la cola

```bash
cd public/labs/email
./scripts/break.sh 01
./scripts/send.sh alice@lab.local 'Cola' 'Hola'
docker compose exec -T mail mailq
```

### 2. Leer el motivo

```bash
docker compose exec -T mail tail -40 /var/log/mail.log
```

Busca `status=deferred`, `connect to` y el relay configurado.

### 3. Revisar la configuración

```bash
docker compose exec -T mail postconf -n | grep -E 'mydestination|relayhost|transport'
```

Si `lab.local` no está en `mydestination`, esa es la causa.

### 4. Corregir y reintentar

```bash
docker compose exec -T mail bash -lc "
  postconf -e 'mydestination = lab.local, localhost, localhost.localdomain'
  postconf -e 'relayhost ='
  postfix reload
  postqueue -f
"
```

`postqueue -f` fuerza un intento inmediato de todos los mensajes en cola.

### 5. Verificar la entrega

```bash
docker compose exec -T mail mailq
./scripts/imap.sh alice alice
```

`mailq` debe estar vacío y `alice` debe ver el mensaje.

---

## 🧯 Mitigación

- Corrige primero la configuración; no borres la cola a ciegas.
- Si el relay correcto está caído, apunta a uno alternativo o espera el reintento.
- Revisa `transport_maps` y `relayhost` antes de reiniciar Postfix.
- Si hay muchos mensajes, usa `postqueue -p` para inspeccionar y `postsuper -d` solo con criterio.
- Documenta el flujo de correo (local, relay, smarthost).

---

## ✅ Verificación

- `postconf -n` muestra `mydestination` con `lab.local` y `relayhost` vacío.
- `mailq` queda vacío tras `postqueue -f`.
- `./scripts/imap.sh alice alice` lista el mensaje.
- `./scripts/reset.sh` restaura el laboratorio.

---

## 🎓 Prevención

- Versiona `main.cf` y valida con `postconf -n` antes de desplegar.
- Monitoriza el tamaño de la cola (`mailq | tail -1`) y alerta si crece.
- Prueba el flujo local y el relay en staging.
- Documenta qué dominios son locales y cuáles se relayan.
- Evita relays muertos o hardcodeados; usa nombres resueltos por DNS.

---

## ⚠️ Qué no hacer

- **No borres `/var/spool/postfix`** para “limpiar” la cola.
- **No uses `postsuper -d ALL`** sin revisar los mensajes.
- **No pongas `mydestination =` vacío** sin entender el efecto.
- **No reinicies en bucle** sin leer `mail.log`.
- **No ignores los rebotes**: un mensaje puede salir de la cola porque rebotó, no porque se entregó.

---

## 🔗 Referencias internas

- [Laboratorio de correo](/learning-sys-admin-guides-web/labs/email/) — SMTP, IMAP y logs.
- [Escenario: relay denegado](/learning-sys-admin-guides-web/scenarios/email/04-relay-denied/) — restricciones de relay.
- [Escenario: permisos de Maildir](/learning-sys-admin-guides-web/scenarios/email/03-maildir-permissions/) — entrega local y rebotes.
