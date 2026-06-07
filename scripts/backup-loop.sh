#!/bin/sh

set -u

interval="${BACKUP_INTERVAL_SECONDS:-86400}"

while true; do
  if ! /scripts/backup-db.sh; then
    printf 'Database backup failed; retrying in %s seconds.\n' "${interval}" >&2
  fi

  sleep "${interval}"
done
