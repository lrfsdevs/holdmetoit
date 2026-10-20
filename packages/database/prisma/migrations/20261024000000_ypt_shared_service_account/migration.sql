-- YPT shared service account linking.
-- The platform now reads study time through a shared service account, so the
-- per-user YPT refresh token is no longer stored or needed.
ALTER TABLE "YptConnection" DROP COLUMN IF EXISTS "encryptedRefreshToken";
