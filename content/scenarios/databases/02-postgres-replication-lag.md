---
title: "🧩 Escenario: réplica PostgreSQL retrasada o caída"
level: "Intermedio"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "databases"
  - label: "Herramientas"
    value: "`psql`, `docker compose`"
  - label: "Archivos"
    value: "`labs/db/postgres/replica/bootstrap.sh`"
  - label: "Ver laboratorio"
    links:
      - id: "labs/databases"
        label: "Laboratorio de bases de datos"
---

# 🧩 Escenario: réplica PostgreSQL retrasada o caída

---

## 🎯 Problema

Las lecturas contra la réplica devuelven datos viejos o fallan, mientras el primario sigue aceptando escrituras. `pg_stat_replication` puede estar vacío, la réplica puede estar detenida o el retraso de replay crece sin límite. Hay que decidir si se reinicia, se reconstruye o se saca de rotación antes de que el primario recicle el WAL que la réplica necesita o de que un slot inactivo llene el disco.

---

## ⚡ Quick command (SRE)

```bash
docker compose ps postgres-replica
docker compose exec -T postgres-primary psql -U app -d app \
  -c "SELECT client_addr, state, sent_lsn, replay_lsn, replay_lag FROM pg_stat_replication;"
```

---

## ✅ Salida esperada

Con la réplica sana:

- `docker compose ps` muestra `postgres-replica` como `running` y `healthy`.
- `pg_stat_replication` tiene una fila con `state = streaming`.
- `replay_lag` es de milisegundos o segundos, no de minutos.
- La réplica responde `SELECT pg_is_in_recovery()` con `t`.

Con la réplica caída o retrasada:

- `pg_stat_replication` devuelve 0 filas.
- `docker compose ps` muestra el contenedor `exited` o `unhealthy`.
- `pg_wal` puede crecer si hay un replication slot o retención configurada; sin slot, el primario recicla WAL y la réplica puede quedarse sin lo que necesita.
- La réplica responde con datos antiguos o no responde.

---

## 🧠 Diagnóstico

PostgreSQL usa replicación física por streaming:

1. El primario escribe WAL.
2. Un proceso `walsender` lo envía a la réplica.
3. La réplica lo recibe (`walreceiver`) y lo aplica (`startup`).

El retraso se mide en dos puntos distintos:

- **Retraso de recepción**: el WAL aún no llegó a la réplica (`pg_last_wal_receive_lsn`).
- **Retraso de replay**: el WAL llegó pero no se aplicó (`pg_last_wal_replay_lsn` y `pg_last_xact_replay_timestamp`).

Un `pg_stat_replication` vacío significa que no hay ningún `walsender` conectado: la réplica no está hablando con el primario. Puede ser red, credenciales, un `pg_hba.conf` mal configurado, el contenedor detenido o un fallo de disco.

Si el primario recicla WAL que la réplica todavía necesita, la réplica no puede recuperarse sola: hay que reconstruirla con `pg_basebackup`.

---

## 🛠️ Procedimiento (runbook)

### 1. Comprobar el estado de los contenedores

```bash
docker compose ps
docker compose logs --tail=80 postgres-replica
```

Busca `could not connect`, `replication slot`, `requested WAL segment ... has already been removed` o errores de disco.

### 2. Medir el retraso desde el primario

```bash
docker compose exec -T postgres-primary psql -U app -d app -c \
  "SELECT client_addr, state, sync_state,
          pg_wal_lsn_diff(pg_current_wal_lsn(), sent_lsn)   AS pendiente_envio,
          pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) AS pendiente_replay,
          write_lag, flush_lag, replay_lag
   FROM pg_stat_replication;"
```

`pendiente_replay` en bytes es más útil que un `replay_lag` que puede quedar en `NULL` si no hay transacciones nuevas.

### 3. Medir el retraso desde la réplica

```bash
docker compose exec -T postgres-replica psql -U app -d app -c \
  "SELECT pg_is_in_recovery() AS replica,
          pg_last_wal_receive_lsn() AS recibido,
          pg_last_wal_replay_lsn()  AS aplicado,
          now() - pg_last_xact_replay_timestamp() AS lag;"
```

