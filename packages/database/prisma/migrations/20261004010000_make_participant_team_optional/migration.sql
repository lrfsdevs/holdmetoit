-- DropForeignKey
ALTER TABLE "ChallengeParticipant" DROP CONSTRAINT IF EXISTS "ChallengeParticipant_teamId_fkey";

-- AlterTable
ALTER TABLE "ChallengeParticipant" ALTER COLUMN "teamId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "ChallengeParticipant" ADD CONSTRAINT "ChallengeParticipant_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
