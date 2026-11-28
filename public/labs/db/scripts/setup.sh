#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if ! docker info >/dev/null 2>&1; then
  echo "Docker no está en ejecución." >&2
  exit 1
fi

echo "Levantando el laboratorio (PostgreSQL primario y réplica, MySQL y Redis)..."
docker compose up -d --wait

echo "Esperando los datos base de PostgreSQL..."
for _ in $(seq 1 60); do
  if docker compose exec -T postgres-primary \
    psql -U app -d app -tAc "SELECT count(*) FROM orders" 2>/dev/null | grep -qx "5000"; then
    break
  fi
  sleep 1
done

# Backup para el escenario 06. Vive dentro del contenedor y se pierde con el
# volumen; el setup lo vuelve a crear.
docker compose exec -T postgres-primary \
  pg_dump -U app -d app -Fc -t orders -f /tmp/app.dump

echo
bash scripts/verify.sh

echo
echo "Laboratorio listo. Los datos viven en volúmenes de Docker."
echo "Para borrarlo todo: ./scripts/reset.sh --all"
