#!/bin/sh

set -eu

COMPOSE_DEV="${COMPOSE_DEV:-docker compose -f docker-compose.yml -f docker-compose.dev.yml}"
COMPOSE_BASE="${COMPOSE_BASE:-docker compose -f docker-compose.yml}"
REMOTE_PREFIX="${INFOMANIAK_S3_PREFIX:-backup}"
BACKUP_DIR="${BACKUP_DIR:-backups}"
STATE_DIR="${BACKUP_DIR}/.dev-sync-state"

mkdir -p "${BACKUP_DIR}" "${STATE_DIR}"

run_backup() {
  ${COMPOSE_BASE} run --rm --no-deps backup "$@"
}

latest_remote_file() {
  remote_path="$1"
  pattern="$2"

  run_backup /bin/sh -c '
    set -eu

    remote_path="$1"
    pattern="$2"

    : "${INFOMANIAK_S3_ACCESS_KEY_ID:?INFOMANIAK_S3_ACCESS_KEY_ID is required}"
    : "${INFOMANIAK_S3_SECRET_ACCESS_KEY:?INFOMANIAK_S3_SECRET_ACCESS_KEY is required}"
    : "${INFOMANIAK_S3_BUCKET:?INFOMANIAK_S3_BUCKET is required}"

    endpoint="${INFOMANIAK_S3_ENDPOINT:-https://s3.swiss-backup04.infomaniak.com}"
    region="${INFOMANIAK_S3_REGION:-us-east-1}"

    export RCLONE_CONFIG_INFOMANIAK_TYPE=s3
    export RCLONE_CONFIG_INFOMANIAK_PROVIDER=Other
    export RCLONE_CONFIG_INFOMANIAK_ACCESS_KEY_ID="${INFOMANIAK_S3_ACCESS_KEY_ID}"
    export RCLONE_CONFIG_INFOMANIAK_SECRET_ACCESS_KEY="${INFOMANIAK_S3_SECRET_ACCESS_KEY}"
    export RCLONE_CONFIG_INFOMANIAK_ENDPOINT="${endpoint}"
    export RCLONE_CONFIG_INFOMANIAK_REGION="${region}"
    export RCLONE_CONFIG_INFOMANIAK_FORCE_PATH_STYLE=true

    rclone lsf "infomaniak:${INFOMANIAK_S3_BUCKET}/${remote_path}" --files-only \
      | grep -E "${pattern}" \
      | sort \
      | tail -n 1
  ' sh "${remote_path}" "${pattern}"
}

timestamp_from_name() {
  printf '%s\n' "$1" | sed -n 's/.*_\([0-9]\{8\}T[0-9]\{6\}Z\).*/\1/p'
}

state_timestamp() {
  dataset="$1"
  state_file="${STATE_DIR}/${dataset}.timestamp"

  if [ -f "${state_file}" ]; then
    cat "${state_file}"
  else
    printf '00000000T000000Z\n'
  fi
}

write_state_timestamp() {
  dataset="$1"
  timestamp="$2"

  printf '%s\n' "${timestamp}" > "${STATE_DIR}/${dataset}.timestamp"
}

download_if_missing() {
  remote_key="$1"
  local_file="$2"

  if [ -s "${local_file}" ]; then
    printf 'Already downloaded: %s\n' "${local_file}"
    return 0
  fi

  run_backup /scripts/download-infomaniak-s3.sh "${remote_key}" "/backups/$(basename "${local_file}")"
}

restore_database() {
  sql_file="$1"

  printf 'Checking database dump: %s\n' "${sql_file}"
  ${COMPOSE_DEV} run --rm --no-deps backup /scripts/restore-check.sh "/backups/$(basename "${sql_file}")"

  printf 'Restoring database from: %s\n' "${sql_file}"
  ${COMPOSE_DEV} stop web analysis >/dev/null 2>&1 || true

  ${COMPOSE_DEV} exec -T db sh -c '
    set -eu
    export PGPASSWORD="${POSTGRES_PASSWORD}"

    dropdb --if-exists --force -U "${POSTGRES_USER}" "${POSTGRES_DB}"
    createdb -U "${POSTGRES_USER}" "${POSTGRES_DB}"
    psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" "${POSTGRES_DB}"
  ' < "${sql_file}"
}

restore_archive_volume() {
  dataset="$1"
  archive_file="$2"
  target_volume="$3"

  printf 'Restoring %s from: %s\n' "${dataset}" "${archive_file}"

  ${COMPOSE_DEV} stop web analysis >/dev/null 2>&1 || true

  ${COMPOSE_DEV} run \
    --rm \
    --no-deps \
    --volume "${target_volume}:/target" \
    backup \
    /bin/sh -c '
      set -eu

      archive="/backups/$1"

      test -s "${archive}"
      rm -rf /target/*
      tar -xzf "${archive}" -C /target
    ' sh "$(basename "${archive_file}")"
}

sync_dataset() {
  dataset="$1"
  remote_path="$2"
  pattern="$3"
  local_prefix="$4"
  extension="$5"

  latest_name="$(latest_remote_file "${remote_path}" "${pattern}" || true)"

  if [ -z "${latest_name}" ]; then
    printf 'No remote %s backup found under %s\n' "${dataset}" "${remote_path}"
    return 0
  fi

  remote_timestamp="$(timestamp_from_name "${latest_name}")"
  local_timestamp="$(state_timestamp "${dataset}")"

  printf '%s: latest remote=%s local marker=%s\n' \
    "${dataset}" \
    "${remote_timestamp}" \
    "${local_timestamp}"

  if [ "${remote_timestamp}" \< "${local_timestamp}" ] || [ "${remote_timestamp}" = "${local_timestamp}" ]; then
    printf '%s is already up to date.\n' "${dataset}"
    return 0
  fi

  remote_key="${remote_path}/${latest_name}"
  local_file="${BACKUP_DIR}/${local_prefix}_${remote_timestamp}.${extension}"

  download_if_missing "${remote_key}" "${local_file}"

  case "${dataset}" in
    database)
      restore_database "${local_file}"
      ;;
    analysis_data)
      restore_archive_volume "${dataset}" "${local_file}" "${COMPOSE_PROJECT_NAME:-transcendence}_analysis_data"
      ;;
    avatar_uploads)
      restore_archive_volume "${dataset}" "${local_file}" "${COMPOSE_PROJECT_NAME:-transcendence}_avatar_uploads"
      ;;
    *)
      printf 'Unknown dataset: %s\n' "${dataset}" >&2
      exit 1
      ;;
  esac

  write_state_timestamp "${dataset}" "${remote_timestamp}"
  printf '%s synced to %s\n' "${dataset}" "${remote_timestamp}"
}

printf 'Starting database only for restore checks/imports...\n'
${COMPOSE_DEV} up -d --build db

sync_dataset \
  database \
  "${REMOTE_PREFIX}/database" \
  "^${POSTGRES_DB:-transcendence}_[0-9]{8}T[0-9]{6}Z[.]sql$" \
  "${POSTGRES_DB:-transcendence}" \
  "sql"

sync_dataset \
  analysis_data \
  "${REMOTE_PREFIX}/analysis_data" \
  "^analysis_data_[0-9]{8}T[0-9]{6}Z[.]tar[.]gz$" \
  "analysis_data" \
  "tar.gz"

sync_dataset \
  avatar_uploads \
  "${REMOTE_PREFIX}/avatar_uploads" \
  "^avatar_uploads_[0-9]{8}T[0-9]{6}Z[.]tar[.]gz$" \
  "avatar_uploads" \
  "tar.gz"

printf 'Dev data sync complete.\n'