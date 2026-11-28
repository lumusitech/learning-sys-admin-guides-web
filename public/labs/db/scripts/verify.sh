#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== Contenedores =="
docker compose ps

echo
echo "== PostgreSQL primario =="
docker compose exec -T postgres-primary psql -U app -d app \
  -c "SELECT version();" \
  -c "SHOW max_connections;" \
  -c "SELECT count(*) AS orders FROM orders;"

echo
echo "== PostgreSQL réplica =="
docker compose exec -T postgres-replica psql -U app -d app \
  -c "SELECT pg_is_in_recovery() AS replica, now() - pg_last_xact_replay_timestamp() AS replay_lag;"

echo
echo "== MySQL =="
docker compose exec -T -e MYSQL_PWD=app mysql mysql -uapp app \
  -e "SELECT VERSION() AS version, COUNT(*) AS orders FROM orders;"

echo
echo "== Redis =="
docker compose exec -T redis redis-cli PING
docker compose exec -T redis redis-cli INFO memory \
  | grep -E "used_memory_human|maxmemory_human" || true
docker compose exec -T redis redis-cli DBSIZE
