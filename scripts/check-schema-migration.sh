#!/usr/bin/env bash
# Guard: a prisma/schema.prisma datamodel change must ship with a DB step.
# The production database is push-managed (see ISSUES.md D5): nothing in the
# build pipeline syncs the schema, so a datamodel change without a migration file
# is exactly how the PR #67 isLeave incident shipped.
# Config-only edits (generator / datasource blocks or comments) are safely ignored.
set -euo pipefail

BASE="${1:-origin/main}"

filter_datamodel() {
  awk '
    /^[[:space:]]*(generator|datasource)[[:space:]]+[^{]+{/ { in_block=1; next }
    in_block && /^[[:space:]]*}/ { in_block=0; next }
    in_block { next }
    /^[[:space:]]*(\/\/|$)/ { next }
    { print }
  '
}

schema_changed=0
if git cat-file -e "$BASE:packages/database/prisma/schema.prisma" 2>/dev/null; then
  if ! diff -u -w \
    <(git show "$BASE:packages/database/prisma/schema.prisma" | filter_datamodel) \
    <(filter_datamodel < packages/database/prisma/schema.prisma) > /dev/null 2>&1; then
    schema_changed=1
  fi
else
  # Base branch has no schema.prisma; check if file exists in HEAD
  if [ -f packages/database/prisma/schema.prisma ]; then
    schema_changed=1
  fi
fi

migrations_changed=$(git diff --name-only "$BASE...HEAD" -- packages/database/prisma/migrations | wc -l)

if [ "$schema_changed" -gt 0 ] && [ "$migrations_changed" -eq 0 ]; then
  echo "::error::packages/database/prisma/schema.prisma datamodel changed without a migration."
  echo "::error::Add packages/database/prisma/migrations/<timestamp>_<name>/migration.sql and record the DB apply step (prisma db execute / db push) in HANDOFF.md."
  exit 1
fi

echo "Schema migration guard passed (datamodel_changed=$schema_changed, migrations_changed=$migrations_changed)."
