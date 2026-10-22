-- Participant self-withdrawal (soft state only; history is preserved).
ALTER TABLE "ChallengeParticipant"
    ADD COLUMN "isWithdrawn" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "withdrawalAt" TIMESTAMP(3);

CREATE INDEX "ChallengeParticipant_challengeId_isWithdrawn_idx"
    ON "ChallengeParticipant"("challengeId", "isWithdrawn");
