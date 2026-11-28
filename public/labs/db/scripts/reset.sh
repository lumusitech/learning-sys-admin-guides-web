#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

MONGO_URI="mongodb://mongo1:27017,mongo2:27017,mongo3:27017/app?replicaSet=rs0"

case "${1:-}" in
  01)
    docker compose exec -T postgres-primary psql -U postgres -d app -c \
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='app' AND pid <> pg_backend_pid();" >/dev/null
    docker compose exec -T postgres-primary psql -U postgres -d app -c \
      "DROP TABLE IF EXISTS pgbench_accounts, pgbench_branches, pgbench_history, pgbench_tellers CASCADE;" >/dev/null
    echo "Conexiones cerradas y tablas de pgbench eliminadas."
    ;;
  02)
    docker compose start postgres-replica >/dev/null
    echo "Réplica arrancada; esperando a que acepte conexiones..."
    for _ in $(seq 1 30); do
      if docker compose exec -T postgres-replica pg_isready -U app -d app >/dev/null 2>&1; then
        break
      fi
      sleep 1
    done
    echo "Comprueba el retraso con ./scripts/verify.sh"
    ;;
  03)
    docker compose exec -T postgres-primary psql -U postgres -d app -c \
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='app' AND query LIKE '%pg_sleep%' AND pid <> pg_backend_pid();" >/dev/null
    docker compose exec -T postgres-primary psql -U postgres -d app -c \
      "UPDATE orders SET status='paid' WHERE id=1;" >/dev/null
    echo "Transacción bloqueante terminada y fila restaurada."
    ;;
  04)
    docker compose exec -T -e MYSQL_PWD=app mysql mysql -uapp app -e \
      "ALTER TABLE orders DROP INDEX idx_orders_customer_email;" 2>/dev/null || true
    echo "Índice de práctica eliminado (si existía)."
    ;;
  05)
    docker compose exec -T redis redis-cli FLUSHALL >/dev/null
    docker compose exec -T redis redis-cli CONFIG RESETSTAT >/dev/null
    echo "Redis vaciado y contadores reiniciados."
    ;;
  06)
    docker compose exec -T postgres-primary pg_restore -U app -d app --clean --if-exists /tmp/app.dump
    echo "Tabla orders restaurada desde /tmp/app.dump."
    ;;
  07)
    docker compose exec -T mongo1 mongosh "$MONGO_URI" --quiet --eval '
      try {
        db.orders.dropIndex("customer_email_1");
        print("Índice customer_email_1 eliminado");
      } catch (e) {
        if (e.codeName === "IndexNotFound") {
          print("El índice customer_email_1 no existía");
        } else {
          throw e;
        }
      }
    '
    ;;
  08)
    docker compose exec -T mongo1 pkill -f '[m]ongosh mongodb://' >/dev/null 2>&1 || true
    docker compose exec -T mongo1 mongosh "$MONGO_URI" --quiet \
      --eval 'db.orders.deleteOne({_id:"connection-probe"})' >/dev/null 2>&1 || true
    echo "Clientes de prueba de MongoDB terminados."
    ;;
  09)
    docker compose start mongo2 >/dev/null
    echo "mongo2 arrancado; esperando a que vuelva como secundario..."
    STATE=""
    for _ in $(seq 1 30); do
      STATE=$(docker compose exec -T mongo1 mongosh "$MONGO_URI" --quiet --eval \
        'rs.status().members.find((m) => m.name.startsWith("mongo2:")).stateStr' 2>/dev/null || true)
      if [ "$STATE" = "SECONDARY" ]; then
        break
      fi
      sleep 2
    done
    echo "Estado de mongo2: ${STATE:-desconocido}"
    ;;
  --all)
    docker compose down -v --remove-orphans
    echo "Laboratorio eliminado (contenedores y volúmenes)."
    ;;
  *)
    echo "Uso: $0 <01|02|03|04|05|06|07|08|09|--all>" >&2
    exit 1
    ;;
esac
