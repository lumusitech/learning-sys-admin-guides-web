#!/usr/bin/env bash
set -euo pipefail

# Permite que la réplica se conecte al primario como usuario de replicación.
cat >> "$PGDATA/pg_hba.conf" <<'EOF'
host replication replicator 0.0.0.0/0 scram-sha-256
EOF
