---
title: "🧪 Laboratorio de correo — Postfix y Dovecot"
section: "labs"
meta:
  - label: "Requisitos"
    value: "Docker, `curl`"
  - label: "Herramientas"
    value: "Postfix, Dovecot, SMTP, IMAP"
  - label: "Escenarios relacionados"
    links:
      - id: "scenarios/email/01-mail-queue-deferred"
        label: "Correo/01 Cola diferida"
      - id: "scenarios/email/02-imap-auth-failure"
        label: "Correo/02 Fallo de autenticación IMAP"
      - id: "scenarios/email/03-maildir-permissions"
        label: "Correo/03 Permisos de Maildir"
      - id: "scenarios/email/04-relay-denied"
        label: "Correo/04 Relay denegado"
---

# 🧪 Laboratorio de correo — Postfix y Dovecot

---

## 🎯 Cuándo usar esta sección

Para practicar un servidor de correo pequeño y real: Postfix recibe SMTP y entrega en Maildir; Dovecot sirve IMAP y autentica usuarios. Los fallos típicos son colas que no avanzan, autenticación rechazada, permisos de buzón y relays mal configurados.

El laboratorio usa un contenedor Debian con Postfix y Dovecot, sin TLS ni DNS reales. Es suficiente para aprender el flujo y los logs sin montar un servidor de producción.

---

## 🔄 Flujo recomendado

1. **Preparar** el contenedor con `./scripts/setup.sh`.
2. **Romper** el incidente con `./scripts/break.sh <id>`.
3. **Enviar** correo con `./scripts/send.sh`.
4. **Leer** el buzón con `./scripts/imap.sh`.
5. **Resetear** con `./scripts/reset.sh` antes del siguiente.

---

## 📋 Requisitos

- Docker con Compose.
- `curl` con soporte SMTP/IMAP en el host.
- Puertos `2525` (SMTP) y `1143` (IMAP) libres.
- Unos 200 MB para la imagen.

```bash
docker --version
docker compose version
curl --version | grep -i protocols
```

---

## 🔐 Usuarios y servicios

| Dato | Valor |
|---|---|
| Usuarios | `alice` / `alice`, `bob` / `bob` |
| SMTP | `127.0.0.1:2525` |
| IMAP | `127.0.0.1:1143` |
| Dominio local | `lab.local` |
| Buzón | `/home/<usuario>/Maildir` |
| Logs | `/var/log/mail.log`, `/var/log/dovecot.log` |

No hay TLS ni autenticación de clientes SMTP; el foco es la entrega local y la autenticación IMAP.

---

## 🧩 Incidentes disponibles

| # | Escenario | Síntoma | Guía |
|---|---|---|---|
| 01 | Cola diferida | `mailq` muestra `Connection refused` al relay | [Correo/01](/learning-sys-admin-guides-web/scenarios/email/01-mail-queue-deferred/) |
| 02 | Autenticación IMAP | `Login denied` para `alice` | [Correo/02](/learning-sys-admin-guides-web/scenarios/email/02-imap-auth-failure/) |
| 03 | Permisos de Maildir | Entrega con `Permission denied` y rebote | [Correo/03](/learning-sys-admin-guides-web/scenarios/email/03-maildir-permissions/) |
| 04 | Relay denegado | `554 Relay access denied` al enviar fuera | [Correo/04](/learning-sys-admin-guides-web/scenarios/email/04-relay-denied/) |

---

## 🛠️ Preparación

```bash
cd public/labs/email
./scripts/setup.sh
```

El setup:

1. construye Debian con Postfix, Dovecot y `swaks`;
2. crea `alice` y `bob` con Maildir;
3. configura `mydestination=lab.local`, entrega en `Maildir/` y `mynetworks` para el host;
4. arranca Postfix y Dovecot;
5. valida SMTP, IMAP y autenticación.

---

## 🧪 Comandos de laboratorio

```bash
# Enviar un mensaje local
./scripts/send.sh alice@lab.local 'Asunto' 'Cuerpo'

# Ver mensajes en INBOX (números de mensaje)
./scripts/imap.sh alice alice

# Ver el estado general
./scripts/verify.sh

# Cola de Postfix
docker compose exec -T mail mailq

# Logs
docker compose exec -T mail tail -50 /var/log/mail.log
docker compose exec -T mail tail -50 /var/log/dovecot.log

# Romper un incidente
./scripts/break.sh 01

# Restaurar el contenedor
./scripts/reset.sh

# Consola root
./scripts/exec.sh
```

---

## ⚠️ Notas

- Es un servidor local sin TLS; no lo expongas a Internet.
- Las contraseñas están en texto plano en `/etc/dovecot/users` **a propósito** para el laboratorio.
- `mailq` vacío no siempre significa “todo bien”: un mensaje puede haberse rebotado.
- El relay externo no tiene salida real a Internet; los escenarios usan el dominio local y un relay muerto para provocar la cola.
- `reset.sh` elimina el contenedor y los buzones; el estado no persiste.

---

## 🔗 Referencias internas

- [Escenario: cola diferida](/learning-sys-admin-guides-web/scenarios/email/01-mail-queue-deferred/) — primer incidente.
- [Escenario: autenticación IMAP](/learning-sys-admin-guides-web/scenarios/email/02-imap-auth-failure/) — passdb y Dovecot.
- [Escenario: relay denegado](/learning-sys-admin-guides-web/scenarios/email/04-relay-denied/) — `mynetworks` y restricciones.
- [Escenario: permisos de Maildir](/learning-sys-admin-guides-web/scenarios/email/03-maildir-permissions/) — entrega local.
