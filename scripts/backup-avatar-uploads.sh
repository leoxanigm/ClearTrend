#!/bin/sh

set -eu

backup_dir="${BACKUP_DIR:-/backups}"
source_dir="${AVATAR_UPLOADS_DIR:-/avatar-uploads}"
retention_days="${BACKUP_RETENTION_DAYS:-7}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="${backup_dir}/avatar_uploads_${timestamp}.tar.gz"
temporary_file="${backup_file}.tmp"

mkdir -p "${backup_dir}"
umask 077

cleanup() {
  rm -f "${temporary_file}"
}

trap cleanup 0 1 2 15

if [ ! -d "${source_dir}" ]; then
  printf 'Avatar uploads directory not found: %s\n' "${source_dir}" >&2
  exit 1
fi

tar -czf "${temporary_file}" -C "${source_dir}" .

mv "${temporary_file}" "${backup_file}"

trap - 0 1 2 15

find "${backup_dir}" \
  -type f \
  -name "avatar_uploads_*.tar.gz" \
  -mtime "+${retention_days}" \
  -exec rm -f {} \;

printf 'Avatar uploads backup created: %s\n' "${backup_file}"

if [ "${INFOMANIAK_S3_BUCKET:-}" != "" ]; then
  remote_prefix="${INFOMANIAK_S3_PREFIX:-backup}"
  remote_path="${remote_prefix}/avatar_uploads"
  remote_key="${remote_path}/$(basename "${backup_file}")"
  s3_retention_days="${INFOMANIAK_S3_RETENTION_DAYS:-30}"

  /scripts/upload-infomaniak-s3.sh "${backup_file}" "${remote_key}"
  /scripts/prune-infomaniak-s3.sh "${remote_path}" "${s3_retention_days}"
fi