#!/bin/sh
# Entrypoint: apply any pending Prisma migrations, then exec the given CMD.
# Running this on every container start keeps the DB schema in sync with the
# deployed image without a separate migration step.

set -e

# Wait-for-db loop: Postgres sometimes isn't ready when the app container
# starts. Retry `prisma migrate status` for up to ~60 seconds.
echo "[entrypoint] waiting for database..."
i=0
until npx prisma migrate status --schema=prisma/schema.prisma >/dev/null 2>&1; do
  i=$((i + 1))
  if [ $i -ge 30 ]; then
    echo "[entrypoint] database not reachable after 60s — aborting"
    exit 1
  fi
  sleep 2
done

echo "[entrypoint] applying migrations..."
npx prisma migrate deploy --schema=prisma/schema.prisma

echo "[entrypoint] starting app"
exec "$@"
