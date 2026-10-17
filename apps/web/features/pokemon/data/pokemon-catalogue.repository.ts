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
import { CATALOGUE_PAGE_SIZE } from "../domain/catalogue-query";

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
   /** Restrict to species owned by this user (Collection scope). */
   ownedByUserId?: string;
   limit?: number;
   offset?: number;
}

export interface PokemonFormRecord {
   id: string;
   speciesId: string;
   pokemonId: number;
   name: string;
   slug: string;
   primaryType: string;
   secondaryType: string | null;
   baseStatTotal: number;
   spritePngUrl: string | null;
   spriteGifUrl: string | null;
   officialArtworkUrl: string | null;
   createdAt: Date;
}

export interface PokemonAbilityRecord {
   id: string;
   speciesId: string;
   name: string;
   isHidden: boolean;
   slot: number;
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
   specialAttack?: number;
   specialDefense?: number;
   speed?: number;
   baseStatTotal?: number;
   heightDecimetres?: number | null;
   weightHectograms?: number | null;
   baseExperience?: number | null;
   color?: string | null;
   captureRate?: number | null;
   baseHappiness?: number | null;
   hatchCounter?: number | null;
   evolvesFromSpeciesId?: number | null;
   evolutionChainId?: number | null;
   growthRateId?: number | null;
   generation: number;
   isLegendary?: boolean;
   isMythical?: boolean;
   isBaby?: boolean;
   isAvailable: boolean;
   sourceId?: string | null;
   referenceUrl: string | null;
   forms?: PokemonFormRecord[];
   abilities?: PokemonAbilityRecord[];
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

      if (options.ownedByUserId) {
         where.instances = { some: { userId: options.ownedByUserId } };
      }

      const limit = options.limit
         ? Math.min(200, Math.max(1, options.limit))
         : CATALOGUE_PAGE_SIZE;
      const offset = options.offset ? Math.max(0, options.offset) : 0;

      // "Recently obtained" is a per-user ordering (earliest obtainedAt), which
      // Prisma can't express as an orderBy on a relation — resolve it over the
      // user's owned set (bounded by their collection).
      if (options.sortBy === "recent" && options.ownedByUserId) {
         return await listRecentlyObtained(
            options.ownedByUserId,
            where,
            limit,
            offset
         );
      }

      const [species, totalCount] = await Promise.all([
         prisma.pokemonSpecies.findMany({
            where,
            orderBy: resolveCatalogueOrderBy(options.sortBy),
            include: {
               forms: { orderBy: { pokemonId: "asc" } },
            },
            take: limit,
            skip: offset,
         }),
         prisma.pokemonSpecies.count({ where }),
      ]);

