- always write what you changed into the root `HANDOFF.md` (single relay document)
- prisma/schema.prisma changes must ship with a migration under prisma/migrations/
  (enforced by scripts/check-schema-migration.sh in CI); record the DB apply step in
  the root `HANDOFF.md`.
