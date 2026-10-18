-- CreateEnum
CREATE TYPE "PokemonRarity" AS ENUM ('NORMAL', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHICAL');

-- CreateEnum
CREATE TYPE "PokemonAcquisitionSource" AS ENUM ('SEED', 'ADMIN_GRANT', 'STUDY_MILESTONE', 'CHALLENGE_REWARD', 'GACHA', 'EVENT', 'TRADE');

-- CreateTable
CREATE TABLE "PokemonSpecies" (
    "id" TEXT NOT NULL,
    "pokedexNumber" INTEGER NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "slug" VARCHAR(128) NOT NULL,
    "rarity" "PokemonRarity" NOT NULL DEFAULT 'NORMAL',
    "primaryType" VARCHAR(32) NOT NULL,
    "secondaryType" VARCHAR(32),
    "description" TEXT NOT NULL,
    "classification" VARCHAR(128),
    "imageUrl" VARCHAR(512),
    "spriteUrl" VARCHAR(512),
    "spriteGifUrl" VARCHAR(512),
    "baseHp" INTEGER NOT NULL DEFAULT 0,
    "baseAttack" INTEGER NOT NULL DEFAULT 0,
    "baseDefense" INTEGER NOT NULL DEFAULT 0,
    "generation" INTEGER NOT NULL DEFAULT 1,
    "isLegendary" BOOLEAN NOT NULL DEFAULT false,
    "isMythical" BOOLEAN NOT NULL DEFAULT false,
    "isBaby" BOOLEAN NOT NULL DEFAULT false,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "sourceId" VARCHAR(64),
    "referenceUrl" VARCHAR(512),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PokemonSpecies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPokemon" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "obtainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "PokemonAcquisitionSource" NOT NULL DEFAULT 'SEED',
    "sourceReferenceId" VARCHAR(128),
    "idempotencyKey" VARCHAR(255),
    "nickname" VARCHAR(64),
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPokemon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PokemonSpecies_pokedexNumber_key" ON "PokemonSpecies"("pokedexNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PokemonSpecies_slug_key" ON "PokemonSpecies"("slug");

-- CreateIndex
CREATE INDEX "PokemonSpecies_pokedexNumber_idx" ON "PokemonSpecies"("pokedexNumber");

-- CreateIndex
CREATE INDEX "PokemonSpecies_rarity_idx" ON "PokemonSpecies"("rarity");

-- CreateIndex
CREATE INDEX "PokemonSpecies_primaryType_idx" ON "PokemonSpecies"("primaryType");

-- CreateIndex
CREATE INDEX "PokemonSpecies_generation_idx" ON "PokemonSpecies"("generation");

-- CreateIndex
CREATE INDEX "PokemonSpecies_isLegendary_idx" ON "PokemonSpecies"("isLegendary");

-- CreateIndex
CREATE INDEX "PokemonSpecies_isMythical_idx" ON "PokemonSpecies"("isMythical");

-- CreateIndex
CREATE INDEX "PokemonSpecies_isAvailable_idx" ON "PokemonSpecies"("isAvailable");

-- CreateIndex
CREATE INDEX "PokemonSpecies_name_idx" ON "PokemonSpecies"("name");

-- CreateIndex
CREATE UNIQUE INDEX "UserPokemon_idempotencyKey_key" ON "UserPokemon"("idempotencyKey");

-- CreateIndex
CREATE INDEX "UserPokemon_userId_isFavorite_idx" ON "UserPokemon"("userId", "isFavorite");

-- CreateIndex
CREATE INDEX "UserPokemon_userId_speciesId_idx" ON "UserPokemon"("userId", "speciesId");

-- CreateIndex
CREATE INDEX "UserPokemon_speciesId_idx" ON "UserPokemon"("speciesId");

-- CreateIndex
CREATE INDEX "UserPokemon_obtainedAt_idx" ON "UserPokemon"("obtainedAt");

-- AddForeignKey
ALTER TABLE "UserPokemon" ADD CONSTRAINT "UserPokemon_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPokemon" ADD CONSTRAINT "UserPokemon_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "PokemonSpecies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
