-- Challenge-linked tasks + soft delete (soft-deleted rows still count at challenge lock).
ALTER TABLE "tasks" ADD COLUMN "challenge_id" TEXT;
ALTER TABLE "tasks" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "categories" ADD COLUMN "deleted_at" TIMESTAMP(3);

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_challenge_id_fkey"
  FOREIGN KEY ("challenge_id") REFERENCES "Challenge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "tasks_challenge_id_idx" ON "tasks"("challenge_id");

-- One-time backfill: link all existing tasks to the current October challenge.
UPDATE "tasks" SET "challenge_id" = (
  SELECT c."id" FROM "Challenge" c
  ORDER BY (CURRENT_TIMESTAMP >= c."startAt" AND CURRENT_TIMESTAMP <= c."endAt") DESC, c."createdAt" DESC
  LIMIT 1
) WHERE "challenge_id" IS NULL;
