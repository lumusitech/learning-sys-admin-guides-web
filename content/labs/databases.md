---
title: "🧪 Laboratorio de bases de datos — Incidentes con Compose"
section: "labs"
meta:
  - label: "Requisitos"
    value: "`docker`, `docker compose` v2"
  - label: "Herramientas"
    value: "`psql`, `mysql`, `redis-cli`, `mongosh`, `pgbench`"
  - label: "Escenarios relacionados"
    links:
      - id: "scenarios/databases/01-postgres-connection-exhaustion"
        label: "DB/01 Conexiones agotadas"
      - id: "scenarios/databases/02-postgres-replication-lag"
        label: "DB/02 Réplica retrasada"
      - id: "scenarios/databases/03-postgres-lock-contention"
        label: "DB/03 Bloqueos y deadlocks"
      - id: "scenarios/databases/04-mysql-slow-query"
        label: "DB/04 Consulta lenta en MySQL"
      - id: "scenarios/databases/05-redis-memory-eviction"
        label: "DB/05 Evicción en Redis"
      - id: "scenarios/databases/06-postgres-backup-restore"
        label: "DB/06 Restore de PostgreSQL"
      - id: "scenarios/databases/07-mongodb-slow-query"
        label: "DB/07 Consulta lenta en MongoDB"
      - id: "scenarios/databases/08-mongodb-connection-exhaustion"
        label: "DB/08 Conexiones agotadas en MongoDB"
      - id: "scenarios/databases/09-mongodb-replica-lag"
        label: "DB/09 Réplica de MongoDB"
---

# 🧪 Laboratorio de bases de datos — Incidentes con Compose

---

## 🎯 Cuándo usar esta sección

Para practicar incidentes de bases de datos en un entorno local y desechable. El laboratorio levanta PostgreSQL (primario y réplica), MySQL, Redis y un replica set de MongoDB de tres nodos con Docker Compose, carga datos de práctica y permite romper cada servicio de forma controlada para entrenar diagnóstico, mitigación y verificación.

Cada incidente tiene su escenario con runbook; el laboratorio aporta el estado roto, los clientes y el reset.

---

## 🔄 Flujo recomendado

1. **Preparar** el stack con `./scripts/setup.sh`.
2. **Romper** el incidente elegido con `./scripts/break.sh <id>`.
3. **Diagnosticar** siguiendo el escenario (conexiones, locks, replicación, slow log, memoria, índices).
4. **Mitigar** y **verificar** que el servicio vuelve a un estado sano.
5. **Resetear** el incidente con `./scripts/reset.sh <id>` antes del siguiente.

---

## 📋 Requisitos

- Docker en ejecución y Docker Compose v2.
- Puertos libres en el host: `55432` (PostgreSQL primario), `55433` (réplica), `53306` (MySQL), `56379` (Redis) y `57017`-`57019` (MongoDB).
- 2 CPU y 3 GB de RAM libres; las imágenes (`postgres:16-alpine`, `mysql:8.4`, `redis:7-alpine`, `mongo:8.0`) se descargan la primera vez.
- La primera vez, la réplica de PostgreSQL se clona con `pg_basebackup`: puede tardar uno o dos minutos.
- MongoDB se inicializa con un replica set de tres nodos y 200.000 documentos de práctica.

```bash
docker info >/dev/null && echo "Docker OK"
docker compose version
```

---

## 🧩 Incidentes disponibles

| # | Escenario | Síntoma | Guía |
|---|---|---|---|
| 01 | Conexiones agotadas | La app no puede conectarse: slots reservados o `too many clients` | [DB/01](/learning-sys-admin-guides-web/scenarios/databases/01-postgres-connection-exhaustion/) |
| 02 | Réplica retrasada o caída | Lecturas viejas y `pg_stat_replication` vacío | [DB/02](/learning-sys-admin-guides-web/scenarios/databases/02-postgres-replication-lag/) |
| 03 | Bloqueos y deadlocks | Un `UPDATE` se queda esperando | [DB/03](/learning-sys-admin-guides-web/scenarios/databases/03-postgres-lock-contention/) |
| 04 | Consulta lenta en MySQL | `EXPLAIN` muestra un full scan | [DB/04](/learning-sys-admin-guides-web/scenarios/databases/04-mysql-slow-query/) |
| 05 | Evicción en Redis | `evicted_keys` crece y baja el hit rate | [DB/05](/learning-sys-admin-guides-web/scenarios/databases/05-redis-memory-eviction/) |
| 06 | Pérdida de datos | La tabla quedó vacía y hay que restaurar | [DB/06](/learning-sys-admin-guides-web/scenarios/databases/06-postgres-backup-restore/) |
| 07 | Consulta lenta en MongoDB | `explain` muestra un `COLLSCAN` | [DB/07](/learning-sys-admin-guides-web/scenarios/databases/07-mongodb-slow-query/) |
| 08 | Conexiones agotadas en MongoDB | El primario rechaza escrituras por `maxConns` | [DB/08](/learning-sys-admin-guides-web/scenarios/databases/08-mongodb-connection-exhaustion/) |
| 09 | Réplica de MongoDB caída | `rs.status` muestra un secundario caído | [DB/09](/learning-sys-admin-guides-web/scenarios/databases/09-mongodb-replica-lag/) |

