---
title: "🧩 Capstone: guardia nocturna — la web no responde"
level: "Avanzado"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "capstone"
  - label: "Herramientas"
    value: "PostgreSQL, Postfix, PAM, chrony, Terraform, Kubernetes"
  - label: "Archivos"
    value: "`labs/capstone/scripts/break.sh`"
  - label: "Ver laboratorio"
    links:
      - id: "labs/capstone"
        label: "Capstone de guardia"
---

# 🧩 Capstone: guardia nocturna — la web no responde

---

## 🎯 Problema

Son las 02:07 y estás de guardia. En diez minutos llegan varias alertas:

```text
02:07  web: 502 intermitente, latencia alta
02:09  pedidos: errores de conexión a PostgreSQL
02:12  correo: cola de alertas creciendo
02:15  acceso: un operador no puede entrar por contraseña
02:18  logs: marcas de tiempo inconsistentes
02:21  iac: drift detectado en el servicio web
02:24  k8s: service sin endpoints
```

No es un solo incidente con una sola causa. Son fallos independientes que coinciden en la misma guardia. Tu trabajo es **delimitar, priorizar, reparar y cerrar con evidencia**, sin reiniciar todo a ciegas.

---

## ⚡ Quick command (SRE)

```bash
cd public/labs/capstone
./scripts/briefing.sh
./scripts/stage.sh
./scripts/break.sh all
./scripts/status.sh
```

El escenario completo está en `content/scenarios/capstone/01-night-shift.md`.

---

## ✅ Salida esperada

- `status.sh` muestra los contenedores de los labs y, si existe, el cluster `sysadmin-lab`.
- `break.sh all` inyecta fallos en DB, correo, identidad, tiempo e IaC; K8s solo si `kind` está presente.
- Las verificaciones de los labs fallan de forma distinta, no todas por la misma razón.
- `verify.sh` del capstone sigue en rojo hasta que repares cada dominio.
- `reset.sh` devuelve todo a un estado limpio (y elimina el estado de los labs).

---

## 🧠 Diagnóstico

### 1. Delimitar el alcance

Antes de tocar nada:

```bash
cd public/labs/capstone
./scripts/status.sh
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

Separa tres preguntas:

1. **¿Qué está caído?** web, DB, correo, acceso, métricas.
2. **¿Qué está degradado?** latencia, cola, drift, tiempo.
3. **¿Qué es consecuencia y qué es causa?** un 502 puede ser red, DB, endpoints o TLS.

### 2. Guardar evidencia

```bash
mkdir -p /tmp/capstone
cd public/labs/capstone
./scripts/status.sh > /tmp/capstone/status.txt 2>&1 || true
docker compose -f ../db/docker-compose.yml ps > /tmp/capstone/db.txt 2>&1 || true
docker compose -f ../email/docker-compose.yml exec -T mail mailq > /tmp/capstone/mailq.txt 2>&1 || true
docker compose -f ../identity/docker-compose.yml exec -T identity faillock --user learner > /tmp/capstone/faillock.txt 2>&1 || true
docker compose -f ../time/docker-compose.yml exec -T time-client chronyc tracking > /tmp/capstone/chrony.txt 2>&1 || true
( cd ../iac/terraform && terraform plan -detailed-exitcode ) > /tmp/capstone/tfplan.txt 2>&1 || true
```

No reinicies los servicios todavía. Los logs y el estado son tu única pista.

### 3. Orden de triaje

| Prioridad | Dominio | Por qué |
|---|---|---|
| 1 | DB | Sin conexiones, la web y los pedidos fallan primero |
| 2 | Correo | La cola crece y las alertas se pierden |
| 3 | Identidad | Sin acceso, no puedes administrar el resto |
| 4 | Tiempo | Afecta logs, TLS y correlación |
| 5 | IaC | El drift puede reintroducir el fallo |
| 6 | K8s | Depende de que la app y la red estén sanas |

Ajusta el orden si tu evidencia muestra otra cosa; lo importante es justificarlo.

---

## 🛠️ Procedimiento (runbook)

### Fase 1 — Datos y correo

#### 1.1 PostgreSQL sin conexiones

```bash
cd public/labs/db
./scripts/psql.sh -c 'select 1'
```

Salida típica:

```text
FATAL: remaining connection slots are reserved for roles with the SUPERUSER attribute
```

Comprueba las conexiones:

```bash
docker compose exec -T postgres-primary psql -U postgres -d app -c \
  "select pid, usename, state, query from pg_stat_activity where datname='app';"
```

El escenario deja `pgbench` consumiendo conexiones. Libera el ejercicio:

```bash
./scripts/reset.sh 01
./scripts/psql.sh -c 'select 1'
```

Si el consumo es real, identifica el cliente y limita su pool; no mates conexiones al azar.

#### 1.2 Cola de correo diferida

```bash
cd public/labs/email
docker compose exec -T mail mailq
docker compose exec -T mail tail -n 30 /var/log/mail.log
```

El escenario rompe `mydestination` y apunta a un relay inexistente. Repara:

```bash
docker compose exec -T mail postconf -e \
  'mydestination = lab.local, localhost, localhost.localdomain'
docker compose exec -T mail postconf -e 'relayhost ='
docker compose exec -T mail postfix reload
docker compose exec -T mail postqueue -f
docker compose exec -T mail mailq
```

La cola debe vaciarse. Envía un correo de prueba:

```bash
./scripts/send.sh alice@lab.local "Prueba capstone" "Entrega local"
./scripts/imap.sh alice alice
```

### Fase 2 — Acceso y tiempo

#### 2.1 Cuenta bloqueada por PAM

```bash
cd public/labs/identity
./scripts/ssh.sh learner 'id'
ssh -p 2222 -o PubkeyAuthentication=no \
  -o PreferredAuthentications=password learner@127.0.0.1 'id'
