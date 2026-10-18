-- Add isLeave to both study log tables (FEAT-LOG-01)
-- Table names verified against schema.prisma:
--   DailyStudyLog  → no @@map  → table "DailyStudyLog"
--   DailyStudyLogV2 → @@map("study_logs_v2")
-- Live-DB state (introspected 2026-10-10, shared Supabase): "DailyStudyLog"
-- already has isLeave; "study_logs_v2" is missing it. IF NOT EXISTS keeps this
-- idempotent across all environments and fresh databases.
ALTER TABLE "DailyStudyLog" ADD COLUMN IF NOT EXISTS "isLeave" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "study_logs_v2" ADD COLUMN IF NOT EXISTS "isLeave" BOOLEAN NOT NULL DEFAULT false;
