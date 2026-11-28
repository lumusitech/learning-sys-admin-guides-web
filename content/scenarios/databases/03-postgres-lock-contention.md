---
title: "🧩 Escenario: bloqueos y deadlocks en PostgreSQL"
level: "Intermedio"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "databases"
  - label: "Herramientas"
    value: "`psql`, `docker compose`"
  - label: "Archivos"
    value: "`labs/db/postgres/primary/01-init.sql`"
  - label: "Ver laboratorio"
    links:
      - id: "labs/databases"
        label: "Laboratorio de bases de datos"
---

# 🧩 Escenario: bloqueos y deadlocks en PostgreSQL

---

## 🎯 Problema

Un `UPDATE` se queda esperando indefinidamente y la aplicación acumula timeouts. Otra transacción mantiene el lock de la misma fila sin terminar. En el peor caso, dos transacciones se bloquean mutuamente y PostgreSQL aborta una con `deadlock detected`. Hay que identificar al bloqueador, decidir si se cancela o se espera y corregir el patrón de acceso.

---

## ⚡ Quick command (SRE)

```bash
docker compose exec -T postgres-primary psql -U app -d app -c \
  "SELECT pid, state, wait_event_type, wait_event,
          now() - xact_start AS tx_age, left(query, 90) AS query
   FROM pg_stat_activity
   WHERE datname = 'app' AND backend_type = 'client backend'
   ORDER BY xact_start;"
```

---

## ✅ Salida esperada

- Una conexión en `active` con `wait_event_type = Lock` y `wait_event = transactionid` o `tuple`.
- Otra conexión en `active` o `idle in transaction` que mantiene el lock.
- `now() - xact_start` crece en la conexión bloqueada.
- En el log, `deadlock detected` si dos transacciones se esperan en círculo.
- La aplicación recibe un timeout o un error `canceling statement due to lock timeout`.

---

## 🧠 Diagnóstico

PostgreSQL no bloquea filas al leer: bloquea al escribir. Un `UPDATE` toma un lock `FOR UPDATE` sobre las filas afectadas y lo mantiene hasta el `COMMIT` o `ROLLBACK`. Cualquier otra transacción que intente escribir las mismas filas espera.

Las vistas clave son:

- **`pg_stat_activity`**: quién está esperando y desde cuándo.
- **`pg_locks`**: qué lock concreto se pide y si está concedido.
- **`pg_blocking_pids(pid)`**: qué procesos bloquean a uno dado.

Un **deadlock** es un ciclo de esperas: A espera a B y B espera a A. PostgreSQL lo detecta tras `deadlock_timeout` (1 segundo por defecto) y aborta una de las transacciones para romper el ciclo. El error es `deadlock detected` con SQLSTATE `40P01`.

Un **lock timeout** es distinto: la transacción espera más de `lock_timeout` y se cancela con SQLSTATE `55P03`. Es una protección, no un deadlock.

En el laboratorio, `break.sh 03` abre una transacción que actualiza `orders.id = 1` y duerme 10 minutos. Cualquier `UPDATE` sobre esa fila se queda esperando.

---

## 🛠️ Procedimiento (runbook)

### 1. Reproducir el bloqueo

```bash
./scripts/break.sh 03

# En otra terminal: esta consulta se queda colgada
./scripts/psql.sh -c "UPDATE orders SET status = 'blocked' WHERE id = 1;"
```

### 2. Ver la cadena de bloqueo

```bash
docker compose exec -T postgres-primary psql -U app -d app -c \
  "SELECT pid, pg_blocking_pids(pid) AS bloqueadores,
          state, wait_event_type, wait_event,
          now() - xact_start AS tx_age, left(query, 90) AS query
   FROM pg_stat_activity
   WHERE datname = 'app' AND cardinality(pg_blocking_pids(pid)) > 0;"
```

`bloqueadores` es un array de PIDs. Si está vacío pero la consulta espera, revisa `pg_locks` y el tipo de espera.

### 3. Inspeccionar los locks

```bash
docker compose exec -T postgres-primary psql -U app -d app -c \
  "SELECT l.pid, l.locktype, l.mode, l.granted,
          l.relation::regclass AS relation, l.transactionid
   FROM pg_locks l
   WHERE l.pid IN (SELECT pid FROM pg_stat_activity WHERE datname = 'app')
   ORDER BY l.granted, l.pid;"
```

