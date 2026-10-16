-- Normalize the Pokemon catalogue: promote denormalized `metadata` JSON into
-- dedicated columns + PokemonForm / PokemonAbility tables, then drop the column.
-- The backfill is one-time and non-reversible; take a DB backup before deploying.

-- 1. Promote metadata scalars onto PokemonSpecies
ALTER TABLE "PokemonSpecies"
    ADD COLUMN "specialAttack" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "specialDefense" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "speed" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "baseStatTotal" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "heightDecimetres" INTEGER,
    ADD COLUMN "weightHectograms" INTEGER,
    ADD COLUMN "baseExperience" INTEGER,
    ADD COLUMN "color" VARCHAR(32),
    ADD COLUMN "captureRate" INTEGER,
    ADD COLUMN "baseHappiness" INTEGER,
    ADD COLUMN "hatchCounter" INTEGER,
    ADD COLUMN "evolvesFromSpeciesId" INTEGER,
    ADD COLUMN "evolutionChainId" INTEGER,
    ADD COLUMN "growthRateId" INTEGER;

-- 2. Normalized child tables
CREATE TABLE "PokemonForm" (
    "id" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "pokemonId" INTEGER NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "slug" VARCHAR(128) NOT NULL,
    "primaryType" VARCHAR(32) NOT NULL,
    "secondaryType" VARCHAR(32),
    "baseStatTotal" INTEGER NOT NULL DEFAULT 0,
    "spritePngUrl" VARCHAR(512),
    "spriteGifUrl" VARCHAR(512),
    "officialArtworkUrl" VARCHAR(512),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PokemonForm_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PokemonAbility" (
    "id" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "slot" INTEGER NOT NULL,

    CONSTRAINT "PokemonAbility_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PokemonForm_pokemonId_key" ON "PokemonForm"("pokemonId");
CREATE UNIQUE INDEX "PokemonForm_slug_key" ON "PokemonForm"("slug");
CREATE INDEX "PokemonForm_speciesId_idx" ON "PokemonForm"("speciesId");
CREATE UNIQUE INDEX "PokemonAbility_speciesId_name_key" ON "PokemonAbility"("speciesId", "name");
CREATE INDEX "PokemonAbility_speciesId_idx" ON "PokemonAbility"("speciesId");

ALTER TABLE "PokemonForm" ADD CONSTRAINT "PokemonForm_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "PokemonSpecies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PokemonAbility" ADD CONSTRAINT "PokemonAbility_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "PokemonSpecies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Backfill scalar columns from the existing metadata JSON
UPDATE "PokemonSpecies" SET
    "specialAttack"        = COALESCE((metadata->>'specialAttack')::int, 0),
    "specialDefense"       = COALESCE((metadata->>'specialDefense')::int, 0),
    "speed"                = COALESCE((metadata->>'speed')::int, 0),
    "baseStatTotal"        = COALESCE((metadata->>'baseStatTotal')::int, 0),
    "heightDecimetres"     = (metadata->>'heightDecimetres')::int,
    "weightHectograms"     = (metadata->>'weightHectograms')::int,
    "baseExperience"       = (metadata->>'baseExperience')::int,
    "color"                = metadata->>'color',
    "captureRate"          = (metadata->>'captureRate')::int,
    "baseHappiness"        = (metadata->>'baseHappiness')::int,
    "hatchCounter"         = (metadata->>'hatchCounter')::int,
    "evolvesFromSpeciesId" = (metadata->>'evolvesFromSpeciesId')::int,
    "evolutionChainId"     = (metadata->>'evolutionChainId')::int,
    "growthRateId"         = (metadata->>'growthRateId')::int
WHERE metadata IS NOT NULL;

-- 4. Backfill abilities
INSERT INTO "PokemonAbility" ("id", "speciesId", "name", "isHidden", "slot")
SELECT gen_random_uuid()::text,
       s."id",
       a->>'name',
       COALESCE((a->>'isHidden')::boolean, false),
       COALESCE((a->>'slot')::int, 1)
FROM "PokemonSpecies" s
CROSS JOIN LATERAL jsonb_array_elements(s.metadata->'abilities') AS a
WHERE jsonb_typeof(s.metadata->'abilities') = 'array'
  AND a->>'name' IS NOT NULL
ON CONFLICT ("speciesId", "name") DO NOTHING;

-- 5. Backfill alternate forms (name/slug/types are canonical from the bundle)
INSERT INTO "PokemonForm" ("id", "speciesId", "pokemonId", "name", "slug", "primaryType", "secondaryType", "baseStatTotal", "spritePngUrl", "spriteGifUrl", "officialArtworkUrl")
SELECT gen_random_uuid()::text,
       s."id",
       (f->>'pokemonId')::int,
       f->>'name',
       f->>'slug',
       COALESCE(upper(f->'types'->>0), 'NORMAL'),
       upper(f->'types'->>1),
       COALESCE((f->>'baseStatTotal')::int, 0),
       f->>'spritePngUrl',
       f->>'spriteGifUrl',
       f->>'officialArtworkUrl'
FROM "PokemonSpecies" s
CROSS JOIN LATERAL jsonb_array_elements(s.metadata->'forms') AS f
WHERE jsonb_typeof(s.metadata->'forms') = 'array'
  AND f->>'pokemonId' IS NOT NULL
ON CONFLICT ("pokemonId") DO NOTHING;

-- 6. Drop the now-unused denormalized column
ALTER TABLE "PokemonSpecies" DROP COLUMN "metadata";
