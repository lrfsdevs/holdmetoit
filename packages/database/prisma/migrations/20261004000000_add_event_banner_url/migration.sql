-- Incremental migration: the existing db-push schema must be baselined before
-- deploying this migration to an existing database. This is not an initial schema.
ALTER TABLE "Challenge" ADD COLUMN "eventBannerUrl" TEXT;

-- Preserve existing header artwork without changing the PFP or storage objects.
UPDATE "Challenge"
SET "eventBannerUrl" = "punishmentPfpUrl";
