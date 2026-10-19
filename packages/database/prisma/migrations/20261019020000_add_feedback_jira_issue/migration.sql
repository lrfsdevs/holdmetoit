-- CreateEnum
CREATE TYPE "JiraDeliveryStatus" AS ENUM ('PENDING', 'CREATED', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "Feedback"
    ADD COLUMN "jiraStatus" "JiraDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    ADD COLUMN "jiraIssueKey" VARCHAR(64),
    ADD COLUMN "jiraIssueUrl" VARCHAR(2048),
    ADD COLUMN "jiraSyncedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Feedback_jiraStatus_idx" ON "Feedback"("jiraStatus");
