-- Unify DailyStudyLog (drop legacy V1, promote DailyStudyLogV2 to DailyStudyLog)
-- Add plannedLeaveDays and usedLeaveDays to ChallengeParticipant

-- 1. Drop old unused DailyStudyLog table and its constraints
DROP TABLE IF EXISTS "DailyStudyLog" CASCADE;

-- 2. Rename DailyStudyLogV2 to DailyStudyLog
ALTER TABLE "DailyStudyLogV2" RENAME TO "DailyStudyLog";

-- 3. Rename constraints and indexes to canonical DailyStudyLog names
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'study_logs_v2_pkey') THEN
    ALTER TABLE "DailyStudyLog" RENAME CONSTRAINT "study_logs_v2_pkey" TO "DailyStudyLog_pkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'study_logs_v2_overrideById_fkey') THEN
    ALTER TABLE "DailyStudyLog" RENAME CONSTRAINT "study_logs_v2_overrideById_fkey" TO "DailyStudyLog_overrideById_fkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'study_logs_v2_participantId_fkey') THEN
    ALTER TABLE "DailyStudyLog" RENAME CONSTRAINT "study_logs_v2_participantId_fkey" TO "DailyStudyLog_participantId_fkey";
  END IF;
END $$;

ALTER INDEX IF EXISTS "study_logs_v2_logDate_idx" RENAME TO "DailyStudyLog_logDate_idx";
ALTER INDEX IF EXISTS "study_logs_v2_participantId_idx" RENAME TO "DailyStudyLog_participantId_idx";
ALTER INDEX IF EXISTS "study_logs_v2_participantId_logDate_key" RENAME TO "DailyStudyLog_participantId_logDate_key";

-- 4. Add plannedLeaveDays and usedLeaveDays columns to ChallengeParticipant
ALTER TABLE "ChallengeParticipant" ADD COLUMN IF NOT EXISTS "plannedLeaveDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ChallengeParticipant" ADD COLUMN IF NOT EXISTS "usedLeaveDays" INTEGER NOT NULL DEFAULT 0;

-- 5. Backfill usedLeaveDays from existing DailyStudyLog records where isLeave = true
UPDATE "ChallengeParticipant" cp
SET "usedLeaveDays" = COALESCE((
    SELECT COUNT(*)::int
    FROM "DailyStudyLog" dsl
    WHERE dsl."participantId" = cp.id AND dsl."isLeave" = true
), 0);
