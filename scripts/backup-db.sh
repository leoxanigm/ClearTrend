#!/bin/sh

set -eu

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"

backup_dir="${BACKUP_DIR:-/backups}"
retention_days="${BACKUP_RETENTION_DAYS:-7}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="${backup_dir}/${POSTGRES_DB}_${timestamp}.sql"
temporary_file="${backup_file}.tmp"

mkdir -p "${backup_dir}"
umask 077

cleanup() {
  rm -f "${temporary_file}"
}

trap cleanup 0 1 2 15

PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  --host="${POSTGRES_HOST:-db}" \
  --username="${POSTGRES_USER}" \
  --dbname="${POSTGRES_DB}" \
  --no-owner \
  --no-privileges \
  > "${temporary_file}"

mv "${temporary_file}" "${backup_file}"
trap - 0 1 2 15

find "${backup_dir}" \
  -type f \
  -name "${POSTGRES_DB}_*.sql" \
  -mtime "+${retention_days}" \
  -exec rm -f {} \;

printf 'Database backup created: %s\n' "${backup_file}"

if [ "${INFOMANIAK_S3_BUCKET:-}" != "" ]; then
  remote_prefix="${INFOMANIAK_S3_PREFIX:-backup}"
  remote_path="${remote_prefix}/database"
  remote_key="${remote_path}/$(basename "${backup_file}")"
  s3_retention_days="${INFOMANIAK_S3_RETENTION_DAYS:-30}"

  /scripts/upload-infomaniak-s3.sh "${backup_file}" "${remote_key}"
  /scripts/prune-infomaniak-s3.sh "${remote_path}" "${s3_retention_days}"
fi
