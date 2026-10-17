- always write what you changed into HANDOFF.md
- prisma/schema.prisma changes must ship with a migration under prisma/migrations/
  (enforced by scripts/check-schema-migration.sh in CI); record the DB apply step in HANDOFF.md.
