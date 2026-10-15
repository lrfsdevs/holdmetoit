/**
 * HoldMeToIt — Pokemon Zod Validation Schemas
 * Runtime input validation for Pokemon catalogue and collection actions.
 */

import { z } from "zod";
import { POKEMON_RARITIES } from "./pokemon-rarity";
import { POKEMON_ELEMENTAL_TYPES } from "./pokemon-types";

export const PokemonRaritySchema = z.enum(POKEMON_RARITIES);

export const PokemonElementalTypeSchema = z.enum(POKEMON_ELEMENTAL_TYPES);

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
   generation: z.number().int().min(1).max(9).default(1),
   isLegendary: z.boolean().default(false),
   isMythical: z.boolean().default(false),
   isBaby: z.boolean().default(false),
   isAvailable: z.boolean().default(true),
   sourceId: z.string().max(64).optional().nullable(),
   referenceUrl: z.string().url().optional().nullable().or(z.literal("")),
   metadata: z.any().optional().nullable(),
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
