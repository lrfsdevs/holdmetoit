/**
 * HoldMeToIt — User Pokemon Collection Repository
 * Database access layer for UserPokemon instances.
 * Enforces server-side authorization and cross-participant isolation.
 */

import { prisma } from "@/core/db";
import { createLogger } from "@/core/observability/logger";
import { logEvents } from "@/core/observability/domain/log-events";
import {
   calculateCollectionProgress,
   CollectionProgressResult,
} from "../domain/collection-progress";
import { PokemonRarity, isValidPokemonRarity } from "../domain/pokemon-rarity";
import { isValidPokemonType } from "../domain/pokemon-types";
import {
   countAvailablePokemonSpecies,
   PokemonSpeciesWithCounts,
} from "./pokemon-catalogue.repository";

const logger = createLogger("user-pokemon-repo");

export interface UserPokemonInstance {
   id: string;
   userId: string;
   speciesId: string;
   obtainedAt: Date;
   source: string;
   sourceReferenceId: string | null;
   idempotencyKey: string;
   nickname: string | null;
   isFavorite: boolean;
   metadata: any;
   createdAt: Date;
   updatedAt: Date;
   species: PokemonSpeciesWithCounts;
}

export interface UserCollectionFilterOptions {
   rarity?: PokemonRarity | string;
   type?: string;
   search?: string;
   sortBy?: "pokedex" | "name" | "rarity_desc" | "rarity_asc" | "recent";
}

export interface UserCollectionSummary {
   userId: string;
   progress: CollectionProgressResult;
   speciesOwnershipCounts: Record<string, number>; // speciesId -> total count owned
   speciesEarliestObtained: Record<string, string>; // speciesId -> ISO date string
}

/**
 * Retrieves an authenticated user's owned Pokemon instances.
 * Cross-user isolation is guaranteed by filtering explicitly on userId.
 */
