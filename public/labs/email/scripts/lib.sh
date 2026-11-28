#!/usr/bin/env bash
set -euo pipefail

LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$LAB_DIR"

SMTP_PORT="${SMTP_PORT:-2525}"
IMAP_PORT="${IMAP_PORT:-1143}"

compose() {
  docker compose "$@"
}

wait_mail() {
  local attempts="${1:-60}"
  for _ in $(seq 1 "$attempts"); do
    if compose exec -T mail postfix status >/dev/null 2>&1 \
       && compose exec -T mail doveadm auth test alice alice >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "Postfix/Dovecot no respondieron." >&2
  return 1
}

send_mail() {
  local to="${1:-alice@lab.local}"
  local subject="${2:-Prueba}"
  local body="${3:-Hola desde el laboratorio}"
  local from="bob@lab.local"
  local tmp
  tmp="$(mktemp)"
  printf 'From: %s\r\nTo: %s\r\nSubject: %s\r\nDate: %s\r\nMessage-ID: <%s@lab.local>\r\n\r\n%s\r\n' \
    "$from" "$to" "$subject" "$(date -R)" "$(date +%s)-$RANDOM" "$body" > "$tmp"
  curl --silent --show-error \
    --url "smtp://127.0.0.1:${SMTP_PORT}" \
    --mail-from "$from" \
    --mail-rcpt "$to" \
    --upload-file "$tmp"
  rm -f "$tmp"
}

imap_list() {
  local user="${1:-alice}"
  local pass="${2:-alice}"
  curl --silent --show-error \
    --url "imap://127.0.0.1:${IMAP_PORT}/INBOX" \
    --user "$user:$pass" \
    --request 'SEARCH ALL'
}
