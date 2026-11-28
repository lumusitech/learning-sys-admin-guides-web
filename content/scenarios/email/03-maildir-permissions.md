---
title: "🧩 Escenario: permisos de Maildir — entrega local rebotada"
level: "Intermedio"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "email"
  - label: "Herramientas"
    value: "Postfix, `mailq`, `chown`, Maildir"
  - label: "Archivos"
    value: "`labs/email/scripts/break.sh`"
  - label: "Ver laboratorio"
    links:
      - id: "labs/email"
        label: "Laboratorio de correo"
---

# 🧩 Escenario: permisos de Maildir — entrega local rebotada

---

## 🎯 Problema

Postfix acepta un mensaje para `alice@lab.local`, pero el correo no aparece en su buzón. El remitente recibe un rebote y `mailq` está vacío:

```text
status=bounced (maildir delivery failed: create maildir file
...: Permission denied)
```

El Maildir pertenece a `root` en lugar de `alice`. Postfix no puede escribir y devuelve un NDR; como el fallo es permanente, el mensaje sale de la cola.

---

## ⚡ Quick command (SRE)

```bash
cd public/labs/email
./scripts/break.sh 03
./scripts/send.sh alice@lab.local 'Permisos' 'Hola'
docker compose exec -T mail tail -30 /var/log/mail.log
```

---

## ✅ Salida esperada

- `send.sh` responde `250 ... queued as ...`.
- `mailq` está vacío: no hay cola pendiente.
- `mail.log` muestra `status=bounced` y `Permission denied` al crear el archivo en `Maildir/tmp`.
- El remitente (`bob`) recibe un rebote; `alice` no ve el mensaje.

---

## 🧠 Diagnóstico

Postfix entrega el correo local con el UID del destinatario (`alice`). El Maildir debe ser propiedad de `alice` y tener permisos de escritura para ella:

```text
/home/alice/Maildir/      alice:alice  700
/home/alice/Maildir/cur   alice:alice
/home/alice/Maildir/new   alice:alice
/home/alice/Maildir/tmp   alice:alice
```

Si el directorio pertenece a `root`, el proceso de entrega no puede crear el archivo temporal y devuelve un fallo permanente. Postfix genera un rebote y elimina el mensaje de la cola.

No confundas “cola vacía” con “entrega exitosa”: revisa siempre el estado en `mail.log` y el buzón.

---

## 🛠️ Procedimiento (runbook)

### 1. Confirmar permisos

```bash
cd public/labs/email
./scripts/break.sh 03
docker compose exec -T mail stat -c '%U:%G %a %n' /home/alice/Maildir /home/alice/Maildir/new
```

### 2. Enviar y leer el log

```bash
./scripts/send.sh alice@lab.local 'Permisos' 'Hola'
docker compose exec -T mail tail -30 /var/log/mail.log
docker compose exec -T mail mailq
```

### 3. Corregir la propiedad

```bash
docker compose exec -T mail chown -R alice:alice /home/alice/Maildir
docker compose exec -T mail chmod 700 /home/alice/Maildir
```

### 4. Reenviar y verificar

```bash
./scripts/send.sh alice@lab.local 'Permisos corregidos' 'Hola'
./scripts/imap.sh alice alice
```

Debe aparecer un número de mensaje en `SEARCH`.

### 5. Revisar los demás buzones

```bash
docker compose exec -T mail bash -lc 'find /home -maxdepth 3 -name Maildir -exec stat -c "%U:%G %a %n" {} \;'
```

---

## 🧯 Mitigación

- Corrige la propiedad y los permisos; no muevas el buzón a otro usuario.
- Si el fallo es masivo, revisa el script de provisión de usuarios.
- Si el correo es crítico, pide al remitente que lo reenvíe tras la corrección.
- Si hay un rebote con datos sensibles, revisa la política de NDR.
- Si el buzón está montado en NFS, revisa `uid/gid` y opciones de montaje.

---

## ✅ Verificación

- `stat` muestra `alice:alice` en todo el Maildir.
- Un correo nuevo llega a `alice` y `imap.sh` lo lista.
- `mail.log` muestra `status=sent (delivered to maildir)`.
- `./scripts/reset.sh` restaura el laboratorio.

---

## 🎓 Prevención

- Provisiona Maildir con el UID/GID correcto desde el alta del usuario.
- Audita permisos de `/home` y buzones.
- Evita ejecutar tareas manuales como root que cambien la propiedad.
- Usa `maildirmake` o el script de alta de la organización.
- Monitoriza rebotes `5.2.0` y errores de entrega local.
- Documenta la recuperación de un buzón con permisos rotos.

---

## ⚠️ Qué no hacer

- **No hagas `chmod 777`** al Maildir para “que funcione”.
- **No muevas el buzón** a otro usuario sin migrar índices.
- **No borres el NDR** sin revisar la causa.
- **No asumas que `mailq` vacío = entregado**; mira `mail.log` y el buzón.
- **No ejecutes el corrector como root** sin verificar el propietario final.

---

## 🔗 Referencias internas

- [Laboratorio de correo](/learning-sys-admin-guides-web/labs/email/) — envío, IMAP y logs.
- [Escenario: cola diferida](/learning-sys-admin-guides-web/scenarios/email/01-mail-queue-deferred/) — cuando el mensaje sí queda en cola.
- [Escenario: autenticación IMAP](/learning-sys-admin-guides-web/scenarios/email/02-imap-auth-failure/) — cuando falla el login.
