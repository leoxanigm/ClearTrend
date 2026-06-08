#!/bin/sh

set -eu

local_file="${1:?Usage: upload-infomaniak-s3.sh /path/to/file remote/object/key}"
remote_key="${2:?Usage: upload-infomaniak-s3.sh /path/to/file remote/object/key}"

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

if [ ! -f "${local_file}" ]; then
  printf 'Upload source file not found: %s\n' "${local_file}" >&2
  exit 1
fi

rclone copyto \
  "${local_file}" \
  "infomaniak:${INFOMANIAK_S3_BUCKET}/${remote_key}" \
  --retries 3 \
  --low-level-retries 10 \
  --stats-one-line

remote_dir="$(dirname "${remote_key}")"
remote_name="$(basename "${remote_key}")"

if ! rclone lsf \
  "infomaniak:${INFOMANIAK_S3_BUCKET}/${remote_dir}" \
  --files-only \
  | grep -Fx "${remote_name}" >/dev/null; then
  printf 'Uploaded object was not found after upload: s3://%s/%s\n' \
    "${INFOMANIAK_S3_BUCKET}" \
    "${remote_key}" >&2
  exit 1
fi

printf 'Uploaded backup to Infomaniak S3: s3://%s/%s\n' \
  "${INFOMANIAK_S3_BUCKET}" \
  "${remote_key}"