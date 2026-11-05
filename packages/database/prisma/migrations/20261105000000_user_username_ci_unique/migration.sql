-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "usernameChangedAt" TIMESTAMP(3);

-- Create partial case-insensitive unique index on User.username
CREATE UNIQUE INDEX IF NOT EXISTS "User_lower_username_key"
ON "User" (LOWER("username"))
WHERE "username" IS NOT NULL;
