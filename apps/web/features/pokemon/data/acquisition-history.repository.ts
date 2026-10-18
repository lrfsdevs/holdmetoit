/**
 * HoldMeToIt — Pokemon Acquisition History Repository
 * Paginated historical audit trail for participant summon records.
 * Enforces strict participant isolation.
 */

import { prisma } from "@/core/db";
import { Prisma } from "@prisma/client";
import { PokemonSpeciesWithCounts } from "./pokemon-catalogue.repository";

export interface UserAcquisitionHistoryItem {
   id: string;
   userId: string;
   bannerId: string;
   bannerName: string;
   bannerVersion: number;
   speciesId: string;
   species: PokemonSpeciesWithCounts;
   rarity: string;
   isFeatured: boolean;
   isDuplicate: boolean;
   duplicateOutcome: string | null;
   costPaid: number;
   ledgerTransactionId: string | null;
   idempotencyKey: string;
   pityCountBefore: number;
   pityCountAfter: number;
   pityTriggered: boolean;
   createdAt: string;
}

export interface AcquisitionHistoryFilterOptions {
   userId: string;
   bannerId?: string;
   limit?: number;
   cursor?: string;
}

export interface PaginatedAcquisitionHistory {
   items: UserAcquisitionHistoryItem[];
   nextCursor: string | null;
   totalCount: number;
}

/**
 * Retrieves paginated acquisition records for a specific participant.
 * Cross-user isolation is strictly enforced by userId.
 */
export async function getUserAcquisitionHistory(
   options: AcquisitionHistoryFilterOptions
): Promise<PaginatedAcquisitionHistory> {
   const { userId, bannerId, limit = 20, cursor } = options;

   if (!userId || typeof userId !== "string") {
      return { items: [], nextCursor: null, totalCount: 0 };
   }

   const safeLimit = Math.min(Math.max(1, limit), 50);

   const where: Prisma.PokemonAcquisitionWhereInput = {
      userId,
   };

   if (bannerId) {
      where.bannerId = bannerId;
   }

   const [records, totalCount] = await Promise.all([
      prisma.pokemonAcquisition.findMany({
         where,
         take: safeLimit + 1,
         cursor: cursor ? { id: cursor } : undefined,
         skip: cursor ? 1 : 0,
         orderBy: { createdAt: "desc" },
         include: {
            species: true,
            banner: {
               select: { name: true },
            },
         },
      }),
      prisma.pokemonAcquisition.count({ where }),
   ]);

   let nextCursor: string | null = null;
   let itemsToReturn = records;

   if (records.length > safeLimit) {
      const nextItem = records[safeLimit];
      nextCursor = nextItem ? nextItem.id : null;
      itemsToReturn = records.slice(0, safeLimit);
   }

   const items: UserAcquisitionHistoryItem[] = itemsToReturn.map((r) => ({
      id: r.id,
      userId: r.userId,
      bannerId: r.bannerId,
      bannerName: r.banner?.name ?? "Banner",
      bannerVersion: r.bannerVersion,
      speciesId: r.speciesId,
      species: r.species as unknown as PokemonSpeciesWithCounts,
      rarity: r.rarity,
      isFeatured: r.isFeatured,
      isDuplicate: r.isDuplicate,
      duplicateOutcome: r.duplicateOutcome,
      costPaid: r.costPaid,
      ledgerTransactionId: r.ledgerTransactionId,
      idempotencyKey: r.idempotencyKey,
      pityCountBefore: r.pityCountBefore,
      pityCountAfter: r.pityCountAfter,
      pityTriggered: r.pityTriggered,
      createdAt: r.createdAt.toISOString(),
   }));

   return {
      items,
      nextCursor,
      totalCount,
   };
}
