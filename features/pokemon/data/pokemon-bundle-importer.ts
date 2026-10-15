/**
 * HoldMeToIt — Pokemon Bundle Importer Engine
 * Repeatable, idempotent processor for the provided Pokemon metadata bundle.
 * Handles schema validation, canonical species vs. form variation separation,
 * domain rarity calculation, and audit reporting.
 */

import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import {
   UpsertPokemonSpeciesSchema,
   UpsertPokemonSpeciesInput,
} from "../domain/pokemon.schema";
import {
   PokemonRarity,
   calculateHoldMeToItRarity,
} from "../domain/pokemon-rarity";

export interface RawPokemonBundleItem {
   pokemon_id: number;
   pokemon_name: string;
   pokemon_slug: string;
   species_id: number;
   species_name: string;
   genus: string | null;
   is_default_form: boolean;
   generation_id: number;
   types: string[];
   type_1: string;
   type_2: string | null;
   abilities: Array<{ name: string; is_hidden: boolean; slot: number }>;
   base_stats: Record<string, number>;
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
   sprite_note?: string;
}

export interface ImportPokemonBundleOptions {
   filePath?: string;
   dryRun?: boolean;
   limit?: number;
   prisma?: PrismaClient;
}

export interface PokemonImportReport {
   totalSourceRecords: number;
   canonicalSpeciesCount: number;
   alternateFormsCount: number;
   validRecordsCount: number;
   rejectedRecordsCount: number;
   importedCount: number;
   updatedCount: number;
   skippedCount: number;
   rarityBreakdown: Record<PokemonRarity, number>;
   generationBreakdown: Record<number, number>;
   assetCoverage: {
      officialArtwork: number;
      spritePng: number;
      spriteGif: number;
   };
   rejectedErrors: Array<{ slug: string; errors: string[] }>;
   provenance: {
      datasetSource: string;
      licensing: string;
      ipAttribution: string;
   };
}

/**
 * Parses and processes the Pokemon metadata bundle.
 * Separates 1,025 canonical species from 326 alternate forms,
 * aggregates form variations into species metadata, and maps to application domain.
 */
export function parsePokemonBundle(
   rawItems: RawPokemonBundleItem[],
   options: { limit?: number } = {}
): {
   validSpecies: UpsertPokemonSpeciesInput[];
   rejectedRecords: Array<{ slug: string; errors: string[] }>;
   formsCount: number;
   totalRecords: number;
} {
   const totalRecords = rawItems.length;

   // 1. Group alternate forms by species_id
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

   // Apply optional limit on default species if specified
   const targetSpecies = options.limit
      ? defaultSpecies.slice(0, options.limit)
      : defaultSpecies;

   const validSpecies: UpsertPokemonSpeciesInput[] = [];
   const rejectedRecords: Array<{ slug: string; errors: string[] }> = [];

   // 2. Map and validate each canonical species
   for (const item of targetSpecies) {
      const associatedForms = formsBySpeciesId.get(item.species_id) || [];

      // Map source classification & calculate HoldMeToIt game rarity
      const rarity = calculateHoldMeToItRarity({
         isMythical: item.is_mythical,
         isLegendary: item.is_legendary,
         baseStatTotal: item.base_stat_total,
      });

      // Clean description / classification
      const classification = item.genus || `${item.species_name} Pokémon`;
      const description = item.genus
         ? `Known as the ${item.genus}. First discovered in Generation ${item.generation_id}.`
         : `Discovered in Generation ${item.generation_id}.`;

      // Construct enriched metadata object
      const metadata = {
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
         abilities: item.abilities,
         forms: associatedForms.map((f) => ({
            pokemonId: f.pokemon_id,
            name: f.pokemon_name,
            slug: f.pokemon_slug,
            types: f.types,
            baseStatTotal: f.base_stat_total,
            spritePngUrl: f.sprite_png_url,
            spriteGifUrl: f.sprite_gif_url,
            officialArtworkUrl: f.official_artwork_url,
         })),
         spriteNote: item.sprite_note,
      };

      const candidate: UpsertPokemonSpeciesInput = {
         pokedexNumber: item.species_id,
         name: item.pokemon_name,
         slug: item.pokemon_slug,
         rarity,
         primaryType: item.type_1.toUpperCase() as any,
         secondaryType: item.type_2 ? (item.type_2.toUpperCase() as any) : null,
         description,
         classification,
         imageUrl: item.official_artwork_url || "",
         spriteUrl: item.sprite_png_url || "",
         spriteGifUrl: item.sprite_gif_url || "",
         baseHp: item.hp,
         baseAttack: item.attack,
         baseDefense: item.defense,
         generation: item.generation_id,
         isLegendary: Boolean(item.is_legendary),
         isMythical: Boolean(item.is_mythical),
         isBaby: Boolean(item.is_baby),
         isAvailable: true,
         sourceId: String(item.pokemon_id),
         referenceUrl: `https://www.pokemon.com/us/pokedex/${item.pokemon_slug}`,
         metadata,
      };

      // 3. Validate against Zod domain schema
      const validationResult = UpsertPokemonSpeciesSchema.safeParse(candidate);
      if (validationResult.success) {
         validSpecies.push(validationResult.data);
      } else {
         rejectedRecords.push({
            slug: item.pokemon_slug,
            errors: (validationResult.error.issues || []).map(
               (e) => `${e.path.join(".")}: ${e.message}`
            ),
         });
      }
   }

   let totalFormsCount = 0;
   formsBySpeciesId.forEach((forms) => {
      totalFormsCount += forms.length;
   });

   return {
      validSpecies,
      rejectedRecords,
      formsCount: totalFormsCount,
      totalRecords,
   };
}

