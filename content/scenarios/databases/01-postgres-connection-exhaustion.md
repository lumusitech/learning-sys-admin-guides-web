---
title: "🧩 Escenario: PostgreSQL sin conexiones — slots agotados"
level: "Intermedio"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "databases"
  - label: "Herramientas"
    value: "`psql`, `pgbench`, `docker compose`"
  - label: "Archivos"
    value: "`labs/db/docker-compose.yml`"
  - label: "Ver laboratorio"
    links:
      - id: "labs/databases"
        label: "Laboratorio de bases de datos"
---

# 🧩 Escenario: PostgreSQL sin conexiones — slots agotados

---

## 🎯 Problema

La aplicación no puede abrir nuevas conexiones a PostgreSQL. Según cuántos slots queden, el error puede ser `FATAL: remaining connection slots are reserved for roles with the SUPERUSER attribute` (quedan slots reservados) o `FATAL: sorry, too many clients already` (no queda ninguno). El servicio sigue vivo y las conexiones existentes responden, pero cualquier cliente nuevo falla. Hay que distinguir si el problema es un límite de `max_connections`, un pool mal dimensionado, conexiones idle que nadie cierra o una fuga de conexiones en la aplicación.

---

## ⚡ Quick command (SRE)

```bash
docker compose exec -T postgres-primary psql -U postgres -d app \
  -c "SELECT state, count(*) FROM pg_stat_activity GROUP BY state ORDER BY count(*) DESC;"
```

---

## ✅ Salida esperada

- La suma de conexiones de `app` se acerca a 17 (los slots no reservados).
- `SHOW max_connections` devuelve `20`.
- `superuser_reserved_connections` reserva 3 slots para `postgres`; `app` es un rol normal y solo puede usar los otros 17.
- La app muestra `FATAL: remaining connection slots are reserved for roles with the SUPERUSER attribute`; si también se llenan los slots reservados, pasa a `FATAL: sorry, too many clients already`.
- `psql -U postgres` todavía puede entrar por los slots reservados.
- En `pg_stat_activity` aparecen muchas conexiones del mismo usuario o cliente.

Comprueba el límite y el reparto:

```bash
docker compose exec -T postgres-primary psql -U postgres -d app \
  -c "SHOW max_connections;" \
  -c "SHOW superuser_reserved_connections;" \
  -c "SELECT usename, client_addr, state, count(*) FROM pg_stat_activity GROUP BY 1,2,3 ORDER BY 4 DESC;"
```

---

## 🧠 Diagnóstico

Cada conexión de PostgreSQL es un proceso del sistema con memoria propia. `max_connections` es un techo global, no un objetivo: subirlo sin RAM disponible solo mueve el problema al kernel o al OOM killer.

La vista `pg_stat_activity` es la fuente de verdad:

- `state`: `active`, `idle`, `idle in transaction`, `idle in transaction (aborted)`.
- `state_change`: cuándo cambió de estado; una conexión `idle` durante horas es sospechosa.
- `query_start`: cuándo empezó la consulta actual.
- `client_addr`: desde qué host llega; útil para separar app, pooler y operadores.
- `backend_type`: distingue client backend, autovacuum, walsender, etc.

Dos estados concentran los incidentes:

1. **`idle`**: la conexión está abierta pero sin trabajo. Es normal en un pool; es un problema si el pool es más grande que la necesidad real.
2. **`idle in transaction`**: la transacción quedó abierta sin hacer nada. Además de ocupar un slot, retiene locks y bloquea el vacuum.

En el laboratorio, `pgbench -c 17` ocupa exactamente los 17 slots disponibles para `app`. Con esos slots llenos, `psql -U app` recibe `remaining connection slots are reserved for roles with the SUPERUSER attribute`; si además se llenan los 3 slots de `postgres`, el error pasa a `sorry, too many clients already`. `psql -U postgres` puede entrar por los reservados. Esa diferencia entre rol normal y superusuario es parte del ejercicio.

---

## 🛠️ Procedimiento (runbook)

### 1. Medir el consumo actual

```bash
docker compose exec -T postgres-primary psql -U postgres -d app -c \
  "SELECT count(*) AS total, count(*) FILTER (WHERE state = 'idle') AS idle,
          count(*) FILTER (WHERE state = 'idle in transaction') AS idle_tx
   FROM pg_stat_activity WHERE backend_type = 'client backend';"
```

### 2. Ver quién ocupa los slots

```bash
docker compose exec -T postgres-primary psql -U postgres -d app -c \
  "SELECT pid, usename, client_addr, state, now() - state_change AS en_estado,
          left(query, 80) AS query
   FROM pg_stat_activity
   WHERE backend_type = 'client backend'
   ORDER BY state_change;"
```

