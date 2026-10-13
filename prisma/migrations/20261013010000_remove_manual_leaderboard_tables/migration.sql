-- Drop foreign keys and tables for legacy manual leaderboard

-- DropForeignKey
ALTER TABLE "team_members" DROP CONSTRAINT IF EXISTS "team_members_team_id_fkey";

-- DropForeignKey
ALTER TABLE "team_members" DROP CONSTRAINT IF EXISTS "team_members_user_id_fkey";

-- DropForeignKey
ALTER TABLE "leaderboard_entries" DROP CONSTRAINT IF EXISTS "leaderboard_entries_challenge_id_fkey";

-- DropForeignKey
ALTER TABLE "leaderboard_entries" DROP CONSTRAINT IF EXISTS "leaderboard_entries_user_id_fkey";

-- DropTable
DROP TABLE IF EXISTS "team_members" CASCADE;

-- DropTable
DROP TABLE IF EXISTS "leaderboard_entries" CASCADE;
