-- ypt-bot job run logging and per-member change history.

CREATE TYPE "CronJobStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'SKIPPED');

CREATE TABLE "CronLog" (
    "id" TEXT NOT NULL,
    "jobName" VARCHAR(64) NOT NULL,
    "runId" VARCHAR(64) NOT NULL,
    "trigger" VARCHAR(32) NOT NULL,
    "status" "CronJobStatus" NOT NULL DEFAULT 'RUNNING',
    "challengeId" VARCHAR(64),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "summary" JSONB,
    "errorCode" VARCHAR(64),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CronLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CronLogChange" (
    "id" TEXT NOT NULL,
    "cronLogId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "challengeId" VARCHAR(64) NOT NULL,
    "logDate" DATE NOT NULL,
    "wasCreated" BOOLEAN NOT NULL DEFAULT false,
    "previousDurationSeconds" INTEGER,
    "newDurationSeconds" INTEGER NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "isUndone" BOOLEAN NOT NULL DEFAULT false,
    "undoneAt" TIMESTAMP(3),
    "undoneById" TEXT,
    "undoBatchId" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CronLogChange_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CronLog_runId_key" ON "CronLog"("runId");
CREATE INDEX "CronLog_jobName_startedAt_idx" ON "CronLog"("jobName", "startedAt" DESC);
CREATE INDEX "CronLog_status_startedAt_idx" ON "CronLog"("status", "startedAt" DESC);
CREATE INDEX "CronLog_challengeId_startedAt_idx" ON "CronLog"("challengeId", "startedAt" DESC);
CREATE INDEX "CronLog_startedAt_idx" ON "CronLog"("startedAt");

CREATE INDEX "CronLogChange_cronLogId_idx" ON "CronLogChange"("cronLogId");
CREATE INDEX "CronLogChange_participantId_logDate_createdAt_idx"
    ON "CronLogChange"("participantId", "logDate", "createdAt" DESC);
CREATE INDEX "CronLogChange_isUndone_idx" ON "CronLogChange"("isUndone");
CREATE INDEX "CronLogChange_createdAt_idx" ON "CronLogChange"("createdAt");

ALTER TABLE "CronLogChange"
    ADD CONSTRAINT "CronLogChange_cronLogId_fkey"
    FOREIGN KEY ("cronLogId") REFERENCES "CronLog"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CronLogChange"
    ADD CONSTRAINT "CronLogChange_participantId_fkey"
    FOREIGN KEY ("participantId") REFERENCES "ChallengeParticipant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CronLogChange"
    ADD CONSTRAINT "CronLogChange_undoneById_fkey"
    FOREIGN KEY ("undoneById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
