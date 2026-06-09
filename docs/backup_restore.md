# Backup and Restore

This document describes how ClearTrend backs up and restores PostgreSQL,
analysis data, and uploaded avatars.

## Scope

The backup service protects three data sources:

| Data | Docker location | Local backup file | Remote S3 path |
|---|---|---|---|
| PostgreSQL database | `postgres_data` volume | `backups/transcendence_YYYYMMDDTHHMMSSZ.sql` | `${INFOMANIAK_S3_PREFIX}/database/` |
| Analysis data | `analysis_data` volume | `backups/analysis_data_YYYYMMDDTHHMMSSZ.tar.gz` | `${INFOMANIAK_S3_PREFIX}/analysis_data/` |
| Uploaded avatars | `avatar_uploads` volume | `backups/avatar_uploads_YYYYMMDDTHHMMSSZ.tar.gz` | `${INFOMANIAK_S3_PREFIX}/avatar_uploads/` |

The backup container is built from `backup/Dockerfile`. It contains PostgreSQL
client tools, `tar`, `gzip`, and `rclone`.

## Configuration

The backup service reads `.env`.

Required database variables:

```env
POSTGRES_USER=transcendence
POSTGRES_PASSWORD=transcendence
POSTGRES_DB=transcendence
```

Backup scheduling and local retention:

```env
BACKUP_INTERVAL_SECONDS=86400
BACKUP_RETENTION_DAYS=7
```

Infomaniak S3 configuration:

```env
INFOMANIAK_S3_ENDPOINT=https://s3.swiss-backup04.infomaniak.com
INFOMANIAK_S3_REGION=us-east-1
INFOMANIAK_S3_BUCKET=your-bucket
INFOMANIAK_S3_PREFIX=backup
INFOMANIAK_S3_ACCESS_KEY_ID=your-access-key
INFOMANIAK_S3_SECRET_ACCESS_KEY=your-secret-key
INFOMANIAK_S3_RETENTION_DAYS=15
```

Remote upload is enabled when `INFOMANIAK_S3_BUCKET` is not empty. Do not commit
real S3 credentials.

## Automatic Backups

The `backup` service starts with the project and runs:

1. `/scripts/backup-db.sh`
2. `/scripts/backup-analysis-data.sh`
3. `/scripts/backup-avatar-uploads.sh`

Then it sleeps for `BACKUP_INTERVAL_SECONDS` and repeats.

Start the development stack:

```sh
make dev
```

Start the evaluation-like stack:

```sh
make up
```

Show backup logs:

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs backup
```

## Manual Backup

Run all backup jobs:

```sh
make backup
```

Run one backup job directly:

```sh
docker compose -f docker-compose.yml run --rm --no-deps backup /scripts/backup-db.sh
docker compose -f docker-compose.yml run --rm --no-deps backup /scripts/backup-analysis-data.sh
docker compose -f docker-compose.yml run --rm --no-deps backup /scripts/backup-avatar-uploads.sh
```

List local backups:

```sh
ls -lh backups/
```

Inspect an archive:

```sh
tar -tzf backups/analysis_data_YYYYMMDDTHHMMSSZ.tar.gz | head
tar -tzf backups/avatar_uploads_YYYYMMDDTHHMMSSZ.tar.gz | head
```

## Local Retention

Local retention is controlled by `BACKUP_RETENTION_DAYS`.

Each script deletes old files for its own backup type:

- database: `${POSTGRES_DB}_*.sql`
- analysis data: `analysis_data_*.tar.gz`
- uploaded avatars: `avatar_uploads_*.tar.gz`

## Remote S3 Retention

Remote retention is controlled by `INFOMANIAK_S3_RETENTION_DAYS`.

After each successful upload, the backup script prunes old files from the
matching S3 prefix:

- `${INFOMANIAK_S3_PREFIX}/database/`
- `${INFOMANIAK_S3_PREFIX}/analysis_data/`
- `${INFOMANIAK_S3_PREFIX}/avatar_uploads/`

The S3 credentials must allow list, head/get, put, and delete operations.

## List Remote Backups

List analysis data backups:

```sh
tests/scripts/list-infomaniak-backups.sh backup/analysis_data
```

List database backups:

```sh
tests/scripts/list-infomaniak-backups.sh backup/database
```

List avatar backups:

```sh
tests/scripts/list-infomaniak-backups.sh backup/avatar_uploads
```

The path must match the configured `INFOMANIAK_S3_PREFIX`.

## Download From Infomaniak S3

Download a database backup:

```sh
docker compose -f docker-compose.yml run --rm --no-deps backup \
  /scripts/download-infomaniak-s3.sh \
  backup/database/transcendence_YYYYMMDDTHHMMSSZ.sql \
  /backups/transcendence_YYYYMMDDTHHMMSSZ.sql
