#!/bin/sh

set -eu

remote_key="${1:?Usage: download-infomaniak-s3.sh remote/object/key /local/file}"
local_file="${2:?Usage: download-infomaniak-s3.sh remote/object/key /local/file}"

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

mkdir -p "$(dirname "${local_file}")"

rclone copyto \
  "infomaniak:${INFOMANIAK_S3_BUCKET}/${remote_key}" \
  "${local_file}" \
  --retries 3 \
  --low-level-retries 10 \
  --stats-one-line

if [ ! -s "${local_file}" ]; then
  printf 'Downloaded file is missing or empty: %s\n' "${local_file}" >&2
  exit 1
fi

printf 'Downloaded Infomaniak S3 backup: s3://%s/%s -> %s\n' \
  "${INFOMANIAK_S3_BUCKET}" \
  "${remote_key}" \
  "${local_file}"