/**
 * HoldMeToIt — Pokemon Catalogue Seeder (one-off, offline)
 *
 * Reads a raw Pokemon metadata bundle and writes the NORMALIZED catalogue
 * (PokemonSpecies + PokemonForm + PokemonAbility) into the database.
 *
 * Usage:
 *   npm run db:seed:pokemon
 *   npm run db:seed:pokemon -- --file=./pokemon_metadata.json
 *   npm run db:seed:pokemon -- --limit=20 --dry-run
 */

import fs from "fs";
import path from "path";
import {
   PrismaClient,
   PokemonRarity as PrismaPokemonRarity,
} from "@prisma/client";
import { calculateHoldMeToItRarity } from "../features/pokemon/domain/pokemon-rarity";

interface RawAbility {
   name: string;
   is_hidden: boolean;
   slot: number;
}

interface RawPokemonBundleItem {
   pokemon_id: number;
   pokemon_name: string;
   pokemon_slug: string;
   species_id: number;
   species_name: string;
   genus: string | null;
   is_default_form: boolean;
   generation_id: number;
   type_1: string;
   type_2: string | null;
   abilities: RawAbility[];
   hp: number;
   attack: number;
   defense: number;
   special_attack: number;
   special_defense: number;
   speed: number;
   base_stat_total: number;
   height_decimetres: number | null;
   weight_hectograms: number | null;
   base_experience: number | null;
   color: string | null;
   capture_rate: number | null;
   base_happiness: number | null;
   hatch_counter: number | null;
   is_baby: boolean;
   is_legendary: boolean;
   is_mythical: boolean;
   evolves_from_species_id: number | null;
   evolution_chain_id: number | null;
   growth_rate_id: number | null;
   sprite_gif_url: string | null;
   sprite_png_url: string | null;
   official_artwork_url: string | null;
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const fileArg = args.find((a) => a.startsWith("--file="));
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : undefined;
const filePath = fileArg
   ? fileArg.split("=")[1]
   : path.resolve(process.cwd(), "pokemon_metadata.json");

function buildSpeciesPayload(
   item: RawPokemonBundleItem,
   forms: RawPokemonBundleItem[]
) {
   const rarity = calculateHoldMeToItRarity({
      isMythical: item.is_mythical,
      isLegendary: item.is_legendary,
      baseStatTotal: item.base_stat_total,
   }) as PrismaPokemonRarity;

   const classification = item.genus || `${item.species_name} Pokémon`;
   const description = item.genus
      ? `Known as the ${item.genus}. First discovered in Generation ${item.generation_id}.`
      : `Discovered in Generation ${item.generation_id}.`;

   return {
      pokedexNumber: item.species_id,
      name: item.pokemon_name,
      slug: item.pokemon_slug,
      rarity,
      primaryType: item.type_1.toUpperCase(),
      secondaryType: item.type_2 ? item.type_2.toUpperCase() : null,
      description,
      classification,
      imageUrl: item.official_artwork_url || null,
      spriteUrl: item.sprite_png_url || null,
      spriteGifUrl: item.sprite_gif_url || null,
      baseHp: item.hp,
      baseAttack: item.attack,
      baseDefense: item.defense,
      specialAttack: item.special_attack,
      specialDefense: item.special_defense,
      speed: item.speed,
      baseStatTotal: item.base_stat_total,
      heightDecimetres: item.height_decimetres,
      weightHectograms: item.weight_hectograms,
      baseExperience: item.base_experience,
      color: item.color,
      captureRate: item.capture_rate,
      baseHappiness: item.base_happiness,
      hatchCounter: item.hatch_counter,
      evolvesFromSpeciesId: item.evolves_from_species_id,
      evolutionChainId: item.evolution_chain_id,
      growthRateId: item.growth_rate_id,
      generation: item.generation_id,
      isLegendary: Boolean(item.is_legendary),
      isMythical: Boolean(item.is_mythical),
      isBaby: Boolean(item.is_baby),
      isAvailable: true,
      sourceId: String(item.pokemon_id),
      referenceUrl: `https://www.pokemon.com/us/pokedex/${item.pokemon_slug}`,
      forms: forms.map((f) => ({
         pokemonId: f.pokemon_id,
         name: f.pokemon_name,
         slug: f.pokemon_slug,
         primaryType: f.type_1.toUpperCase(),
         secondaryType: f.type_2 ? f.type_2.toUpperCase() : null,
         baseStatTotal: f.base_stat_total,
         spritePngUrl: f.sprite_png_url || null,
         spriteGifUrl: f.sprite_gif_url || null,
         officialArtworkUrl: f.official_artwork_url || null,
      })),
      abilities: item.abilities.map((a) => ({
         name: a.name,
         isHidden: Boolean(a.is_hidden),
         slot: a.slot,
      })),
   };
}

async function main() {
   if (!fs.existsSync(filePath)) {
      throw new Error(`Pokemon metadata bundle file not found at: ${filePath}`);
   }

   const rawItems: RawPokemonBundleItem[] = JSON.parse(
      fs.readFileSync(filePath, "utf-8")
   );

   const formsBySpeciesId = new Map<number, RawPokemonBundleItem[]>();
   const defaultSpecies: RawPokemonBundleItem[] = [];
   for (const item of rawItems) {
      if (item.is_default_form) {
         defaultSpecies.push(item);
      } else {
         const existing = formsBySpeciesId.get(item.species_id) || [];
         existing.push(item);
         formsBySpeciesId.set(item.species_id, existing);
      }
   }

   const targets = limit ? defaultSpecies.slice(0, limit) : defaultSpecies;

   console.log(
      `[seed-pokemon] Source rows: ${rawItems.length} | canonical species: ${targets.length} | alternate forms: ${Array.from(formsBySpeciesId.values()).reduce((n, f) => n + f.length, 0)}`
   );
   console.log(`[seed-pokemon] Target file: ${filePath}`);
   console.log(
      `[seed-pokemon] Mode: ${dryRun ? "DRY RUN (no writes)" : "LIVE UPSERT"}`
   );

   if (dryRun) {
      console.log(
         "[seed-pokemon] Dry run complete. No database writes performed."
      );
      return;
   }

   const prisma = new PrismaClient();
   let created = 0;
   let updated = 0;
   try {
      for (const item of targets) {
         const forms = formsBySpeciesId.get(item.species_id) || [];
         const payload = buildSpeciesPayload(item, forms);

         const existing = await prisma.pokemonSpecies.findUnique({
            where: { slug: payload.slug },
            select: { id: true },
         });

         const {
            forms: formRows,
            abilities: abilityRows,
            ...scalars
         } = payload;

         await prisma.pokemonSpecies.upsert({
            where: { slug: payload.slug },
            create: {
               ...scalars,
               forms: { create: formRows },
               abilities: { create: abilityRows },
            },
            update: {
               ...scalars,
               // Replace children so re-runs stay idempotent.
               forms: { deleteMany: {}, create: formRows },
               abilities: { deleteMany: {}, create: abilityRows },
            },
         });

         if (existing) updated++;
         else created++;
      }
   } finally {
      await prisma.$disconnect();
   }

   console.log(
      `[seed-pokemon] Done: ${created} created, ${updated} updated (${created + updated} species).`
   );
}

main().catch((error) => {
   console.error("[seed-pokemon] Failed:", error);
   process.exit(1);
});
