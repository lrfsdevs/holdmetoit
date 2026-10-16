/**
 * HoldMeToIt — Pokemon Zod Validation Schemas
 * Runtime input validation for Pokemon catalogue and collection actions.
 */

import { z } from "zod";
import { POKEMON_RARITIES } from "./pokemon-rarity";
import { POKEMON_ELEMENTAL_TYPES } from "./pokemon-types";

export const PokemonRaritySchema = z.enum(POKEMON_RARITIES);

export const PokemonElementalTypeSchema = z.enum(POKEMON_ELEMENTAL_TYPES);

export const PokemonFormSchema = z.object({
   pokemonId: z.number().int(),
   name: z.string().min(1).max(128),
   slug: z
      .string()
      .min(1)
      .max(128)
      .regex(
         /^[a-z0-9-]+$/,
         "Form slug must only contain lowercase alphanumeric characters and hyphens"
      ),
   primaryType: PokemonElementalTypeSchema,
   secondaryType: PokemonElementalTypeSchema.optional().nullable(),
   baseStatTotal: z.number().int().min(0).max(1000).default(0),
   spritePngUrl: z.string().url().optional().nullable().or(z.literal("")),
   spriteGifUrl: z.string().url().optional().nullable().or(z.literal("")),
   officialArtworkUrl: z.string().url().optional().nullable().or(z.literal("")),
});

export const PokemonAbilitySchema = z.object({
   name: z.string().min(1).max(64),
   isHidden: z.boolean().default(false),
   slot: z.number().int().min(1),
});

export const UpsertPokemonSpeciesSchema = z.object({
   pokedexNumber: z.number().int().min(1).max(2000),
   name: z.string().min(1).max(100).trim(),
   slug: z
      .string()
      .min(1)
      .max(100)
      .trim()
      .regex(
         /^[a-z0-9-]+$/,
         "Slug must only contain lowercase alphanumeric characters and hyphens"
      ),
   rarity: PokemonRaritySchema,
   primaryType: PokemonElementalTypeSchema,
   secondaryType: PokemonElementalTypeSchema.optional().nullable(),
   description: z.string().min(1).max(1000).trim(),
   classification: z.string().max(100).optional().nullable(),
   imageUrl: z.string().url().optional().nullable().or(z.literal("")),
   spriteUrl: z.string().url().optional().nullable().or(z.literal("")),
   spriteGifUrl: z.string().url().optional().nullable().or(z.literal("")),
   baseHp: z.number().int().min(1).max(500).default(50),
   baseAttack: z.number().int().min(1).max(500).default(50),
   baseDefense: z.number().int().min(1).max(500).default(50),
   specialAttack: z.number().int().min(0).max(500).default(0),
   specialDefense: z.number().int().min(0).max(500).default(0),
   speed: z.number().int().min(0).max(500).default(0),
   baseStatTotal: z.number().int().min(0).max(1000).default(0),
   heightDecimetres: z.number().int().optional().nullable(),
   weightHectograms: z.number().int().optional().nullable(),
   baseExperience: z.number().int().optional().nullable(),
   color: z.string().max(32).optional().nullable(),
   captureRate: z.number().int().optional().nullable(),
   baseHappiness: z.number().int().optional().nullable(),
   hatchCounter: z.number().int().optional().nullable(),
   evolvesFromSpeciesId: z.number().int().optional().nullable(),
   evolutionChainId: z.number().int().optional().nullable(),
   growthRateId: z.number().int().optional().nullable(),
   generation: z.number().int().min(1).max(9).default(1),
   isLegendary: z.boolean().default(false),
   isMythical: z.boolean().default(false),
   isBaby: z.boolean().default(false),
   isAvailable: z.boolean().default(true),
   sourceId: z.string().max(64).optional().nullable(),
   referenceUrl: z.string().url().optional().nullable().or(z.literal("")),
   forms: z.array(PokemonFormSchema).optional(),
   abilities: z.array(PokemonAbilitySchema).optional(),
});

export type UpsertPokemonSpeciesInput = z.input<
   typeof UpsertPokemonSpeciesSchema
>;
export type UpsertPokemonSpeciesOutput = z.infer<
   typeof UpsertPokemonSpeciesSchema
>;

export const ListPokemonFilterSchema = z.object({
   rarity: z.string().optional(),
   type: z.string().optional(),
   generation: z.number().optional(),
   isLegendary: z.boolean().optional(),
   isMythical: z.boolean().optional(),
   isAvailable: z.boolean().optional(),
   search: z.string().optional(),
   sortBy: z
      .enum(["pokedex", "name", "rarity_desc", "rarity_asc", "recent"])
      .optional(),
   limit: z.number().int().min(1).max(200).optional(),
   offset: z.number().int().min(0).optional(),
});

export const UserCollectionFilterSchema = z.object({
   rarity: z.string().optional(),
   type: z.string().optional(),
   search: z.string().optional(),
   sortBy: z
      .enum(["pokedex", "name", "rarity_desc", "rarity_asc", "recent"])
      .optional(),
});
