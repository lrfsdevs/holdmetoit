/**
 * HoldMeToIt — Pokemon Catalogue Repository
 * Database access layer for PokemonSpecies catalogue.
 */

import { prisma } from "@/core/db";
import { createLogger } from "@/core/observability/logger";
import { logEvents } from "@/core/observability/domain/log-events";
import { PokemonRarity, isValidPokemonRarity } from "../domain/pokemon-rarity";
import { isValidPokemonType } from "../domain/pokemon-types";
import { UpsertPokemonSpeciesInput } from "../domain/pokemon.schema";

const logger = createLogger("pokemon-catalogue-repo");

export interface ListPokemonSpeciesOptions {
   rarity?: PokemonRarity | string;
   type?: string;
   generation?: number;
   isLegendary?: boolean;
   isMythical?: boolean;
   isAvailable?: boolean;
   search?: string;
   sortBy?: "pokedex" | "name" | "rarity_desc" | "rarity_asc" | "recent";
   limit?: number;
   offset?: number;
}

export interface PokemonSpeciesWithCounts {
   id: string;
   pokedexNumber: number;
   name: string;
   slug: string;
   rarity: PokemonRarity;
   primaryType: string;
   secondaryType: string | null;
   description: string;
   classification: string | null;
   imageUrl: string | null;
   spriteUrl: string | null;
   spriteGifUrl?: string | null;
   baseHp: number;
   baseAttack: number;
   baseDefense: number;
   generation: number;
   isLegendary?: boolean;
   isMythical?: boolean;
   isBaby?: boolean;
   isAvailable: boolean;
   sourceId?: string | null;
   referenceUrl: string | null;
   metadata?: any | null;
   createdAt: Date;
   updatedAt: Date;
}

export async function listPokemonSpecies(
   options: ListPokemonSpeciesOptions = {}
): Promise<{ species: PokemonSpeciesWithCounts[]; totalCount: number }> {
   try {
      const where: any = {};

      if (options.isAvailable !== undefined) {
         where.isAvailable = options.isAvailable;
      }

      if (options.rarity && isValidPokemonRarity(options.rarity)) {
         where.rarity = options.rarity;
      }

      if (options.generation !== undefined) {
         where.generation = options.generation;
      }

      if (options.isLegendary !== undefined) {
         where.isLegendary = options.isLegendary;
      }

      if (options.isMythical !== undefined) {
         where.isMythical = options.isMythical;
      }

      if (options.type && isValidPokemonType(options.type)) {
         const typeUpper = options.type.toUpperCase();
         where.OR = [{ primaryType: typeUpper }, { secondaryType: typeUpper }];
      }

      if (options.search && options.search.trim().length > 0) {
         const query = options.search.trim();
         const searchConditions = [
            { name: { contains: query, mode: "insensitive" } },
            { slug: { contains: query, mode: "insensitive" } },
            { classification: { contains: query, mode: "insensitive" } },
         ];

         // If already has OR from type, combine with AND
         if (where.OR) {
            where.AND = [{ OR: where.OR }, { OR: searchConditions }];
            delete where.OR;
         } else {
            where.OR = searchConditions;
         }
      }

      // Determine order
      let orderBy: any = { pokedexNumber: "asc" };
      if (options.sortBy === "name") {
         orderBy = { name: "asc" };
      } else if (options.sortBy === "recent") {
         orderBy = { createdAt: "desc" };
      } else if (options.sortBy === "pokedex") {
         orderBy = { pokedexNumber: "asc" };
      }

      const [species, totalCount] = await Promise.all([
         prisma.pokemonSpecies.findMany({
            where,
            orderBy,
            take: options.limit
               ? Math.min(200, Math.max(1, options.limit))
               : undefined,
            skip: options.offset ? Math.max(0, options.offset) : undefined,
         }),
         prisma.pokemonSpecies.count({ where }),
      ]);

      // Handle rarity sorting in memory if requested (since rarity ranks are custom domain hierarchy)
      let sortedSpecies = species as unknown as PokemonSpeciesWithCounts[];
      if (options.sortBy === "rarity_desc") {
         const rankMap: Record<string, number> = {
            MYTHICAL: 6,
            LEGENDARY: 5,
            EPIC: 4,
            RARE: 3,
            UNCOMMON: 2,
            NORMAL: 1,
         };
         sortedSpecies = [...sortedSpecies].sort(
            (a, b) =>
               (rankMap[b.rarity] ?? 0) - (rankMap[a.rarity] ?? 0) ||
               a.pokedexNumber - b.pokedexNumber
         );
      } else if (options.sortBy === "rarity_asc") {
         const rankMap: Record<string, number> = {
            NORMAL: 1,
            UNCOMMON: 2,
            RARE: 3,
            EPIC: 4,
            LEGENDARY: 5,
            MYTHICAL: 6,
         };
         sortedSpecies = [...sortedSpecies].sort(
            (a, b) =>
               (rankMap[a.rarity] ?? 0) - (rankMap[b.rarity] ?? 0) ||
               a.pokedexNumber - b.pokedexNumber
         );
      }

      return {
         species: sortedSpecies,
         totalCount,
      };
   } catch (error) {
      logger.error(logEvents.pokemonQueryFailed, {
         error,
         context: {
            search: options.search,
            rarity: options.rarity as string,
            type: options.type,
         },
      });
      return { species: [], totalCount: 0 };
   }
}

