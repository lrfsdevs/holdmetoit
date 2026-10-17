-- CreateEnum
CREATE TYPE "YptClaimStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "TrophyTransactionType" AS ENUM ('CHALLENGE_WIN', 'CHALLENGE_LOSS', 'ADMIN_ADJUSTMENT', 'REVERSAL', 'SEASON_RESET');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "trophyBalance" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "YptIdentityClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "selectedUserId" TEXT,
    "yptId" VARCHAR(64) NOT NULL,
    "yptName" VARCHAR(128),
    "status" "YptClaimStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YptIdentityClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrophyTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" VARCHAR(64),
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "type" "TrophyTransactionType" NOT NULL,
    "sourceType" VARCHAR(64),
    "sourceId" VARCHAR(128),
    "idempotencyKey" VARCHAR(255),
    "description" VARCHAR(512) NOT NULL,
    "metadata" JSONB,
    "relatedTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrophyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_trophyBalance_idx" ON "User"("trophyBalance" DESC);

-- CreateIndex
CREATE INDEX "YptIdentityClaim_userId_status_idx" ON "YptIdentityClaim"("userId", "status");

-- CreateIndex
CREATE INDEX "YptIdentityClaim_yptId_status_idx" ON "YptIdentityClaim"("yptId", "status");

-- CreateIndex
CREATE INDEX "YptIdentityClaim_status_createdAt_idx" ON "YptIdentityClaim"("status", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "TrophyTransaction_idempotencyKey_key" ON "TrophyTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "TrophyTransaction_userId_createdAt_idx" ON "TrophyTransaction"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "TrophyTransaction_type_idx" ON "TrophyTransaction"("type");

-- CreateIndex
CREATE INDEX "TrophyTransaction_sourceType_sourceId_idx" ON "TrophyTransaction"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "TrophyTransaction_groupId_idx" ON "TrophyTransaction"("groupId");

-- AddForeignKey
ALTER TABLE "YptIdentityClaim" ADD CONSTRAINT "YptIdentityClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YptIdentityClaim" ADD CONSTRAINT "YptIdentityClaim_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrophyTransaction" ADD CONSTRAINT "TrophyTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrophyTransaction" ADD CONSTRAINT "TrophyTransaction_relatedTransactionId_fkey" FOREIGN KEY ("relatedTransactionId") REFERENCES "TrophyTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill existing verified YPT users so they are not broken (Requirement 35)
INSERT INTO "YptIdentityClaim" ("id", "userId", "yptId", "yptName", "status", "createdAt", "updatedAt")
SELECT
    'claim_migrated_' || u.id,
    u.id,
    u."yptId",
    COALESCE(u."displayName", u.name, u.username, 'Verified User'),
    'VERIFIED'::"YptClaimStatus",
    NOW(),
    NOW()
FROM "User" u
WHERE u."yptId" IS NOT NULL
ON CONFLICT ("id") DO NOTHING;
