#!/bin/sh

set -eu

backup_dir="${BACKUP_DIR:-/backups}"
source_dir="${ANALYSIS_DATA_DIR:-/analysis-data}" # analysis data volume
retention_days="${BACKUP_RETENTION_DAYS:-7}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="${backup_dir}/analysis_data_${timestamp}.tar.gz"
temporary_file="${backup_file}.tmp"

mkdir -p "${backup_dir}"
umask 077

cleanup() {
  rm -f "${temporary_file}"
}

trap cleanup 0 1 2 15

if [ ! -d "${source_dir}" ]; then
  printf 'Analysis data directory not found: %s\n' "${source_dir}" >&2
  exit 1
fi

tar -czf "${temporary_file}" -C "${source_dir}" .

mv "${temporary_file}" "${backup_file}"

trap - 0 1 2 15

find "${backup_dir}" \
  -type f \
  -name "analysis_data_*.tar.gz" \
  -mtime "+${retention_days}" \
  -exec rm -f {} \;

printf 'Analysis data backup created: %s\n' "${backup_file}"

if [ "${INFOMANIAK_S3_BUCKET:-}" != "" ]; then
  remote_prefix="${INFOMANIAK_S3_PREFIX:-backup}"
  remote_path="${remote_prefix}/analysis_data"
  remote_key="${remote_path}/$(basename "${backup_file}")"
  s3_retention_days="${INFOMANIAK_S3_RETENTION_DAYS:-30}"

  /scripts/upload-infomaniak-s3.sh "${backup_file}" "${remote_key}" # upload backups to infomaniak
  /scripts/prune-infomaniak-s3.sh "${remote_path}" "${s3_retention_days}" # remove old backups
fi