export async function findPokemonSpeciesById(
   id: string
): Promise<PokemonSpeciesWithCounts | null> {
   try {
      const species = await prisma.pokemonSpecies.findUnique({
         where: { id },
      });
      return species as unknown as PokemonSpeciesWithCounts | null;
   } catch (error) {
      logger.error(logEvents.pokemonQueryFailed, { error, context: { id } });
      return null;
   }
}

export async function findPokemonSpeciesBySlug(
   slug: string
): Promise<PokemonSpeciesWithCounts | null> {
   try {
      const species = await prisma.pokemonSpecies.findUnique({
         where: { slug },
      });
      return species as unknown as PokemonSpeciesWithCounts | null;
   } catch (error) {
      logger.error(logEvents.pokemonQueryFailed, { error, context: { slug } });
      return null;
   }
}

export async function countAvailablePokemonSpecies(): Promise<number> {
   try {
      return await prisma.pokemonSpecies.count({
         where: { isAvailable: true },
      });
   } catch (error) {
      logger.error(logEvents.pokemonQueryFailed, { error });
      return 0;
   }
}

export async function adminUpsertPokemonSpecies(
   input: UpsertPokemonSpeciesInput,
   adminActorId: string
): Promise<PokemonSpeciesWithCounts> {
   logger.info(logEvents.pokemonSpeciesUpserted, {
      context: {
         actorId: adminActorId,
         slug: input.slug,
         pokedexNumber: input.pokedexNumber,
      },
   });

   const species = await prisma.pokemonSpecies.upsert({
      where: { slug: input.slug },
      update: {
         pokedexNumber: input.pokedexNumber,
         name: input.name,
         rarity: input.rarity as any,
         primaryType: input.primaryType.toUpperCase(),
         secondaryType: input.secondaryType
            ? input.secondaryType.toUpperCase()
            : null,
         description: input.description,
         classification: input.classification ?? null,
         imageUrl: input.imageUrl ?? null,
         spriteUrl: input.spriteUrl ?? null,
         spriteGifUrl: input.spriteGifUrl ?? null,
         baseHp: input.baseHp ?? 50,
         baseAttack: input.baseAttack ?? 50,
         baseDefense: input.baseDefense ?? 50,
         generation: input.generation ?? 1,
         isLegendary: input.isLegendary ?? false,
         isMythical: input.isMythical ?? false,
         isBaby: input.isBaby ?? false,
         isAvailable: input.isAvailable ?? true,
         sourceId: input.sourceId ?? null,
         referenceUrl: input.referenceUrl ?? null,
         metadata: input.metadata ?? null,
      },
      create: {
         pokedexNumber: input.pokedexNumber,
         name: input.name,
         slug: input.slug,
         rarity: input.rarity as any,
         primaryType: input.primaryType.toUpperCase(),
         secondaryType: input.secondaryType
            ? input.secondaryType.toUpperCase()
            : null,
         description: input.description,
         classification: input.classification ?? null,
         imageUrl: input.imageUrl ?? null,
         spriteUrl: input.spriteUrl ?? null,
         spriteGifUrl: input.spriteGifUrl ?? null,
         baseHp: input.baseHp ?? 50,
         baseAttack: input.baseAttack ?? 50,
         baseDefense: input.baseDefense ?? 50,
         generation: input.generation ?? 1,
         isLegendary: input.isLegendary ?? false,
         isMythical: input.isMythical ?? false,
         isBaby: input.isBaby ?? false,
         isAvailable: input.isAvailable ?? true,
         sourceId: input.sourceId ?? null,
         referenceUrl: input.referenceUrl ?? null,
         metadata: input.metadata ?? null,
      },
   });

   return species as unknown as PokemonSpeciesWithCounts;
}
