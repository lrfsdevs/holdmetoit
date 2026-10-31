-- Replace exact-case uniqueness with case-insensitive uniqueness over active
-- categories only. Soft-deleted (tombstoned) names must be reusable.
--
-- Pre-check (must return zero rows):
--
--   SELECT "userId", LOWER("name") AS normalized, "taskType", COUNT(*) AS duplicates
--   FROM "Category"
--   WHERE "isDeleted" = false
--   GROUP BY 1, 2, 3
--   HAVING COUNT(*) > 1;
--
-- Resolve duplicates with apps/web/scripts/dedupe-categories.ts before applying.
-- The index creation fails closed rather than deleting data.

DROP INDEX IF EXISTS "categories_userId_name_task_type_key";

CREATE UNIQUE INDEX "Category_userId_lower_name_taskType_active_key"
ON "Category" ("userId", LOWER("name"), "taskType")
WHERE "isDeleted" = false;