      return {
         species: species as unknown as PokemonSpeciesWithCounts[],
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

/**
 * Rarity ordering is safe at the DB level: the `PokemonRarity` enum is declared
 * NORMAL → MYTHICAL, matching the domain rank order, so `orderBy: { rarity }`
 * is correct across pages (ties broken by Pokédex number).
 */
function resolveCatalogueOrderBy(sortBy?: string): any {
   switch (sortBy) {
      case "name":
         return { name: "asc" };
      case "rarity_desc":
         return [{ rarity: "desc" }, { pokedexNumber: "asc" }];
      case "rarity_asc":
         return [{ rarity: "asc" }, { pokedexNumber: "asc" }];
      case "recent":
         return { createdAt: "desc" };
      case "pokedex":
      default:
         return { pokedexNumber: "asc" };
   }
}

async function listRecentlyObtained(
   ownedByUserId: string,
   where: any,
   limit: number,
   offset: number
): Promise<{ species: PokemonSpeciesWithCounts[]; totalCount: number }> {
   // Filters + ownership resolve the bounded set of owned species.
   const owned = await prisma.pokemonSpecies.findMany({
      where,
      select: { id: true },
   });
   const ids = owned.map((s) => s.id);
   const totalCount = ids.length;
   if (totalCount === 0) {
      return { species: [], totalCount: 0 };
   }

   const groups = await prisma.userPokemon.groupBy({
      by: ["speciesId"],
      where: { userId: ownedByUserId, speciesId: { in: ids } },
      _min: { obtainedAt: true },
   });
   const earliest = new Map(
      groups.map((g) => [g.speciesId, g._min.obtainedAt?.getTime() ?? 0])
   );

   const orderedIds = [...ids].sort(
      (a, b) => (earliest.get(b) ?? 0) - (earliest.get(a) ?? 0)
   );
   const pageIds = orderedIds.slice(offset, offset + limit);
   if (pageIds.length === 0) {
      return { species: [], totalCount };
   }

   const rows = await prisma.pokemonSpecies.findMany({
      where: { id: { in: pageIds } },
      include: { forms: { orderBy: { pokemonId: "asc" } } },
   });
   const byId = new Map(rows.map((r) => [r.id, r]));
   const species = pageIds
      .map((id) => byId.get(id))
      .filter(Boolean) as unknown as PokemonSpeciesWithCounts[];

   return { species, totalCount };
}

export async function findPokemonSpeciesById(
   id: string
): Promise<PokemonSpeciesWithCounts | null> {
   try {
      const species = await prisma.pokemonSpecies.findUnique({
         where: { id },
         include: {
            forms: { orderBy: { pokemonId: "asc" } },
            abilities: { orderBy: { slot: "asc" } },
         },
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
         include: {
            forms: { orderBy: { pokemonId: "asc" } },
            abilities: { orderBy: { slot: "asc" } },
         },
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
         specialAttack: input.specialAttack ?? 0,
         specialDefense: input.specialDefense ?? 0,
         speed: input.speed ?? 0,
         baseStatTotal: input.baseStatTotal ?? 0,
         heightDecimetres: input.heightDecimetres ?? null,
         weightHectograms: input.weightHectograms ?? null,
         baseExperience: input.baseExperience ?? null,
         color: input.color ?? null,
         captureRate: input.captureRate ?? null,
         baseHappiness: input.baseHappiness ?? null,
         hatchCounter: input.hatchCounter ?? null,
         evolvesFromSpeciesId: input.evolvesFromSpeciesId ?? null,
         evolutionChainId: input.evolutionChainId ?? null,
         growthRateId: input.growthRateId ?? null,
         generation: input.generation ?? 1,
         isLegendary: input.isLegendary ?? false,
         isMythical: input.isMythical ?? false,
         isBaby: input.isBaby ?? false,
         isAvailable: input.isAvailable ?? true,
         sourceId: input.sourceId ?? null,
         referenceUrl: input.referenceUrl ?? null,
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
         specialAttack: input.specialAttack ?? 0,
         specialDefense: input.specialDefense ?? 0,
         speed: input.speed ?? 0,
         baseStatTotal: input.baseStatTotal ?? 0,
         heightDecimetres: input.heightDecimetres ?? null,
         weightHectograms: input.weightHectograms ?? null,
         baseExperience: input.baseExperience ?? null,
         color: input.color ?? null,
         captureRate: input.captureRate ?? null,
         baseHappiness: input.baseHappiness ?? null,
         hatchCounter: input.hatchCounter ?? null,
         evolvesFromSpeciesId: input.evolvesFromSpeciesId ?? null,
         evolutionChainId: input.evolutionChainId ?? null,
         growthRateId: input.growthRateId ?? null,
         generation: input.generation ?? 1,
         isLegendary: input.isLegendary ?? false,
         isMythical: input.isMythical ?? false,
         isBaby: input.isBaby ?? false,
         isAvailable: input.isAvailable ?? true,
         sourceId: input.sourceId ?? null,
         referenceUrl: input.referenceUrl ?? null,
      },
   });

   return species as unknown as PokemonSpeciesWithCounts;
}
