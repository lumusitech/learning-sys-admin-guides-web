#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

ssh_run "${1:-learner}" "${@:2}"