Si la réplica está en recovery, `pg_last_xact_replay_timestamp()` devuelve la última transacción aplicada. Un `lag` en `NULL` sin tráfico nuevo no significa que la réplica esté rota: compara los LSN.

### 4. Reproducir el incidente en el laboratorio

```bash
./scripts/break.sh 02
docker compose ps
docker compose exec -T postgres-primary psql -U app -d app -c \
  "SELECT count(*) FROM pg_stat_replication;"
```

El resultado debe ser `0`: la réplica está detenida y el primario ya no tiene `walsender`.

### 5. Recuperar la réplica

```bash
./scripts/reset.sh 02
./scripts/verify.sh
```

El reset arranca el contenedor y espera a que acepte conexiones. Si el retraso es grande, la réplica aplicará el WAL pendiente; si el WAL ya no existe, el arranque fallará y habrá que reconstruir.

### 6. Reconstruir si divergió

```bash
docker compose rm -sf postgres-replica
docker volume rm sysadmin-db-lab_pg_replica_data
docker compose up -d postgres-replica
```

El `bootstrap.sh` detecta que `PGDATA` está vacío y ejecuta `pg_basebackup -R` contra el primario. Es la misma operación que se hace en producción con una réplica nueva.

---

## 🧯 Mitigación

1. **Saca la réplica de rotación** si las lecturas son críticas; el primario puede absorberlas temporalmente.
2. **Comprueba el disco y el WAL del primario**: un replication slot inactivo o una retención mal dimensionada pueden llenar `pg_wal`. Mira `SELECT pg_size_pretty(sum(size)) FROM pg_ls_waldir();` y `SELECT * FROM pg_replication_slots;`.
3. **Reinicia la réplica** si el problema fue el contenedor o la red.
4. **Reconstruye** si el WAL necesario ya no existe; no intentes “arreglar” un `pg_wal` borrado a mano.
5. **No promociones** la réplica sin una decisión explícita: una promoción mal hecha crea dos primarios y riesgo de split-brain.

En el laboratorio, `./scripts/reset.sh 02` cubre el caso de contenedor detenido. La reconstrucción se hace con los comandos del paso 6.

---

## ✅ Verificación

- `pg_stat_replication` tiene una fila con `state = streaming`.
- El retraso de replay es estable y bajo.
- La réplica responde `SELECT count(*) FROM orders;`.
- El tamaño de `pg_wal` y de los slots vuelve a un valor estable.
- La aplicación puede leer de la réplica sin datos inesperadamente viejos.

---

## 🎓 Prevención

- Alerta sobre `pg_stat_replication` vacío y sobre `replay_lag` por encima del umbral del negocio.
- Monitoriza el tamaño de `pg_wal` y el espacio libre; un slot inactivo o una retención mal configurada llenan el disco.
- Si usas replication slots, vigila `restart_lsn`: un slot inactivo retiene WAL para siempre.
- Prueba la reconstrucción de una réplica en un entorno desechable; el día del incidente no es el momento de aprender el procedimiento.
- Documenta qué lecturas toleran datos viejos y cuáles deben ir siempre al primario.

---

## 🚫 Qué no hacer

- Borrar segmentos de `pg_wal` a mano para liberar espacio: rompes la replicación y la recuperación.
- Promover la réplica sin comprobar el estado del primario y sin coordinación.
- Escribir en la réplica: es de solo lectura y el error no arregla el retraso.
- Ignorar el retraso porque “la réplica siempre va un poco por detrás”: un retraso creciente es un incidente.
- Reconstruir sin haber revisado los logs: puedes repetir la misma causa.

---

## 🔗 Referencias internas

- [Laboratorio de bases de datos](/learning-sys-admin-guides-web/labs/databases/) — setup, break y reset.
- [Conexiones agotadas](/learning-sys-admin-guides-web/scenarios/databases/01-postgres-connection-exhaustion/) — otro límite que aparece bajo carga.
- [Stateful vs stateless](/learning-sys-admin-guides-web/concepts/stateful-vs-stateless/) — por qué la réplica no es un contenedor desechable cualquiera.
- [Docker](/learning-sys-admin-guides-web/guides/docker/) — logs, volúmenes y Compose.
