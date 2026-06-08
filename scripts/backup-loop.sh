#!/bin/sh

set -u

interval="${BACKUP_INTERVAL_SECONDS:-86400}" # backups everyday

while true; do
  if ! /scripts/backup-db.sh; then
    printf 'Database backup failed; retrying in %s seconds.\n' "${interval}" >&2
  fi

  if ! /scripts/backup-analysis-data.sh; then
    printf 'Analysis data backup failed; retrying in %s seconds.\n' "${interval}" >&2
  fi

  sleep "${interval}"
done
