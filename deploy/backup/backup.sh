#!/bin/sh
# Database backup for Gym (custom format, restorable with pg_restore). Same scheme as Al Día.
# Env: PGHOST, PGUSER, PGPASSWORD, PGDATABASE, BACKUP_DIR, KEEP_DAYS (30), KEEP_MIN (7),
#      PREFIX (gym; the migrate job uses gym-premigrate).
set -eu
: "${BACKUP_DIR:?}" "${PGDATABASE:?}"
KEEP_DAYS="${KEEP_DAYS:-30}"
KEEP_MIN="${KEEP_MIN:-7}"
PREFIX="${PREFIX:-gym}"
ts=$(date +%Y%m%d-%H%M%S)
partial="$BACKUP_DIR/.$PREFIX-$ts.dump.partial"
out="$BACKUP_DIR/$PREFIX-$ts.dump"

# Never leave a half-written file behind, whatever fails.
trap 'rm -f "$partial"' EXIT
pg_dump --format=custom --no-owner --file="$partial" "$PGDATABASE"
# A dump that pg_restore can't list is corrupt: never keep it as a backup.
pg_restore --list "$partial" > /dev/null
mv "$partial" "$out"

# Retention (daily backups only): drop older than KEEP_DAYS, always keep the newest KEEP_MIN.
if [ "$PREFIX" = "gym" ]; then
  ls -1t "$BACKUP_DIR"/gym-2*.dump | tail -n +"$((KEEP_MIN + 1))" | while read -r f; do
    if [ -n "$(find "$f" -mtime +"$KEEP_DAYS")" ]; then rm -f "$f" && echo "removed old backup: $f"; fi
  done
fi

echo "backup ok: $out ($(du -h "$out" | cut -f1))"
