#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

MONGO_URI="mongodb://mongo1:27017,mongo2:27017,mongo3:27017/app?replicaSet=rs0"

case "${1:-}" in
  01)
    echo "Escenario 01: agotar max_connections con pgbench..."
    docker compose exec -T postgres-primary pgbench -i -q -U app app
    docker compose exec -d postgres-primary pgbench -c 17 -T 600 -S -U app app
    echo "pgbench mantiene las 17 conexiones de app durante 10 minutos (max_connections=20, 3 reservadas para postgres)."
    echo "Prueba a conectarte con: ./scripts/psql.sh"
    ;;
  02)
    echo "Escenario 02: detener la réplica..."
    docker compose stop postgres-replica
    echo "La réplica está detenida; el primario sigue aceptando escrituras."
    ;;
  03)
    echo "Escenario 03: abrir una transacción que bloquea la fila id=1..."
    docker compose exec -d postgres-primary psql -U app -d app -c \
      "BEGIN; UPDATE orders SET status='locked' WHERE id=1; SELECT pg_sleep(600); COMMIT;"
    echo "La transacción mantiene el lock durante 10 minutos."
    echo "Prueba a actualizar la misma fila con: ./scripts/psql.sh"
    ;;
  04)
    echo "Escenario 04: lanzar una consulta sin índice en MySQL..."
    docker compose exec -T -e MYSQL_PWD=app mysql mysql -uapp app -e \
      "EXPLAIN ANALYZE SELECT * FROM orders WHERE customer_email = 'user499999@example.com' ORDER BY total DESC LIMIT 10;"
    echo "Revisa el slow log en /var/lib/mysql/slow.log dentro del contenedor."
    ;;
  05)
    echo "Escenario 05: llenar Redis por encima de maxmemory..."
    docker compose exec -d redis redis-cli EVAL \
      "for i=1,200000 do redis.call('SET','key:'..i,string.rep('x',1024)) end return 1" 0
    echo "Se están creando unos 200 MB de claves contra un límite de 32 MB."
    ;;
  06)
    echo "Escenario 06: simular una pérdida de datos..."
    docker compose exec -T postgres-primary psql -U app -d app -c "TRUNCATE orders;"
    echo "La tabla orders quedó vacía; el backup está en /tmp/app.dump."
    echo "Restaura con: ./scripts/reset.sh 06"
    ;;
  07)
    echo "Escenario 07: lanzar una consulta sin índice en MongoDB..."
    docker compose exec -T mongo1 mongosh "$MONGO_URI" --quiet --eval '
      const e = db.orders.find({ customer_email: "user199999@example.com" }).explain("executionStats");
      printjson({
        stage: e.queryPlanner.winningPlan.stage,
        docsExamined: e.executionStats.totalDocsExamined,
        nReturned: e.executionStats.nReturned,
        ms: e.executionStats.executionTimeMillis
      });
    '
    echo "Crea el índice con: ./scripts/mongo.sh --quiet --eval 'db.orders.createIndex({customer_email:1})'"
    ;;
  08)
    echo "Escenario 08: agotar maxIncomingConnections con clientes mongosh..."
    for _ in $(seq 1 30); do
      docker compose exec -d mongo1 mongosh "$MONGO_URI" --quiet \
        --eval 'sleep(600000)' >/dev/null 2>&1
    done
    echo "30 clientes lanzados contra un límite de 40 conexiones entrantes."
    echo "Prueba una escritura con: ./scripts/mongo.sh --quiet --eval 'db.orders.insertOne({_id:\"connection-probe\", customer_email:\"probe@example.com\"})'"
    ;;
  09)
    echo "Escenario 09: detener el secundario mongo2..."
    docker compose stop mongo2
    echo "mongo2 está detenido; el primario y mongo3 conservan la mayoría."
    ;;
  *)
    echo "Uso: $0 <01|02|03|04|05|06|07|08|09>" >&2
    exit 1
    ;;
esac
