-- Challenge Wrapped: participant flags + punishment record trim (pardon fields kept).
-- Row presence now means "punished": remove legacy saved rows, keep pardoned rows.
DELETE FROM "PunishmentRecord" WHERE "isPunished" IS NOT TRUE AND "isPardoned" IS NOT TRUE;

ALTER TABLE "ChallengeParticipant" ADD COLUMN "isWrappedSeen" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ChallengeParticipant" ADD COLUMN "isFeedbackFilled" BOOLEAN NOT NULL DEFAULT false;

DROP INDEX IF EXISTS "PunishmentRecord_isPunished_idx";
ALTER TABLE "PunishmentRecord"
  DROP COLUMN "isPunished",
  DROP COLUMN "hoursDeficitSeconds",
  DROP COLUMN "incompleteGoalsCount";

DROP INDEX IF EXISTS "PunishmentRecord_participantId_key";
CREATE INDEX "PunishmentRecord_participantId_idx" ON "PunishmentRecord"("participantId");
