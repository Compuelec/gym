#!/bin/sh
# Integration test of the backup scripts against the e2e stack's Postgres (real pg_dump/pg_restore
# in the same pinned image the cluster uses). Run: sh deploy/backup/backup.test.sh
set -eu
IMAGE='postgres:17-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24'
NET=gym-e2e_default
DIR=$(mktemp -d)
trap 'rm -rf "$DIR"' EXIT
here=$(cd "$(dirname "$0")" && pwd)
run() {
  docker run --rm --network "$NET" -v "$DIR:/backups" -v "$here:/scripts:ro" \
    -e PGHOST="${PGHOST_OVERRIDE:-postgres}" -e PGUSER=gym -e PGPASSWORD=gym -e PGDATABASE=gym_e2e \
    -e BACKUP_DIR=/backups "$@"
}
fail() { echo "FAIL: $1"; exit 1; }

echo "1) daily backup creates a restorable dump"
run "$IMAGE" sh /scripts/backup.sh | grep -q 'backup ok' || fail 'backup did not report ok'
ls "$DIR"/gym-2*.dump >/dev/null 2>&1 || fail 'no daily dump file'

echo "2) restore test succeeds and cleans up the scratch database"
run "$IMAGE" sh /scripts/verify.sh | grep -q 'verify ok' || fail 'verify did not report ok'
left=$(run "$IMAGE" psql -Atc "select count(*) from pg_database where datname='gym_verify'")
[ "$left" = "0" ] || fail 'scratch database was not dropped'

echo "3) pre-migration backups use their own prefix and are not rotated with daily ones"
run -e PREFIX=gym-premigrate "$IMAGE" sh /scripts/backup.sh >/dev/null
ls "$DIR"/gym-premigrate-*.dump >/dev/null 2>&1 || fail 'no pre-migration dump'

echo "4) a failing backup exits non-zero and leaves no partial file (so a migration would not run)"
before=$(ls "$DIR" | wc -l)
if PGHOST_OVERRIDE=nowhere run "$IMAGE" sh /scripts/backup.sh >/dev/null 2>&1; then fail 'backup with a bad host succeeded'; fi
after=$(ls -A "$DIR" | wc -l)
[ "$before" = "$after" ] || fail 'partial file left behind'

echo "5) the ConfigMap matches the scripts"
node scripts/gen-backup-configmap.mjs --check || fail 'configmap out of date'

echo "backup tests: all passed"
