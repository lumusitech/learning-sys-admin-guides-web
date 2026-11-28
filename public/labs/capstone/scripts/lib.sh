#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
LABS="$REPO_ROOT/public/labs"

run_lab() {
  local lab="$1"
  shift
  ( cd "$LABS/$lab" && "./scripts/$@" )
}

docker_ok() {
  docker info >/dev/null 2>&1
}

kind_ok() {
  command -v kind >/dev/null 2>&1 && kind get clusters 2>/dev/null | grep -qx sysadmin-lab
}

require_docker() {
  if ! docker_ok; then
    echo "Docker no está disponible." >&2
    exit 1
  fi
}
