#!/bin/bash

set -eu

# repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
remote_path="${1:-${INFOMANIAK_S3_PREFIX:-backup}/analysis_data}"

# cd "${repo_root}"

docker compose -f docker-compose.yml run --rm --no-deps backup /bin/sh -c '
set -eu

remote_path="$1"

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

printf "Listing s3://%s/%s\n" "${INFOMANIAK_S3_BUCKET}" "${remote_path}"

rclone lsl "infomaniak:${INFOMANIAK_S3_BUCKET}/${remote_path}"
' sh "${remote_path}"