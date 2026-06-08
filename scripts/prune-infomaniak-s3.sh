#!/bin/sh

set -eu

remote_path="${1:?Usage: prune-infomaniak-s3.sh remote/path retention_days}"
retention_days="${2:?Usage: prune-infomaniak-s3.sh remote/path retention_days}"

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

rclone delete \
  "infomaniak:${INFOMANIAK_S3_BUCKET}/${remote_path}" \
  --min-age "${retention_days}d" \
  --retries 3 \
  --low-level-retries 10

rclone rmdirs \
  "infomaniak:${INFOMANIAK_S3_BUCKET}/${remote_path}" \
  --leave-root

printf 'Pruned Infomaniak S3 backups older than %s days under s3://%s/%s\n' \
  "${retention_days}" \
  "${INFOMANIAK_S3_BUCKET}" \
  "${remote_path}"