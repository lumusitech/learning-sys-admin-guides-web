#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
MONGO_URI="mongodb://mongo1:27017,mongo2:27017,mongo3:27017/app?replicaSet=rs0"
exec docker compose exec mongo1 mongosh "$MONGO_URI" "$@"
