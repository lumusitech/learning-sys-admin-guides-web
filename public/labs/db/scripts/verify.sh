#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

MONGO_URI="mongodb://mongo1:27017,mongo2:27017,mongo3:27017/app?replicaSet=rs0"

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
  -c "SELECT pg_is_in_recovery() AS replica,
             pg_last_wal_receive_lsn() AS recibido,
             pg_last_wal_replay_lsn() AS aplicado,
             pg_wal_lsn_diff(pg_last_wal_receive_lsn(), pg_last_wal_replay_lsn()) AS bytes_pendientes;"

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

echo
echo "== MongoDB =="
docker compose exec -T mongo1 mongosh "$MONGO_URI" --quiet --eval \
  'printjson({ ok: db.adminCommand({ping:1}).ok, orders: db.orders.countDocuments(), conexiones: db.serverStatus().connections.current })'
docker compose exec -T mongo1 mongosh "$MONGO_URI" --quiet --eval \
  'print(rs.status().members.map((m) => `${m.name}:${m.stateStr}`).join(", "))'
