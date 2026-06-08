FROM postgres:17-alpine

RUN apk add --no-cache \
  ca-certificates \
  rclone \
  tar \
  gzip

COPY scripts/backup-db.sh /scripts/backup-db.sh
COPY scripts/backup-loop.sh /scripts/backup-loop.sh
COPY scripts/restore-check.sh /scripts/restore-check.sh
COPY scripts/backup-analysis-data.sh /scripts/backup-analysis-data.sh
COPY scripts/backup-avatar-uploads.sh /scripts/backup-avatar-uploads.sh
COPY scripts/upload-infomaniak-s3.sh /scripts/upload-infomaniak-s3.sh
COPY scripts/prune-infomaniak-s3.sh /scripts/prune-infomaniak-s3.sh

RUN chmod +x /scripts/*.sh

CMD ["/bin/sh", "/scripts/backup-loop.sh"]