-- Replace exact-case uniqueness with case-insensitive uniqueness over active
-- teams only. Soft-deleted teams must not block reusing a name.
DROP INDEX IF EXISTS "Team_challengeId_name_key";

CREATE UNIQUE INDEX "Team_challengeId_lower_name_active_key"
ON "Team" ("challengeId", LOWER("name"))
WHERE "isDeleted" = false;
