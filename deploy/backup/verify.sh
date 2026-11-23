#!/bin/sh
# Monthly restore test: restores the newest daily backup into a scratch database, checks it has
# data, and drops it. Fails (non-zero exit) when the backup can't be restored.
set -eu
: "${BACKUP_DIR:?}"
latest=$(ls -1t "$BACKUP_DIR"/gym-2*.dump 2>/dev/null | head -n 1)
[ -n "$latest" ] || { echo "verify failed: no backups in $BACKUP_DIR"; exit 1; }
scratch="gym_verify"

dropdb --if-exists "$scratch"
createdb "$scratch"
trap 'dropdb --if-exists "$scratch"' EXIT
pg_restore --no-owner --exit-on-error --dbname="$scratch" "$latest"
users=$(psql --dbname="$scratch" -Atc 'select count(*) from "user"')
migrations=$(psql --dbname="$scratch" -Atc 'select count(*) from drizzle.__drizzle_migrations')
[ "$migrations" -gt 0 ] || { echo "verify failed: $latest restored without schema"; exit 1; }
echo "verify ok: $latest restored (users=$users, migrations=$migrations)"
