---
title: "🧩 Escenario: relay denegado — mynetworks y restricciones SMTP"
level: "Intermedio"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "email"
  - label: "Herramientas"
    value: "Postfix, `postconf`, `curl`, SMTP"
  - label: "Archivos"
    value: "`labs/email/scripts/break.sh`"
  - label: "Ver laboratorio"
    links:
      - id: "labs/email"
        label: "Laboratorio de correo"
---

# 🧩 Escenario: relay denegado — mynetworks y restricciones SMTP

---

## 🎯 Problema

El servidor SMTP responde al `RCPT TO` con:

```text
554 5.7.1 <destino@example.com>: Relay access denied
```

El cliente está autenticado a nivel de red, pero Postfix ya no lo considera parte de `mynetworks`. Puede ser un cambio de subred, una migración de Docker o una regla demasiado estricta.

---

## ⚡ Quick command (SRE)

```bash
cd public/labs/email
./scripts/break.sh 04
./scripts/send.sh destino@example.com 'Relay' 'Hola'
```

---

## ✅ Salida esperada

- `curl: (55) RCPT failed: 554`.
- `/var/log/mail.log` muestra `NOQUEUE: reject: RCPT ... Relay access denied`.
- El envío a `alice@lab.local` puede seguir funcionando, porque es un destino local.
- `postconf -n | grep mynetworks` muestra solo `127.0.0.1/32`.

---

## 🧠 Diagnóstico

Postfix decide si acepta relay con `smtpd_relay_restrictions`:

```text
smtpd_relay_restrictions = permit_mynetworks, reject_unauth_destination
```

- `permit_mynetworks` permite a los clientes de `mynetworks` enviar a cualquier destino.
- `reject_unauth_destination` rechaza el resto de relay no autorizado.

`mynetworks` debe incluir las redes desde las que envías: localhost, la red Docker (`172.16.0.0/12`) y, en Docker Desktop, la subred `192.168.65.0/24`. Si quitas la red del cliente, el servidor responde `554 Relay access denied`.

No confundas relay con autenticación: `mynetworks` es una confianza por IP; no sustituye SMTP AUTH.

---

## 🛠️ Procedimiento (runbook)

### 1. Confirmar el rechazo

```bash
cd public/labs/email
./scripts/break.sh 04
./scripts/send.sh destino@example.com 'Relay' 'Hola'
```

### 2. Revisar la configuración y el log

```bash
docker compose exec -T mail postconf -n | grep -E 'mynetworks|smtpd_relay_restrictions'
docker compose exec -T mail tail -30 /var/log/mail.log
```

### 3. Restaurar las redes permitidas

```bash
docker compose exec -T mail bash -lc "
  postconf -e 'mynetworks = 127.0.0.0/8 172.16.0.0/12 192.168.65.0/24'
  postfix reload
"
```

### 4. Verificar

```bash
./scripts/send.sh alice@lab.local 'Local' 'Hola'
docker compose exec -T mail mailq
```

El envío local debe aceptarse. Para un destino externo, el mensaje puede quedar en cola si no hay relay real; el objetivo es que Postfix **acepte** el relay.

### 5. Revisar el diseño

```bash
docker compose exec -T mail postconf -n | grep -E 'mynetworks|smtpd_relay_restrictions|smtpd_recipient_restrictions'
```

---

## 🧯 Mitigación

- Añade solo la red necesaria; evita `0.0.0.0/0`.
- Si el cliente está fuera de la red, usa SMTP AUTH en lugar de confiar por IP.
- Si cambió la red de Docker, actualiza `mynetworks` o la configuración del host.
- Revisa `smtpd_client_restrictions` y `smtpd_recipient_restrictions` por si hay otra regla.
- No desactives `reject_unauth_destination` para “probar”; convierte el servidor en open relay.

---

## ✅ Verificación

- `postconf -n` muestra la red del cliente en `mynetworks`.
- El envío local funciona.
- El envío externo ya no devuelve `554 Relay access denied` (puede quedar en cola si no hay salida).
- `./scripts/reset.sh` restaura el laboratorio.

---

## 🎓 Prevención

- Documenta las redes de clientes y actualízalas al cambiar de VPC/subred.
- Prefiere SMTP AUTH con TLS para clientes remotos.
- Revisa `postconf -n` tras cada cambio de infraestructura.
- Monitoriza rechazos `554` y `Relay access denied`.
- No uses `mynetworks` como sustituto de autenticación.
- Prueba desde la misma red que los clientes reales.

---

## ⚠️ Qué no hacer

- **No pongas `mynetworks = 0.0.0.0/0`**: crearías un open relay.
- **No desactives `reject_unauth_destination`** sin autenticación.
- **No confíes en `localhost`** si el cliente llega desde otra interfaz.
- **No ignores el log**: indica la IP y la restricción exacta.
- **No abras el relay** para resolver un problema de red.

---

## 🔗 Referencias internas

- [Laboratorio de correo](/learning-sys-admin-guides-web/labs/email/) — SMTP y logs.
- [Escenario: cola diferida](/learning-sys-admin-guides-web/scenarios/email/01-mail-queue-deferred/) — cuando el relay acepta pero no entrega.
- [Escenario: autenticación IMAP](/learning-sys-admin-guides-web/scenarios/email/02-imap-auth-failure/) — autenticación de usuarios.