/**
 * Execute the bundle import or dry-run.
 */
export async function runPokemonBundleImport(
   options: ImportPokemonBundleOptions = {}
): Promise<PokemonImportReport> {
   const filePath =
      options.filePath || path.resolve(process.cwd(), "pokemon_metadata.json");

   if (!fs.existsSync(filePath)) {
      throw new Error(`Pokemon metadata bundle file not found at: ${filePath}`);
   }

   const rawJson = fs.readFileSync(filePath, "utf-8");
   const rawItems: RawPokemonBundleItem[] = JSON.parse(rawJson);

   const { validSpecies, rejectedRecords, formsCount, totalRecords } =
      parsePokemonBundle(rawItems, { limit: options.limit });

   // Compute breakdown stats
   const rarityBreakdown: Record<PokemonRarity, number> = {
      NORMAL: 0,
      UNCOMMON: 0,
      RARE: 0,
      EPIC: 0,
      LEGENDARY: 0,
      MYTHICAL: 0,
   };

   const generationBreakdown: Record<number, number> = {};
   let officialArtworkCount = 0;
   let spritePngCount = 0;
   let spriteGifCount = 0;

   for (const s of validSpecies) {
      rarityBreakdown[s.rarity as PokemonRarity] =
         (rarityBreakdown[s.rarity as PokemonRarity] || 0) + 1;
      const gen = s.generation ?? 1;
      generationBreakdown[gen] = (generationBreakdown[gen] || 0) + 1;

      if (s.imageUrl) officialArtworkCount++;
      if (s.spriteUrl) spritePngCount++;
      if (s.spriteGifUrl) spriteGifCount++;
   }

   let importedCount = 0;
   let updatedCount = 0;
   let skippedCount = 0;

   // If not dry-run and Prisma client provided, perform idempotent upserts
   if (!options.dryRun && options.prisma) {
      const prisma = options.prisma;

      for (const species of validSpecies) {
         try {
            const existing = await prisma.pokemonSpecies.findUnique({
               where: { slug: species.slug },
            });

            await prisma.pokemonSpecies.upsert({
               where: { slug: species.slug },
               update: {
                  pokedexNumber: species.pokedexNumber,
                  name: species.name,
                  rarity: species.rarity as any,
                  primaryType: species.primaryType,
                  secondaryType: species.secondaryType ?? null,
                  description: species.description,
                  classification: species.classification ?? null,
                  imageUrl: species.imageUrl ?? null,
                  spriteUrl: species.spriteUrl ?? null,
                  spriteGifUrl: species.spriteGifUrl ?? null,
                  baseHp: species.baseHp ?? 50,
                  baseAttack: species.baseAttack ?? 50,
                  baseDefense: species.baseDefense ?? 50,
                  generation: species.generation ?? 1,
                  isLegendary: species.isLegendary ?? false,
                  isMythical: species.isMythical ?? false,
                  isBaby: species.isBaby ?? false,
                  isAvailable: species.isAvailable ?? true,
                  sourceId: species.sourceId ?? null,
                  referenceUrl: species.referenceUrl ?? null,
                  metadata: species.metadata ?? null,
               },
               create: {
                  pokedexNumber: species.pokedexNumber,
                  name: species.name,
                  slug: species.slug,
                  rarity: species.rarity as any,
                  primaryType: species.primaryType,
                  secondaryType: species.secondaryType ?? null,
                  description: species.description,
                  classification: species.classification ?? null,
                  imageUrl: species.imageUrl ?? null,
                  spriteUrl: species.spriteUrl ?? null,
                  spriteGifUrl: species.spriteGifUrl ?? null,
                  baseHp: species.baseHp ?? 50,
                  baseAttack: species.baseAttack ?? 50,
                  baseDefense: species.baseDefense ?? 50,
                  generation: species.generation ?? 1,
                  isLegendary: species.isLegendary ?? false,
                  isMythical: species.isMythical ?? false,
                  isBaby: species.isBaby ?? false,
                  isAvailable: species.isAvailable ?? true,
                  sourceId: species.sourceId ?? null,
                  referenceUrl: species.referenceUrl ?? null,
                  metadata: species.metadata ?? null,
               },
            });

            if (existing) {
               updatedCount++;
            } else {
               importedCount++;
            }
         } catch (err) {
            skippedCount++;
            rejectedRecords.push({
               slug: species.slug,
               errors: [err instanceof Error ? err.message : String(err)],
            });
         }
      }
   }

   return {
      totalSourceRecords: totalRecords,
      canonicalSpeciesCount: validSpecies.length,
      alternateFormsCount: formsCount,
      validRecordsCount: validSpecies.length,
      rejectedRecordsCount: rejectedRecords.length,
      importedCount,
      updatedCount,
      skippedCount,
      rarityBreakdown,
      generationBreakdown,
      assetCoverage: {
         officialArtwork: officialArtworkCount,
         spritePng: spritePngCount,
         spriteGif: spriteGifCount,
      },
      rejectedErrors: rejectedRecords,
      provenance: {
         datasetSource:
            "PokéAPI / Veekun Open-Source Relational Pokémon Database (curated bundle)",
         licensing:
            "Community fair-use dataset. Pokémon, sprites, and names are trademarks & copyright of Nintendo, Creatures Inc., and GAME FREAK Inc.",
         ipAttribution:
            "HoldMeToIt utilizes external artwork references for educational study gamification without claiming ownership or commercial redistribution.",
      },
   };
}
