-- CreateEnum
CREATE TYPE "GitHubDeliveryStatus" AS ENUM ('PENDING', 'CREATED', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "Feedback"
    ADD COLUMN "githubStatus" "GitHubDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    ADD COLUMN "githubIssueNumber" INTEGER,
    ADD COLUMN "githubIssueUrl" VARCHAR(2048),
    ADD COLUMN "githubSyncedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Feedback_githubStatus_idx" ON "Feedback"("githubStatus");
