-- Optimistic concurrency tokens for the task sync engine.
ALTER TABLE "Category" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Task" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;
