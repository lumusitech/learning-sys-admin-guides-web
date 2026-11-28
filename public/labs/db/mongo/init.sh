#!/usr/bin/env bash
set -euo pipefail

for host in mongo1 mongo2 mongo3; do
  echo "Esperando a $host..."
  until mongosh --host "$host:27017" --quiet \
    --eval 'db.adminCommand({ping:1}).ok' 2>/dev/null | grep -qx 1; do
    sleep 1
  done
done

echo "Iniciando el replica set rs0..."
mongosh --host mongo1:27017 --quiet --eval '
  try {
    rs.status();
    print("replica set ya iniciado");
  } catch (e) {
    if (e.code === 94 || e.codeName === "NotYetInitialized") {
      rs.initiate({
        _id: "rs0",
        members: [
          { _id: 0, host: "mongo1:27017", priority: 2 },
          { _id: 1, host: "mongo2:27017", priority: 1 },
          { _id: 2, host: "mongo3:27017", priority: 1 }
        ]
      });
    } else {
      throw e;
    }
  }
'

echo "Esperando a un primario escribible..."
PRIMARY=""
for _ in $(seq 1 60); do
  PRIMARY=$(mongosh --host mongo1:27017 --quiet \
    --eval 'db.hello().primary' 2>/dev/null || true)
  if [ -n "$PRIMARY" ] && [ "$PRIMARY" != "null" ] && \
    mongosh --host "$PRIMARY" --quiet \
      --eval 'db.hello().isWritablePrimary' 2>/dev/null | grep -qx true; then
    break
  fi
  PRIMARY=""
  sleep 2
done

if [ -z "$PRIMARY" ]; then
  echo "No se encontró un primario escribible." >&2
  exit 1
fi

echo "Primario: $PRIMARY"
mongosh --host "$PRIMARY" app --quiet /seed.js
