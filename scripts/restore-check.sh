#!/bin/sh

set -eu

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"

backup_file="${1:?Usage: restore-check.sh /backups/name.sql}"
postgres_host="${POSTGRES_HOST:-db}"
check_database="${POSTGRES_DB}_restore_check_$(date +%s)_$$"

if [ ! -f "${backup_file}" ]; then
  printf 'Backup file not found: %s\n' "${backup_file}" >&2
  exit 1
fi

export PGPASSWORD="${POSTGRES_PASSWORD}"

cleanup() {
  dropdb \
    --host="${postgres_host}" \
    --username="${POSTGRES_USER}" \
    --if-exists \
    --force \
    "${check_database}" \
    >/dev/null 2>&1 || true
}

trap cleanup 0 1 2 15

createdb \
  --host="${postgres_host}" \
  --username="${POSTGRES_USER}" \
  "${check_database}"

psql \
  --host="${postgres_host}" \
  --username="${POSTGRES_USER}" \
  --dbname="${check_database}" \
  --set=ON_ERROR_STOP=1 \
  --file="${backup_file}" \
  >/dev/null

table_count="$(
  psql \
    --host="${postgres_host}" \
    --username="${POSTGRES_USER}" \
    --dbname="${check_database}" \
    --tuples-only \
    --no-align \
    --command="SELECT count(*) FROM pg_tables WHERE schemaname = 'public';"
)"

if [ "${table_count}" -lt 1 ]; then
  printf 'Restore check failed: no public tables were restored.\n' >&2
  exit 1
fi

printf 'Restore check passed: %s public tables restored from %s\n' \
  "${table_count}" \
  "${backup_file}"
