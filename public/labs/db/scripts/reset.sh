#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

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
    echo "Transacción bloqueante terminada."
    ;;
  04)
    docker compose exec -T -e MYSQL_PWD=app mysql mysql -uapp app -e \
      "ALTER TABLE orders DROP INDEX idx_orders_customer_email;" 2>/dev/null || true
    echo "Índice de práctica eliminado (si existía)."
    ;;
  05)
    docker compose exec -T redis redis-cli FLUSHALL >/dev/null
    echo "Redis vaciado."
    ;;
  06)
    docker compose exec -T postgres-primary pg_restore -U app -d app --clean --if-exists /tmp/app.dump
    echo "Tabla orders restaurada desde /tmp/app.dump."
    ;;
  --all)
    docker compose down -v --remove-orphans
    echo "Laboratorio eliminado (contenedores y volúmenes)."
    ;;
  *)
    echo "Uso: $0 <01|02|03|04|05|06|--all>" >&2
    exit 1
    ;;
esac
