-- CreateEnum
CREATE TYPE "WagerStatus" AS ENUM ('PENDING', 'ACCEPTED', 'WON', 'LOST', 'REFUNDED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Challenge" ADD COLUMN "rewardCoins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "isRewardSettled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "rewardSettledAt" TIMESTAMP(3),
ADD COLUMN "isBettingEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "DailyStudyLog" ADD COLUMN "source" VARCHAR(32) NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "externalActivityId" VARCHAR(128),
ADD COLUMN "yptSubject" VARCHAR(128);

-- CreateTable
CREATE TABLE "Wager" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "stake" INTEGER NOT NULL,
    "status" "WagerStatus" NOT NULL DEFAULT 'ACCEPTED',
    "payout" INTEGER NOT NULL DEFAULT 0,
    "settledAt" TIMESTAMP(3),
    "ledgerReservationId" TEXT,
    "ledgerSettlementId" TEXT,
    "idempotencyKey" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wager_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyStudyLog_participantId_externalActivityId_idx" ON "DailyStudyLog"("participantId", "externalActivityId");

-- CreateIndex
CREATE UNIQUE INDEX "Wager_idempotencyKey_key" ON "Wager"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Wager_challengeId_status_idx" ON "Wager"("challengeId", "status");

-- CreateIndex
CREATE INDEX "Wager_userId_status_idx" ON "Wager"("userId", "status");

-- CreateIndex
CREATE INDEX "Wager_walletId_idx" ON "Wager"("walletId");

-- CreateIndex
CREATE INDEX "Wager_teamId_idx" ON "Wager"("teamId");

-- AddForeignKey
ALTER TABLE "Wager" ADD CONSTRAINT "Wager_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wager" ADD CONSTRAINT "Wager_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wager" ADD CONSTRAINT "Wager_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wager" ADD CONSTRAINT "Wager_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
