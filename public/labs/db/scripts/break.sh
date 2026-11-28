#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

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
  *)
    echo "Uso: $0 <01|02|03|04|05|06>" >&2
    exit 1
    ;;
esac
