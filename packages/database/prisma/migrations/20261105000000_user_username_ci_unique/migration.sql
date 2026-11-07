-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "usernameChangedAt" TIMESTAMP(3);

-- Verify no case-insensitive duplicate usernames exist before creating unique index
DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT LOWER("username")
        FROM "User"
        WHERE "username" IS NOT NULL
        GROUP BY LOWER("username")
        HAVING COUNT(*) > 1
    ) sub;

    IF duplicate_count > 0 THEN
        RAISE EXCEPTION 'Cannot create unique index "User_lower_username_key": found % case-insensitive duplicate username group(s). Run "npx tsx scripts/dedupe-usernames.ts --apply" before deploying this migration.', duplicate_count;
    END IF;
END $$;

-- Create partial case-insensitive unique index on User.username
CREATE UNIQUE INDEX IF NOT EXISTS "User_lower_username_key"
ON "User" (LOWER("username"))
WHERE "username" IS NOT NULL;