```

La clave puede seguir entrando; la contraseña está bloqueada. Revisa y desbloquea:

```bash
./scripts/exec.sh
faillock --user learner
faillock --user learner --reset
exit
```

Verifica que la contraseña ya funciona. Si el bloqueo es por ataque, bloquea la IP antes de desbloquear la cuenta.

#### 2.2 Cliente NTP sin sincronizar

```bash
cd public/labs/time
docker compose exec -T time-client chronyc tracking
docker compose exec -T time-client chronyc sources -v
```

El escenario apunta el cliente a `ntp-offline`. Restaura la configuración:

```bash
docker compose exec -T time-client cp /etc/chrony/client.conf.bak /etc/chrony/client.conf
docker compose restart time-client
./scripts/verify.sh
```

Espera a `Leap status: Normal`. Si no vuelve, revisa que el servidor NTP esté arriba y que la ACL lo permita.

### Fase 3 — Infraestructura y entrega

#### 3.1 Drift de Terraform

```bash
cd public/labs/iac
( cd terraform && terraform plan -detailed-exitcode )
```

`exit 2` significa que hay cambios pendientes. Aplica:

```bash
( cd terraform && terraform apply -auto-approve )
curl -fsS http://127.0.0.1:8088/ | grep -o '<title>[^<]*</title>'
```

Si el plan falla por state, restaura `terraform.tfstate.valid` antes de aplicar.

#### 3.2 Service sin endpoints (opcional)

```bash
kubectl -n k8s-lab get pods,svc,endpoints
kubectl -n k8s-lab describe svc web
```

El capstone parchea el selector del Service `web` para que no coincida con las etiquetas de los pods. Diagnostica:

```bash
kubectl -n k8s-lab get endpoints web
kubectl -n k8s-lab get pods --show-labels
```

Corrige el selector:

```bash
kubectl -n k8s-lab patch svc web --type=merge   -p '{"spec":{"selector":{"app":"web"}}}'
kubectl -n k8s-lab get endpoints web
```

Verifica que la app responde por el ingress o por `kubectl port-forward`.

### Fase 4 — Cierre

```bash
cd public/labs/capstone
./scripts/verify.sh
```

Si sigue en rojo, vuelve al dominio que falla; no reinicies todo. Cuando esté verde:

1. Escribe el postmortem.
2. Anota las acciones preventivas.
3. Restaura los labs:

```bash
./scripts/reset.sh
```

---

## 🧯 Mitigación

- **DB:** limita `max_connections` por rol, usa PgBouncer y alerta sobre `pg_stat_activity`.
- **Correo:** monitoriza `mailq` y la tasa de rebotes; valida `postconf` en staging.
- **Identidad:** alerta sobre bloqueos masivos; ten un break-glass y MFA.
- **Tiempo:** monitoriza `chronyc tracking` y la deriva; NTP no es opcional para logs/TLS.
- **IaC:** ejecuta `plan -detailed-exitcode` en CI y alerta sobre drift.
- **K8s:** valida `endpoints` en smoke tests, no solo `pods Running`.

---

## ✅ Verificación

```bash
cd public/labs/capstone
./scripts/verify.sh
```

Criterios:

- DB acepta `select 1` como `app`.
- `mailq` vacía y entrega local OK.
- `learner` entra por contraseña; `admin` usa sudo.
- `chronyc tracking` con `Leap status: Normal`.
- `terraform plan -detailed-exitcode` devuelve `0`.
- Si hay K8s, el Service tiene endpoints y la app responde.
- Postmortem escrito.

---

## 🎓 Postmortem

Incluye:

| Bloque | Pregunta |
|---|---|
| Timeline | ¿Qué pasó y en qué orden? |
| Impacto | ¿A quién y cuánto afectó? |
| Causas | ¿Qué falló exactamente en cada dominio? |
| Factores | ¿Qué permitió que coincidieran o tardaran en detectarse? |
| Detección | ¿Qué alerta faltó o llegó tarde? |
| Acciones | ¿Qué cambiamos para que no se repita? |

Ejemplo de acción: “alertar cuando `pg_stat_activity` supera el 80 % de `max_connections` durante 5 minutos”.

---

## ⚠️ Qué no hacer

- **No ejecutes `reset.sh` al principio**: borras la evidencia y el ejercicio.
- **No reinicies todos los contenedores** por el 502; el problema puede ser de datos o red.
- **No desactives PAM, `StrictModes` ni `sudoers`** para “salir del paso”.
- **No asumas una causa única**: hay fallos independientes a propósito.
- **No ignores el reloj**: la deriva rompe logs, TLS y la correlación.
- **No cierres sin verificación ni postmortem.**

---

## 🔗 Referencias internas

- [Capstone de guardia](/learning-sys-admin-guides-web/labs/capstone/) — preparación y comandos.
- [Postmortem sin culpables](/learning-sys-admin-guides-web/concepts/post-mortem-blameless/) — cómo escribir el cierre.
- [Laboratorio de bases de datos](/learning-sys-admin-guides-web/labs/databases/) — conexiones y recuperación.
- [Laboratorio de correo](/learning-sys-admin-guides-web/labs/email/) — cola y entrega.
- [Laboratorio de identidad](/learning-sys-admin-guides-web/labs/identity-access/) — PAM y sudo.
- [Laboratorio de tiempo](/learning-sys-admin-guides-web/labs/time/) — NTP.
- [Laboratorio de IaC](/learning-sys-admin-guides-web/labs/iac/) — drift y state.
