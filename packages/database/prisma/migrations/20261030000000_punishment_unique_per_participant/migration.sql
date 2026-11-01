-- One punishment row per participant per challenge.
--
-- Pre-check (run manually before applying; must return zero rows):
--
--   SELECT "challengeId", "participantId", COUNT(*) AS duplicates
--   FROM "PunishmentRecord"
--   GROUP BY 1, 2
--   HAVING COUNT(*) > 1;
--
-- If the pre-check returns rows, resolve them with
-- `apps/web/scripts/dedupe-punishment-records.ts` (dry-run by default)
-- before applying this migration. The index creation fails loudly rather
-- than deleting data.

CREATE UNIQUE INDEX "PunishmentRecord_challengeId_participantId_key"
ON "PunishmentRecord" ("challengeId", "participantId");
