#!/usr/bin/env bash
# Guard: a prisma/schema.prisma change must ship with a DB step.
# The production database is push-managed (see ISSUES.md D5): nothing in the
# build pipeline syncs the schema, so a schema change without a migration file
# is exactly how the PR #67 isLeave incident shipped.
set -euo pipefail

BASE="${1:-origin/main}"

schema_changed=$(git diff --name-only "$BASE...HEAD" -- packages/database/prisma/schema.prisma | wc -l)
migrations_changed=$(git diff --name-only "$BASE...HEAD" -- packages/database/prisma/migrations | wc -l)

if [ "$schema_changed" -gt 0 ] && [ "$migrations_changed" -eq 0 ]; then
  echo "::error::packages/database/prisma/schema.prisma changed without a migration."
  echo "::error::Add packages/database/prisma/migrations/<timestamp>_<name>/migration.sql and record the DB apply step (prisma db execute / db push) in HANDOFF.md."
  exit 1
fi

echo "Schema migration guard passed (schema_changed=$schema_changed, migrations_changed=$migrations_changed)."