---

## 🛠️ Preparación

Descarga la carpeta del laboratorio desde el sitio o copia los assets a una carpeta local. Luego:

```bash
cd db
./scripts/setup.sh
```

Si el script no tiene permiso de ejecución:

```bash
bash scripts/setup.sh
```

El setup:

1. levanta el [docker-compose.yml](/learning-sys-admin-guides-web/labs/db/docker-compose.yml) con PostgreSQL primario, réplica, MySQL, Redis y MongoDB (tres nodos);
2. espera a que los servicios estén sanos y a que PostgreSQL tenga 5.000 órdenes;
3. crea un backup de la tabla `orders` en `/tmp/app.dump` dentro del primario;
4. inicializa el replica set `rs0` y carga 200.000 documentos en MongoDB;
5. ejecuta `verify.sh`.

Credenciales del laboratorio (solo locales):

| Servicio | Usuario | Contraseña | Base |
|---|---|---|---|
| PostgreSQL primario | `app` | `app` | `app` |
| PostgreSQL réplica | `app` | `app` | `app` |
| PostgreSQL superusuario | `postgres` | `postgres` | `app` |
| MySQL | `app` | `app` | `app` |
| MySQL root | `root` | `root` | — |
| Redis | — | sin password | — |
| MongoDB | — | sin autenticación | `app` |

---

## 🧪 Comandos de laboratorio

```bash
# Romper un incidente (01..09)
./scripts/break.sh 01

# Ver el estado del stack
docker compose ps

# Verificar todos los servicios
./scripts/verify.sh

# Clientes interactivos
./scripts/psql.sh
./scripts/mysql.sh
./scripts/redis.sh
./scripts/mongo.sh

# Resetear un incidente concreto
./scripts/reset.sh 01

# Borrar el laboratorio completo (contenedores y volúmenes)
./scripts/reset.sh --all
```

También puedes entrar a un contenedor con `docker compose exec <servicio> sh` y usar los clientes de dentro:

```bash
docker compose exec postgres-primary psql -U app -d app
docker compose exec postgres-replica psql -U app -d app
docker compose exec -e MYSQL_PWD=app mysql mysql -uapp app
docker compose exec redis redis-cli
docker compose exec mongo1 mongosh "mongodb://mongo1:27017,mongo2:27017,mongo3:27017/app?replicaSet=rs0"
```

---

## 🧯 Reset y limpieza

- `./scripts/reset.sh <id>`: deshace el incidente concreto (cierra conexiones, arranca la réplica, mata el lock, borra el índice de práctica, vacía Redis, restaura el backup, elimina el índice de MongoDB o reactiva el secundario).
- `./scripts/reset.sh --all`: ejecuta `docker compose down -v` y elimina contenedores, red y volúmenes.
- El backup del escenario 06 vive en `/tmp/app.dump` dentro del primario; si recreas el contenedor, vuelve a ejecutar `./scripts/setup.sh`.

---

## ⚠️ Notas

- Es un entorno local y desechable: no uses estas credenciales, puertos ni políticas en producción.
- `max_connections=20`, `--maxConns 40` y `maxmemory=32mb` son límites artificialmente bajos para que los incidentes sean reproducibles.
- El usuario `app` es un rol normal; `postgres` es el superusuario y se usa solo para administración (reset, creación de bases de práctica).
- Redis corre sin persistencia y con `protected-mode no`: es un laboratorio, no un cache de producción.
- La réplica es de solo lectura; si intentas escribir en ella, PostgreSQL responde `cannot execute ... in a read-only transaction`.
- Los datos de MySQL se generan con una CTE recursiva de 500.000 filas; el primer arranque tarda más que los siguientes.
- MongoDB corre sin autenticación y con `--maxConns 40`: es un laboratorio local, no una configuración de producción.
- El replica set `rs0` usa `mongo1` (prioridad 2), `mongo2` y `mongo3`; si un secundario cae, la mayoría se mantiene con los otros dos.
- Los nodos anuncian nombres internos (`mongo1:27017`, etc.); desde el host usa `./scripts/mongo.sh` en vez de conectarte a `localhost` con el replica set.

---

## 🔗 Referencias internas

- [Docker](/learning-sys-admin-guides-web/guides/docker/) — contenedores, volúmenes y Compose.
- [Backpressure](/learning-sys-admin-guides-web/concepts/backpressure/) — qué pasa cuando la demanda supera la capacidad.
- [Stateful vs stateless](/learning-sys-admin-guides-web/concepts/stateful-vs-stateless/) — por qué una base de datos no es un contenedor cualquiera.
- [Conexiones agotadas](/learning-sys-admin-guides-web/scenarios/databases/01-postgres-connection-exhaustion/) — primer incidente del laboratorio.