export async function getUserPokemonCollection(
   userId: string,
   options: UserCollectionFilterOptions = {}
): Promise<UserPokemonInstance[]> {
   if (!userId || typeof userId !== "string") {
      return [];
   }

   try {
      const where: any = { userId };

      const speciesWhere: any = {};
      if (options.rarity && isValidPokemonRarity(options.rarity)) {
         speciesWhere.rarity = options.rarity;
      }
      if (options.type && isValidPokemonType(options.type)) {
         const typeUpper = options.type.toUpperCase();
         speciesWhere.OR = [
            { primaryType: typeUpper },
            { secondaryType: typeUpper },
         ];
      }
      if (options.search && options.search.trim().length > 0) {
         const q = options.search.trim();
         const searchCond = [
            { name: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
         ];
         if (speciesWhere.OR) {
            speciesWhere.AND = [{ OR: speciesWhere.OR }, { OR: searchCond }];
            delete speciesWhere.OR;
         } else {
            speciesWhere.OR = searchCond;
         }
      }

      if (Object.keys(speciesWhere).length > 0) {
         where.species = speciesWhere;
      }

      let orderBy: any = { obtainedAt: "desc" };
      if (options.sortBy === "recent") {
         orderBy = { obtainedAt: "desc" };
      } else if (options.sortBy === "pokedex") {
         orderBy = { species: { pokedexNumber: "asc" } };
      } else if (options.sortBy === "name") {
         orderBy = { species: { name: "asc" } };
      }

      const instances = await prisma.userPokemon.findMany({
         where,
         orderBy,
         include: {
            species: true,
         },
      });

      let result = instances as unknown as UserPokemonInstance[];

      // Handle custom rarity sorting
      if (options.sortBy === "rarity_desc") {
         const rankMap: Record<string, number> = {
            MYTHICAL: 6,
            LEGENDARY: 5,
            EPIC: 4,
            RARE: 3,
            UNCOMMON: 2,
            NORMAL: 1,
         };
         result = [...result].sort(
            (a, b) =>
               (rankMap[b.species.rarity] ?? 0) -
                  (rankMap[a.species.rarity] ?? 0) ||
               a.species.pokedexNumber - b.species.pokedexNumber
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
         result = [...result].sort(
            (a, b) =>
               (rankMap[a.species.rarity] ?? 0) -
                  (rankMap[b.species.rarity] ?? 0) ||
               a.species.pokedexNumber - b.species.pokedexNumber
         );
      }

      return result;
   } catch (error) {
      logger.error(logEvents.pokemonQueryFailed, {
         error,
         context: { userId },
      });
      return [];
   }
}

/**
 * Retrieves an individual owned instance, ensuring it belongs to userId.
 */
export async function getUserPokemonById(
   id: string,
   userId: string
): Promise<UserPokemonInstance | null> {
   if (!id || !userId) return null;

   try {
      const instance = await prisma.userPokemon.findFirst({
         where: {
            id,
            userId,
         },
         include: {
            species: true,
         },
      });
      return instance as unknown as UserPokemonInstance | null;
   } catch (error) {
      logger.error(logEvents.pokemonQueryFailed, {
         error,
         context: { id, userId },
      });
      return null;
   }
}

/**
 * Computes user collection summary metrics including Pokédex progress,
 * unique species counts, total instances, and per-species duplicate maps.
 */
export async function getUserCollectionSummary(
   userId: string
): Promise<UserCollectionSummary> {
   const defaultSummary: UserCollectionSummary = {
      userId,
      progress: calculateCollectionProgress(0, 0, 0),
      speciesOwnershipCounts: {},
      speciesEarliestObtained: {},
   };

   if (!userId) return defaultSummary;

   try {
      const [allOwned, totalAvailable] = await Promise.all([
         prisma.userPokemon.findMany({
            where: { userId },
            select: {
               speciesId: true,
               obtainedAt: true,
            },
         }),
         countAvailablePokemonSpecies(),
      ]);

      const counts: Record<string, number> = {};
      const earliest: Record<string, string> = {};

      for (const item of allOwned) {
         counts[item.speciesId] = (counts[item.speciesId] ?? 0) + 1;
         const existingDate = earliest[item.speciesId];
         const itemIso = item.obtainedAt.toISOString();
         if (!existingDate || itemIso < existingDate) {
            earliest[item.speciesId] = itemIso;
         }
      }

      const uniqueCount = Object.keys(counts).length;
      const totalInstances = allOwned.length;
      const progress = calculateCollectionProgress(
         uniqueCount,
         totalAvailable,
         totalInstances
      );

      return {
         userId,
         progress,
         speciesOwnershipCounts: counts,
         speciesEarliestObtained: earliest,
      };
   } catch (error) {
      logger.error(logEvents.pokemonQueryFailed, {
         error,
         context: { userId },
      });
      return defaultSummary;
   }
}

/**
 * Server-internal domain operation to safely grant a Pokemon to a user.
 * PROTECTED: This function is NOT exposed as a direct client action.
 * Idempotent via idempotencyKey.
 */
export async function grantUserPokemon(params: {
   userId: string;
   speciesId: string;
   source:
      | "STARTER"
      | "STUDY_REWARD"
      | "ACHIEVEMENT"
      | "GACHA"
      | "EVENT"
      | "ADMIN_GRANT";
   idempotencyKey: string;
   sourceReferenceId?: string | null;
   nickname?: string | null;
   metadata?: any;
}): Promise<UserPokemonInstance> {
   const {
      userId,
      speciesId,
      source,
      idempotencyKey,
      sourceReferenceId,
      nickname,
      metadata,
   } = params;

   logger.info(logEvents.pokemonGranted, {
      context: {
         userId,
         speciesId,
         source,
         idempotencyKey,
      },
   });

   // Verify species exists and is available
   const species = await prisma.pokemonSpecies.findUnique({
      where: { id: speciesId },
   });

   if (!species) {
      throw new Error(`PokemonSpecies not found: ${speciesId}`);
   }

   // Check if idempotency key was already processed
   const existing = await prisma.userPokemon.findUnique({
      where: { idempotencyKey },
      include: { species: true },
   });

   if (existing) {
      logger.info(logEvents.pokemonGranted, {
         context: {
            idempotencyKey,
            existingId: existing.id,
            isDuplicate: true,
         },
      });
      return existing as unknown as UserPokemonInstance;
   }

   // Create new owned instance atomically
   const created = await prisma.userPokemon.create({
      data: {
         userId,
         speciesId,
         source: source as any,
         idempotencyKey,
         sourceReferenceId: sourceReferenceId ?? null,
         nickname: nickname ?? null,
         metadata: metadata ?? {},
      },
      include: {
         species: true,
      },
   });

   return created as unknown as UserPokemonInstance;
}
