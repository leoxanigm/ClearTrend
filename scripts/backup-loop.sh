#!/bin/sh

set -u

interval="${BACKUP_INTERVAL_SECONDS:-86400}" # backups everyday
run_on_start="${BACKUP_RUN_ON_START:-1}"

run_backup_cycle() {
  if ! /scripts/backup-db.sh; then
    printf 'Database backup failed; retrying in %s seconds.\n' "${interval}" >&2
  fi

  if ! /scripts/backup-analysis-data.sh; then
    printf 'Analysis data backup failed; retrying in %s seconds.\n' "${interval}" >&2
  fi

  if ! /scripts/backup-avatar-uploads.sh; then
    printf 'Avatar uploads backup failed; retrying in %s seconds.\n' "${interval}" >&2
  fi
}

if [ "${run_on_start}" = "1" ]; then
  run_backup_cycle
fi

while true; do
  sleep "${interval}"
  run_backup_cycle
done