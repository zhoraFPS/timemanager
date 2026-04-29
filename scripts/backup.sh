#!/bin/sh
# Daily pg_dump backup. Called by the `backup` container in docker-compose.
# Writes to /backups, which is host-mounted. Rotates after N days.

set -e

: "${POSTGRES_USER:?need POSTGRES_USER}"
: "${POSTGRES_DB:?need POSTGRES_DB}"
: "${PGPASSWORD:?need PGPASSWORD}"

RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y-%m-%d_%H%M)
OUTFILE="/backups/zeitspiel-${TIMESTAMP}.dump"

echo "[backup] dumping to ${OUTFILE}"
pg_dump \
  --host=db \
  --username="$POSTGRES_USER" \
  --dbname="$POSTGRES_DB" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="$OUTFILE"

# Keep first-of-month forever; rotate daily snapshots after retention.
echo "[backup] rotating snapshots older than ${RETENTION_DAYS} days"
find /backups -name 'zeitspiel-*.dump' -type f -mtime "+${RETENTION_DAYS}" \
  ! -name 'zeitspiel-*-01_*.dump' \
  -print -delete

echo "[backup] done. size: $(du -h "$OUTFILE" | cut -f1)"
