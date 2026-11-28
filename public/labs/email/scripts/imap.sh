#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

imap_list "${1:-alice}" "${2:-alice}"
