-- The master switch (`isEnabled`) is removed: `rolloutMode` is now the single control.
--   DISABLED -> off, TARGETED -> assigned testers, GLOBAL -> everyone.
-- Rows previously master-killed while set to GLOBAL/TARGETED become active by design.

ALTER TABLE "FeatureFlag" DROP COLUMN "isEnabled";

DROP INDEX IF EXISTS "FeatureFlag_isDeleted_isEnabled_idx";

CREATE INDEX "FeatureFlag_isDeleted_rolloutMode_idx"
    ON "FeatureFlag"("isDeleted", "rolloutMode");
