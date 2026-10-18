-- CreateEnum
CREATE TYPE "YptConnectionStatus" AS ENUM (
    'NOT_CONNECTED',
    'CONNECTING',
    'CONNECTED',
    'PENDING_VERIFICATION',
    'VERIFIED',
    'REJECTED',
    'SYNC_ERROR',
    'REAUTHENTICATION_REQUIRED'
);

-- AlterTable
ALTER TABLE "YptIdentityClaim" ADD COLUMN IF NOT EXISTS "groupId" VARCHAR(64);

-- CreateTable: YptConnection
CREATE TABLE IF NOT EXISTS "YptConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "yptUserId" VARCHAR(64) NOT NULL,
    "yptNickname" VARCHAR(128),
    "status" "YptConnectionStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
    "encryptedRefreshToken" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YptConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "YptConnection_userId_key" ON "YptConnection"("userId");
CREATE INDEX IF NOT EXISTS "YptConnection_yptUserId_idx" ON "YptConnection"("yptUserId");

-- AddForeignKey
ALTER TABLE "YptConnection" ADD CONSTRAINT "YptConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: YptSyncRun
CREATE TABLE IF NOT EXISTS "YptSyncRun" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "importedDurationSeconds" INTEGER NOT NULL DEFAULT 0,
    "eligibleDurationSeconds" INTEGER NOT NULL DEFAULT 0,
    "coinsCredited" INTEGER NOT NULL DEFAULT 0,
    "errorCode" VARCHAR(64),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YptSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "YptSyncRun_userId_createdAt_idx" ON "YptSyncRun"("userId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "YptSyncRun" ADD CONSTRAINT "YptSyncRun_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "YptConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "YptSyncRun" ADD CONSTRAINT "YptSyncRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: Preserve any existing user who has yptId linked into YptConnection
INSERT INTO "YptConnection" ("id", "userId", "yptUserId", "yptNickname", "status", "createdAt", "updatedAt")
SELECT 
    'conn_' || substr(md5(random()::text || clock_timestamp()::text), 1, 24),
    u."id",
    u."yptId",
    COALESCE(u."displayName", u."name", 'Verified Participant'),
    'VERIFIED'::"YptConnectionStatus",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User" u
WHERE u."yptId" IS NOT NULL
ON CONFLICT ("userId") DO NOTHING;
