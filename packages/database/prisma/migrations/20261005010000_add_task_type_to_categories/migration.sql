-- AlterTable
ALTER TABLE "categories" ADD COLUMN "task_type" "TaskType" NOT NULL DEFAULT 'DAILY';

-- Drop old unique constraint on (userId, name) so we can have same name for different task types
DROP INDEX IF EXISTS "categories_userId_name_key";
DROP INDEX IF EXISTS "categories_userId_idx";

-- Migrate categories that only have WEEKLY tasks
UPDATE "categories" c
SET "task_type" = 'WEEKLY'
WHERE EXISTS (
    SELECT 1 FROM "tasks" t WHERE t."categoryId" = c.id AND t."task_type" = 'WEEKLY'
)
AND NOT EXISTS (
    SELECT 1 FROM "tasks" t WHERE t."categoryId" = c.id AND t."task_type" = 'DAILY'
);

-- For any category containing both DAILY and WEEKLY tasks, create a WEEKLY twin and re-assign tasks
DO $$
DECLARE
    r RECORD;
    new_cat_id TEXT;
BEGIN
    FOR r IN
        SELECT c.id, c."userId", c."name"
        FROM "categories" c
        WHERE EXISTS (
            SELECT 1 FROM "tasks" t WHERE t."categoryId" = c.id AND t."task_type" = 'DAILY'
        )
        AND EXISTS (
            SELECT 1 FROM "tasks" t WHERE t."categoryId" = c.id AND t."task_type" = 'WEEKLY'
        )
    LOOP
        new_cat_id := gen_random_uuid()::text;
        INSERT INTO "categories" ("id", "userId", "name", "task_type", "createdAt", "updatedAt")
        VALUES (new_cat_id, r."userId", r."name", 'WEEKLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

        UPDATE "tasks"
        SET "categoryId" = new_cat_id
        WHERE "categoryId" = r.id AND "task_type" = 'WEEKLY';
    END LOOP;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX "categories_userId_name_task_type_key" ON "categories"("userId", "name", "task_type");

-- CreateIndex
CREATE INDEX "categories_userId_task_type_idx" ON "categories"("userId", "task_type");
