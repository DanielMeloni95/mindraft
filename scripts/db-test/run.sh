#!/usr/bin/env bash
# Applies every migration to a throwaway Postgres database and runs the
# RLS / schema expectations against it. Requires a reachable Postgres 15+.
#
#   PGURL=postgres://postgres@localhost:5432/postgres ./scripts/db-test/run.sh
#
# The script creates (and drops) a database named mindraft_verify.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PGURL="${PGURL:-postgres://postgres@localhost:5432/postgres}"
DB_NAME="${DB_NAME:-mindraft_verify}"

if [[ "$PGURL" == *"?"* ]]; then
  query="?${PGURL#*\?}"
  without_query="${PGURL%%\?*}"
else
  query=""
  without_query="$PGURL"
fi
target="${without_query%/*}/${DB_NAME}${query}"

echo "› resetting ${DB_NAME}"
psql "$PGURL" -v ON_ERROR_STOP=1 -q -c "drop database if exists ${DB_NAME} with (force);" >/dev/null
psql "$PGURL" -v ON_ERROR_STOP=1 -q -c "create database ${DB_NAME};" >/dev/null

echo "› applying supabase stub"
psql "$target" -v ON_ERROR_STOP=1 -q -f "$ROOT/scripts/db-test/00_supabase_stub.sql"

for file in "$ROOT"/supabase/migrations/*.sql; do
  echo "› applying $(basename "$file")"
  psql "$target" -v ON_ERROR_STOP=1 -q -f "$file"
done

echo "› running expectations"
psql "$target" -v ON_ERROR_STOP=1 -q -f "$ROOT/scripts/db-test/99_rls_tests.sql"

echo "› dropping ${DB_NAME}"
psql "$PGURL" -q -c "drop database if exists ${DB_NAME} with (force);" >/dev/null
echo "✓ database verification complete"