### 4. Decidir: esperar, cancelar o terminar

- Si la transacción bloqueante es corta y legítima, espera.
- Si está atascada, primero `pg_cancel_backend(pid)` (cancela la consulta actual).
- Si no responde, `pg_terminate_backend(pid)` (cierra la conexión y revierte la transacción).

```bash
docker compose exec -T postgres-primary psql -U postgres -d app -c \
  "SELECT pg_cancel_backend(<pid_bloqueador>);"

# Si no cede
docker compose exec -T postgres-primary psql -U postgres -d app -c \
  "SELECT pg_terminate_backend(<pid_bloqueador>);"
```

### 5. Resetear el laboratorio

```bash
./scripts/reset.sh 03
```

El reset termina la transacción que contiene `pg_sleep`.

### 6. Provocar un deadlock (opcional)

Abre dos sesiones con `./scripts/psql.sh`:

```sql
-- Sesión A
BEGIN;
UPDATE orders SET status = 'a' WHERE id = 1;

-- Sesión B
BEGIN;
UPDATE orders SET status = 'b' WHERE id = 2;

-- Sesión A: espera a B
UPDATE orders SET status = 'a2' WHERE id = 2;

-- Sesión B: cierra el ciclo; una de las dos recibe deadlock detected
UPDATE orders SET status = 'b2' WHERE id = 1;
```

Una transacción se aborta con `ERROR: deadlock detected`. La otra puede continuar.

---

## 🧯 Mitigación

1. **Identifica al bloqueador** con `pg_blocking_pids` antes de tocar nada.
2. **Cancela** con `pg_cancel_backend` si la consulta es larga pero recuperable.
3. **Termina** con `pg_terminate_backend` si la sesión quedó en `idle in transaction` o no responde.
4. **Baja el alcance**: si el bloqueo afecta a una sola fila, el resto del servicio puede seguir. Evita reiniciar la base como primera medida.
5. **Configura timeouts** para que el problema no sea infinito:
   - `lock_timeout` en la aplicación o en el rol.
   - `statement_timeout` para consultas que no deben durar más de lo razonable.
   - `idle_in_transaction_session_timeout` para transacciones abandonadas.

```sql
-- Ejemplo a nivel de sesión
SET lock_timeout = '5s';
SET statement_timeout = '30s';
```

---

## ✅ Verificación

- `pg_stat_activity` no muestra conexiones con `wait_event_type = Lock`.
- El `UPDATE` pendiente completa o se cancela con un error claro.
- La aplicación puede escribir en `orders`.
- No quedan transacciones `idle in transaction` de la sesión bloqueante.
- El log no repite `deadlock detected` con el mismo par de consultas.

---

## 🎓 Prevención

- Mantén las transacciones cortas: no abras una transacción y esperes una llamada HTTP dentro de ella.
- Accede a las filas en un orden consistente entre transacciones; el deadlock suele venir de órdenes distintos.
- Implementa reintentos con backoff para SQLSTATE `40001` (serialization failure) y `40P01` (deadlock).
- Activa `log_lock_waits = on` y revisa `deadlock_timeout`; el log te dice qué consultas compiten.
- Alerta sobre transacciones `idle in transaction` mayores de un minuto.
- Revisa los planes de las consultas que actualizan muchas filas: un `UPDATE` sin índice bloquea más de lo necesario.

---

## 🚫 Qué no hacer

- Matar todas las conexiones de la base: pierdes transacciones y evidencia.
- Terminar una conexión `active` sin mirar la consulta: puedes interrumpir una migración o un pago.
- Reintentar un deadlock en bucle sin backoff: multiplicas la contención.
- Dejar transacciones abiertas mientras se espera a un servicio externo.
- Ignorar `idle in transaction`: retiene locks y bloquea el vacuum.

---

## 🔗 Referencias internas

- [Laboratorio de bases de datos](/learning-sys-admin-guides-web/labs/databases/) — setup, break y reset.
- [Conexiones agotadas](/learning-sys-admin-guides-web/scenarios/databases/01-postgres-connection-exhaustion/) — las conexiones idle también retienen locks.
- [Backpressure](/learning-sys-admin-guides-web/concepts/backpressure/) — acumulación de trabajo y timeouts.
- [Docker](/learning-sys-admin-guides-web/guides/docker/) — ejecutar clientes dentro de los contenedores.
