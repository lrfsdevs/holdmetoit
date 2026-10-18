-- DropIndex
DROP INDEX IF EXISTS "Challenge_status_idx";

-- AlterTable
ALTER TABLE "Challenge" DROP COLUMN IF EXISTS "status";

-- DropEnum
DROP TYPE IF EXISTS "ChallengeStatus";
