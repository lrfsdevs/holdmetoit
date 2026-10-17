-- CreateEnum
CREATE TYPE "PokemonBannerStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ENDED', 'DISABLED');

-- CreateTable
CREATE TABLE "PokemonBanner" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "slug" VARCHAR(128) NOT NULL,
    "description" TEXT NOT NULL,
    "bannerType" VARCHAR(64) NOT NULL DEFAULT 'STANDARD',
    "status" "PokemonBannerStatus" NOT NULL DEFAULT 'DRAFT',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "pullCost" INTEGER NOT NULL,
    "allowedQuantities" INTEGER[] DEFAULT ARRAY[1]::INTEGER[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "featuredSpeciesId" TEXT,
    "rarityRates" JSONB NOT NULL,
    "poolFilter" JSONB,
    "pityConfig" JSONB,
    "duplicatePolicy" VARCHAR(64) NOT NULL DEFAULT 'ADD_COPY',
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PokemonBanner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBannerPity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bannerId" TEXT NOT NULL,
    "pityCount" INTEGER NOT NULL DEFAULT 0,
    "guaranteedFeatured" BOOLEAN NOT NULL DEFAULT false,
    "lastPullAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserBannerPity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PokemonAcquisition" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bannerId" TEXT NOT NULL,
    "bannerVersion" INTEGER NOT NULL,
    "speciesId" TEXT NOT NULL,
    "userPokemonId" TEXT,
    "rarity" "PokemonRarity" NOT NULL,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "duplicateOutcome" VARCHAR(128),
    "costPaid" INTEGER NOT NULL,
    "ledgerTransactionId" TEXT,
    "idempotencyKey" VARCHAR(255) NOT NULL,
    "pityCountBefore" INTEGER NOT NULL DEFAULT 0,
    "pityCountAfter" INTEGER NOT NULL DEFAULT 0,
    "pityTriggered" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PokemonAcquisition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PokemonBanner_slug_key" ON "PokemonBanner"("slug");

-- CreateIndex
CREATE INDEX "PokemonBanner_status_startAt_endAt_idx" ON "PokemonBanner"("status", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "PokemonBanner_slug_idx" ON "PokemonBanner"("slug");

-- CreateIndex
CREATE INDEX "PokemonBanner_featuredSpeciesId_idx" ON "PokemonBanner"("featuredSpeciesId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBannerPity_userId_bannerId_key" ON "UserBannerPity"("userId", "bannerId");

-- CreateIndex
CREATE INDEX "UserBannerPity_userId_idx" ON "UserBannerPity"("userId");

-- CreateIndex
CREATE INDEX "UserBannerPity_bannerId_idx" ON "UserBannerPity"("bannerId");

-- CreateIndex
CREATE UNIQUE INDEX "PokemonAcquisition_idempotencyKey_key" ON "PokemonAcquisition"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PokemonAcquisition_userId_createdAt_idx" ON "PokemonAcquisition"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PokemonAcquisition_bannerId_createdAt_idx" ON "PokemonAcquisition"("bannerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PokemonAcquisition_speciesId_idx" ON "PokemonAcquisition"("speciesId");

-- CreateIndex
CREATE INDEX "PokemonAcquisition_ledgerTransactionId_idx" ON "PokemonAcquisition"("ledgerTransactionId");

-- AddForeignKey
ALTER TABLE "PokemonBanner" ADD CONSTRAINT "PokemonBanner_featuredSpeciesId_fkey" FOREIGN KEY ("featuredSpeciesId") REFERENCES "PokemonSpecies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PokemonBanner" ADD CONSTRAINT "PokemonBanner_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PokemonBanner" ADD CONSTRAINT "PokemonBanner_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBannerPity" ADD CONSTRAINT "UserBannerPity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBannerPity" ADD CONSTRAINT "UserBannerPity_bannerId_fkey" FOREIGN KEY ("bannerId") REFERENCES "PokemonBanner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PokemonAcquisition" ADD CONSTRAINT "PokemonAcquisition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PokemonAcquisition" ADD CONSTRAINT "PokemonAcquisition_bannerId_fkey" FOREIGN KEY ("bannerId") REFERENCES "PokemonBanner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PokemonAcquisition" ADD CONSTRAINT "PokemonAcquisition_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "PokemonSpecies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PokemonAcquisition" ADD CONSTRAINT "PokemonAcquisition_userPokemonId_fkey" FOREIGN KEY ("userPokemonId") REFERENCES "UserPokemon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
