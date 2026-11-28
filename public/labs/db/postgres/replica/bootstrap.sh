#!/usr/bin/env bash
set -euo pipefail

# La primera vez clona el primario. En arranques posteriores el volumen ya
# contiene un PGDATA válido y el entrypoint solo arranca PostgreSQL.
if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "Clonando el primario con pg_basebackup..."
  mkdir -p "$PGDATA"
  chmod 700 "$PGDATA"

  until PGPASSWORD=replicator pg_basebackup \
    -h postgres-primary \
    -U replicator \
    -D "$PGDATA" \
    -Fp -Xs -P -R; do
    echo "El primario aún no acepta replicación; reintentando en 2s..."
    sleep 2
  done
fi

exec docker-entrypoint.sh "$@"