```

Download an analysis data backup:

```sh
docker compose -f docker-compose.yml run --rm --no-deps backup \
  /scripts/download-infomaniak-s3.sh \
  backup/analysis_data/analysis_data_YYYYMMDDTHHMMSSZ.tar.gz \
  /backups/analysis_data_YYYYMMDDTHHMMSSZ.tar.gz
```

Download an avatar backup:

```sh
docker compose -f docker-compose.yml run --rm --no-deps backup \
  /scripts/download-infomaniak-s3.sh \
  backup/avatar_uploads/avatar_uploads_YYYYMMDDTHHMMSSZ.tar.gz \
  /backups/avatar_uploads_YYYYMMDDTHHMMSSZ.tar.gz
```

## Restore Database

Always test a database dump before replacing the current database:

```sh
make restore-check file=backups/transcendence_YYYYMMDDTHHMMSSZ.sql
```

Restore the database:

```sh
make restore file=backups/transcendence_YYYYMMDDTHHMMSSZ.sql
```

The restore command stops `web` and `analysis`, drops and recreates the database,
imports the dump, then restarts the services.

## Restore Analysis Data

This replaces the current `analysis_data` volume contents.

Create a fresh backup first:

```sh
make backup
```

Stop the analysis service:

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml stop analysis
```

Restore the archive into the Docker volume:

```sh
docker run --rm \
  -v transcendence_analysis_data:/target \
  -v "$PWD/backups:/backups:ro" \
  alpine sh -c '
    set -eu
    rm -rf /target/*
    tar -xzf /backups/analysis_data_YYYYMMDDTHHMMSSZ.tar.gz -C /target
  '
```

Restart analysis:

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml start analysis
```

## Restore Uploaded Avatars

This replaces the current `avatar_uploads` volume contents.

Create a fresh backup first:

```sh
make backup
```

Stop the web service:

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml stop web
```

Restore the archive into the Docker volume:

```sh
docker run --rm \
  -v transcendence_avatar_uploads:/target \
  -v "$PWD/backups:/backups:ro" \
  alpine sh -c '
    set -eu
    rm -rf /target/*
    tar -xzf /backups/avatar_uploads_YYYYMMDDTHHMMSSZ.tar.gz -C /target
  '
```

Restart web:

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml start web
```

## Full Disaster Recovery Order

For a complete restore from remote backups:

1. List remote backups and choose matching timestamps.
2. Download the database dump from S3.
3. Run `make restore-check file=...`.
4. Restore the database with `make restore file=...`.
5. Download and restore `avatar_uploads`.
6. Download and restore `analysis_data`.
7. Check service health.

```sh
make health
docker compose -f docker-compose.yml -f docker-compose.dev.yml ps
```

## Rebuild Backup Image After Script Changes

The backup scripts are copied into the backup image. After changing any script,
rebuild the image and recreate the service:

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml build backup
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --force-recreate backup
```

## Notes

- Local backups are written to `./backups`.
- Backup files are created with restrictive permissions.
- Partial files are written as `.tmp` files and moved into place only after the
  backup command succeeds.
- The Docker volume names above assume the Compose project name is
  `transcendence`. Check actual names with `docker volume ls` if needed.
- S3 upload failures do not remove the local backup file.
