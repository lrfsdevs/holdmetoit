-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM (
    'STUDY_REWARD',
    'CHALLENGE_REWARD',
    'WAGER_RESERVATION',
    'WAGER_SETTLEMENT',
    'WAGER_REFUND',
    'GACHA_PURCHASE',
    'TRADE_RESERVATION',
    'TRADE_SETTLEMENT',
    'TRADE_REFUND',
    'ADMIN_ADJUSTMENT',
    'REVERSAL'
);

-- CreateEnum
CREATE TYPE "RewardProcessingStatus" AS ENUM ('PROCESSED', 'FAILED', 'REVOKED');

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalBalance" INTEGER NOT NULL DEFAULT 0,
    "reservedBalance" INTEGER NOT NULL DEFAULT 0,
    "rewardProgressSeconds" INTEGER NOT NULL DEFAULT 0,
    "lifetimeEarned" INTEGER NOT NULL DEFAULT 0,
    "lifetimeSpent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerTransaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "totalDelta" INTEGER NOT NULL,
    "reservedDelta" INTEGER NOT NULL DEFAULT 0,
    "sourceType" VARCHAR(64),
    "sourceId" VARCHAR(128),
    "idempotencyKey" VARCHAR(255) NOT NULL,
    "description" VARCHAR(512) NOT NULL,
    "metadata" JSONB,
    "relatedTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyRewardRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "studySessionId" VARCHAR(128) NOT NULL,
    "sourceType" VARCHAR(64) NOT NULL DEFAULT 'DAILY_STUDY_LOG',
    "eligibleSeconds" INTEGER NOT NULL DEFAULT 0,
    "coinsCredited" INTEGER NOT NULL DEFAULT 0,
    "fractionalSecondsConsumed" INTEGER NOT NULL DEFAULT 0,
    "fractionalSecondsRemaining" INTEGER NOT NULL DEFAULT 0,
    "status" "RewardProcessingStatus" NOT NULL DEFAULT 'PROCESSED',
    "idempotencyKey" VARCHAR(255) NOT NULL,
    "ledgerTransactionId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyRewardRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "Wallet_userId_idx" ON "Wallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerTransaction_idempotencyKey_key" ON "LedgerTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "LedgerTransaction_walletId_createdAt_idx" ON "LedgerTransaction"("walletId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "LedgerTransaction_userId_createdAt_idx" ON "LedgerTransaction"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "LedgerTransaction_type_idx" ON "LedgerTransaction"("type");

-- CreateIndex
CREATE INDEX "LedgerTransaction_sourceType_sourceId_idx" ON "LedgerTransaction"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyRewardRecord_idempotencyKey_key" ON "StudyRewardRecord"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "StudyRewardRecord_sourceType_studySessionId_key" ON "StudyRewardRecord"("sourceType", "studySessionId");

-- CreateIndex
CREATE INDEX "StudyRewardRecord_userId_createdAt_idx" ON "StudyRewardRecord"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "StudyRewardRecord_walletId_idx" ON "StudyRewardRecord"("walletId");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_relatedTransactionId_fkey" FOREIGN KEY ("relatedTransactionId") REFERENCES "LedgerTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyRewardRecord" ADD CONSTRAINT "StudyRewardRecord_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyRewardRecord" ADD CONSTRAINT "StudyRewardRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
