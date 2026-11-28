---
title: "🧩 Escenario: autenticación IMAP fallida — passdb de Dovecot"
level: "Intermedio"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "email"
  - label: "Herramientas"
    value: "Dovecot, `doveadm`, IMAP, `curl`"
  - label: "Archivos"
    value: "`labs/email/scripts/break.sh`"
  - label: "Ver laboratorio"
    links:
      - id: "labs/email"
        label: "Laboratorio de correo"
---

# 🧩 Escenario: autenticación IMAP fallida — passdb de Dovecot

---

## 🎯 Problema

El usuario `alice` no puede leer su correo. El cliente IMAP recibe `Login denied` aunque la contraseña sea correcta y el buzón exista. El problema está en el `passdb` de Dovecot: la credencial desapareció del archivo de usuarios.

---

## ⚡ Quick command (SRE)

```bash
cd public/labs/email
./scripts/break.sh 02
./scripts/imap.sh alice alice
```

---

## ✅ Salida esperada

- `curl: (67) Login denied`.
- `doveadm auth test alice alice` responde `auth failed`.
- `/var/log/dovecot.log` registra `auth failed` para `alice`.
- `bob` sigue autenticándose si su línea está intacta.

---

## 🧠 Diagnóstico

Dovecot separa autenticación (`passdb`) y resolución de usuario (`userdb`). En el laboratorio:

```text
passdb {
  driver = passwd-file
  args = /etc/dovecot/users
}
userdb {
  driver = passwd
}
```

`/etc/dovecot/users` contiene `alice:{PLAIN}alice` y `bob:{PLAIN}bob`. Si se elimina o corrompe la línea de `alice`, el passdb no puede verificar la contraseña. `doveadm reload` es necesario porque Dovecot mantiene el archivo en caché.

El buzón y los correos siguen en `/home/alice/Maildir`; no hay pérdida de datos.

---

## 🛠️ Procedimiento (runbook)

### 1. Confirmar el fallo

```bash
cd public/labs/email
./scripts/break.sh 02
./scripts/imap.sh alice alice
```

### 2. Revisar usuarios y logs

```bash
docker compose exec -T mail bash -lc 'cat /etc/dovecot/users'
docker compose exec -T mail tail -30 /var/log/dovecot.log
docker compose exec -T mail doveadm auth test alice alice
```

### 3. Restaurar la credencial

```bash
docker compose exec -T mail bash -lc "
  echo 'alice:{PLAIN}alice' >> /etc/dovecot/users
  doveadm reload
"
```

### 4. Verificar

```bash
./scripts/imap.sh alice alice
docker compose exec -T mail doveadm auth test alice alice
```

Debe responder `auth succeeded` y el IMAP debe listar el buzón.

### 5. Revisar el resto de cuentas

```bash
./scripts/imap.sh bob bob
```

Confirma que el fallo era solo de `alice` y no del servicio completo.

---

## 🧯 Mitigación

- Restaura la línea desde una copia o desde el gestor de identidad.
- Si el archivo completo está corrupto, reemplázalo y recarga Dovecot.
- Si el fallo afecta a todos, revisa permisos de `/etc/dovecot/users` y la configuración del `passdb`.
- Si hay un ataque de fuerza bruta, bloquea la IP y revisa `faillock`/logs.
- No cambies la contraseña del sistema si el problema es solo el passdb.

---

## ✅ Verificación

- `doveadm auth test alice alice` responde `auth succeeded`.
- `./scripts/imap.sh alice alice` funciona.
- `bob` sigue funcionando.
- `./scripts/reset.sh` restaura el laboratorio.

---

## 🎓 Prevención

- Provisiona usuarios desde una fuente de verdad (LDAP, base de datos, IdP).
- No edites `/etc/dovecot/users` a mano en producción.
- Usa hashes (`{SHA512-CRYPT}`) en lugar de `{PLAIN}` fuera del laboratorio.
- Valida la autenticación después de cada cambio.
- Monitoriza `auth failed` y alerta ante picos.
- Documenta el formato del passwd-file y sus permisos.

---

## ⚠️ Qué no hacer

- **No desactives la autenticación** para “probar” el buzón.
- **No uses `{PLAIN}`** en un servidor real.
- **No cambies el `mail_location`** sin migrar los buzones.
- **No borres el Maildir** pensando que está corrupto.
- **No olvides `doveadm reload`** tras editar el passwd-file.

---

## 🔗 Referencias internas

- [Laboratorio de correo](/learning-sys-admin-guides-web/labs/email/) — usuarios y comandos.
- [Escenario: permisos de Maildir](/learning-sys-admin-guides-web/scenarios/email/03-maildir-permissions/) — cuando el login funciona pero la entrega falla.
- [Escenario: relay denegado](/learning-sys-admin-guides-web/scenarios/email/04-relay-denied/) — otro fallo de configuración de correo.
