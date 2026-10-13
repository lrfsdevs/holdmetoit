-- Soft delete for Challenge, Team, Category, Task
-- Adds is_deleted (boolean, default false) and deletion_time (timestamp)

-- 1. Challenges
ALTER TABLE "Challenge" ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Challenge" ADD COLUMN IF NOT EXISTS "deletion_time" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Challenge_is_deleted_startAt_idx" ON "Challenge"("is_deleted", "startAt");

-- 2. Teams
ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS "deletion_time" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Team_challengeId_is_deleted_idx" ON "Team"("challengeId", "is_deleted");

-- 3. Categories
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT false;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE "categories" RENAME COLUMN "deleted_at" TO "deletion_time";
  ELSE
    ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "deletion_time" TIMESTAMP(3);
  END IF;
END $$;
UPDATE "categories" SET "is_deleted" = true WHERE "deletion_time" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "categories_userId_task_type_is_deleted_idx" ON "categories"("userId", "task_type", "is_deleted");

-- 4. Tasks
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT false;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE "tasks" RENAME COLUMN "deleted_at" TO "deletion_time";
  ELSE
    ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "deletion_time" TIMESTAMP(3);
  END IF;
END $$;
UPDATE "tasks" SET "is_deleted" = true WHERE "deletion_time" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "tasks_userId_task_type_is_deleted_idx" ON "tasks"("userId", "task_type", "is_deleted");
CREATE INDEX IF NOT EXISTS "tasks_categoryId_is_deleted_idx" ON "tasks"("categoryId", "is_deleted");
CREATE INDEX IF NOT EXISTS "tasks_challenge_id_is_deleted_idx" ON "tasks"("challenge_id", "is_deleted");