### 3. Reproducir el incidente en el laboratorio

```bash
./scripts/break.sh 01
./scripts/psql.sh
```

La segunda orden debería fallar con `remaining connection slots are reserved for roles with the SUPERUSER attribute`. `break.sh 01` deja `pgbench` corriendo 10 minutos con 17 clientes.

### 4. Liberar slots sin matar trabajo legítimo

```bash
# Mira primero qué vas a cerrar
docker compose exec -T postgres-primary psql -U postgres -d app -c \
  "SELECT pid, usename, state, now() - state_change AS en_estado, left(query, 80)
   FROM pg_stat_activity
   WHERE state = 'idle' AND backend_type = 'client backend';"

# Cierra solo conexiones idle (no active); usa el superusuario para administrar
docker compose exec -T postgres-primary psql -U postgres -d app -c \
  "SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE state = 'idle' AND backend_type = 'client backend'
     AND pid <> pg_backend_pid();"
```

### 5. Parar la carga del laboratorio

```bash
./scripts/reset.sh 01
```

El reset termina las conexiones y borra las tablas de `pgbench`.

### 6. Conectar de nuevo y confirmar

```bash
./scripts/psql.sh -c "SELECT count(*) FROM orders;"
```

---

## 🧯 Mitigación

El orden importa: primero se restaura el servicio y después se investiga la causa.

1. **Detén la carga**: en el laboratorio, `./scripts/reset.sh 01`; en producción, pausa el job o el pool que está abriendo conexiones.
2. **Cierra solo conexiones idle**: `pg_terminate_backend` sobre `state = 'idle'`; nunca sobre `active` sin confirmar la consulta.
3. **Revisa `idle in transaction`**: si hay transacciones abiertas, identifica la aplicación y corrígelas; matarlas puede revertir trabajo en curso.
4. **Ajusta el pool de la aplicación**: el tamaño máximo del pool debe caber en `max_connections` (restando `superuser_reserved_connections` si la aplicación no es superusuario), descontando los pools de otros servicios.
5. **Considera un pooler** (PgBouncer) si hay muchos clientes efímeros; el pooler multiplexa conexiones y reduce el consumo.

Subir `max_connections` es la última opción: cada backend consume memoria y el cambio requiere reinicio. Si lo haces, calcula la RAM disponible antes:

```sql
-- Estimación conservadora: cada backend puede usar trabajo + buffers
SHOW shared_buffers;
SHOW work_mem;
```

---

## ✅ Verificación

- `SELECT count(*) FROM pg_stat_activity` está por debajo de `max_connections`.
- `./scripts/psql.sh -c "SELECT 1;"` responde.
- La aplicación abre conexiones nuevas sin errores de slots.
- No quedan procesos `pgbench` en `pg_stat_activity`.
- `pg_stat_database.numbackends` vuelve a un valor estable.

---

## 🎓 Prevención

- Dimensiona el pool con una fórmula explícita y súmala entre réplicas, workers y jobs.
- Configura `idle_session_timeout` e `idle_in_transaction_session_timeout` en la base o en el pooler.
- Alerta al 80 % de `max_connections` y sobre conexiones `idle in transaction` mayores de un minuto.
- Prueba el sistema con la carga real: un pool que funciona en staging con 10 usuarios puede fallar con 200.
- No uses el usuario superusuario para la aplicación; el laboratorio usa `app` como rol normal y `postgres` solo para administración.

---

## 🚫 Qué no hacer

- Ejecutar `pg_terminate_backend` sobre todas las conexiones: cortas transacciones y pierdes evidencia.
- Subir `max_connections` a 1.000 sin RAM ni revisar el resto de la cadena.
- Reiniciar PostgreSQL como primera acción: tira todas las conexiones y no corrige el pool.
- Ignorar `idle in transaction`: ocupa un slot, retiene locks y frena el vacuum.
- Medir solo con `SELECT 1`: una conexión de prueba no reproduce la carga real.

---

## 🔗 Referencias internas

- [Laboratorio de bases de datos](/learning-sys-admin-guides-web/labs/databases/) — setup, break y reset.
- [Bloqueos y deadlocks](/learning-sys-admin-guides-web/scenarios/databases/03-postgres-lock-contention/) — el siguiente síntoma de las transacciones abiertas.
- [Backpressure](/learning-sys-admin-guides-web/concepts/backpressure/) — qué pasa cuando la demanda supera la capacidad.
- [Docker](/learning-sys-admin-guides-web/guides/docker/) — Compose, volúmenes y logs.
