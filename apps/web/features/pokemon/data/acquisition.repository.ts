/**
 * HoldMeToIt — Pokemon Banner & Acquisition Repository
 * Atomic database transactions for server-authoritative pulls.
 * Law L5, Law L7, Law L8, Invariant Integrity.
 */

import { prisma } from "@/core/db";
import { Prisma } from "@prisma/client";
import { createLogger } from "@/core/observability/logger";
import { logEvents } from "@/core/observability/domain/log-events";
import {
   applyDebit,
   InsufficientFundsError,
} from "@/features/economy/domain/wallet-accounting";
import { getOrCreateWallet } from "@/features/economy/data/wallet.repository";
import {
   assertValidBannerConfig,
   BannerConfig,
   isBannerActiveNow,
   PityConfig,
} from "../domain/acquisition/banner-config";
import {
   evaluatePity,
   calculateNextPityState,
   PityState,
} from "../domain/acquisition/pity-engine";
import {
   selectPokemon,
   RandomSource,
   defaultCsprng,
} from "../domain/acquisition/pokemon-selector";
import { PokemonSpeciesWithCounts } from "./pokemon-catalogue.repository";
import { getUserAuthoritativeStudySeconds } from "@/features/study-logs/data/study-hours.repository";
import { getEligibleRarities } from "@/features/study-logs/domain/study-eligibility";

const logger = createLogger("acquisition-repo");
const MAX_SERIALIZATION_RETRIES = 3;

function isSerializationConflict(error: unknown): boolean {
   return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
   );
}

export class BannerNotFoundError extends Error {
   readonly code = "BANNER_NOT_FOUND";
   constructor(identifier: string) {
      super(`Pokemon banner not found: ${identifier}`);
      this.name = "BannerNotFoundError";
   }
}

export class BannerInactiveError extends Error {
   readonly code = "BANNER_INACTIVE";
   constructor(message = "This banner is not currently active for summoning.") {
      super(message);
      this.name = "BannerInactiveError";
   }
}

export interface BannerViewModel {
   id: string;
   name: string;
   slug: string;
   description: string;
   bannerType: string;
   status: string;
   startAt: string;
   endAt: string | null;
   pullCost: number;
   allowedQuantities: number[];
   version: number;
   featuredSpeciesId: string | null;
   featuredSpecies?: PokemonSpeciesWithCounts | null;
   rarityRates: Record<string, number>;
   poolFilter?: any;
   pityConfig?: PityConfig | null;
   duplicatePolicy: string;
   totalSpeciesInPool: number;
   isActive: boolean;
}

export interface AcquisitionResultViewModel {
   acquisitionId: string;
   bannerId: string;
   bannerName: string;
   version?: number;
   species: PokemonSpeciesWithCounts;
   rarity: string;
   isFeatured: boolean;
   isDuplicate: boolean;
   duplicateOutcome: string | null;
   costPaid: number;
   newBalance: number;
   pityCountBefore: number;
   pityCountAfter: number;
   pityTriggered: boolean;
   isIdempotentReplay: boolean;
   obtainedAt: string;
}

/**
 * Lists banners with eligibility filters.
 */
export async function listBanners(
   options: {
      includeInactive?: boolean;
   } = {}
): Promise<BannerViewModel[]> {
   try {
      const where: Prisma.PokemonBannerWhereInput = {};
      if (!options.includeInactive) {
         where.status = "ACTIVE";
      }

      const banners = await prisma.pokemonBanner.findMany({
         where,
         orderBy: [{ status: "asc" }, { startAt: "desc" }],
         include: {
            featuredSpecies: true,
         },
      });

      const now = new Date();

      return banners.map((b) => ({
         id: b.id,
         name: b.name,
         slug: b.slug,
         description: b.description,
         bannerType: b.bannerType,
         status: b.status,
         startAt: b.startAt.toISOString(),
         endAt: b.endAt ? b.endAt.toISOString() : null,
         pullCost: b.pullCost,
         allowedQuantities: b.allowedQuantities,
         version: b.version,
         featuredSpeciesId: b.featuredSpeciesId,
         featuredSpecies:
            b.featuredSpecies as unknown as PokemonSpeciesWithCounts | null,
         rarityRates: b.rarityRates as Record<string, number>,
         poolFilter: b.poolFilter,
         pityConfig: b.pityConfig as PityConfig | null,
         duplicatePolicy: b.duplicatePolicy,
         totalSpeciesInPool: 0, // Hydrated dynamically when inspecting pool
         isActive: isBannerActiveNow(b, now),
      }));
   } catch (error) {
      logger.error(logEvents.pokemonQueryFailed, { error });
      return [];
   }
}

/**
 * Retrieves a single banner by ID or slug.
 */
export async function findBannerByIdOrSlug(
   identifier: string
): Promise<BannerViewModel | null> {
   try {
      const banner = await prisma.pokemonBanner.findFirst({
         where: {
            OR: [{ id: identifier }, { slug: identifier }],
         },
         include: {
            featuredSpecies: true,
         },
      });

      if (!banner) return null;

      const now = new Date();

      return {
         id: banner.id,
         name: banner.name,
         slug: banner.slug,
         description: banner.description,
         bannerType: banner.bannerType,
         status: banner.status,
         startAt: banner.startAt.toISOString(),
         endAt: banner.endAt ? banner.endAt.toISOString() : null,
         pullCost: banner.pullCost,
         allowedQuantities: banner.allowedQuantities,
         version: banner.version,
         featuredSpeciesId: banner.featuredSpeciesId,
         featuredSpecies:
            banner.featuredSpecies as unknown as PokemonSpeciesWithCounts | null,
         rarityRates: banner.rarityRates as Record<string, number>,
         poolFilter: banner.poolFilter,
         pityConfig: banner.pityConfig as PityConfig | null,
         duplicatePolicy: banner.duplicatePolicy,
         totalSpeciesInPool: 0,
         isActive: isBannerActiveNow(banner, now),
      };
   } catch (error) {
      logger.error(logEvents.pokemonQueryFailed, {
         error,
         context: { identifier },
      });
      return null;
   }
}

/**
 * Retrieves a user's pity status for a given banner.
 */
export async function getUserBannerPity(
   userId: string,
   bannerId: string
): Promise<PityState> {
   try {
      const record = await prisma.userBannerPity.findUnique({
         where: {
            userId_bannerId: { userId, bannerId },
         },
      });

      return {
         pityCount: record?.pityCount ?? 0,
         guaranteedFeatured: record?.guaranteedFeatured ?? false,
      };
   } catch (error) {
      logger.error(logEvents.pokemonQueryFailed, {
         error,
         context: { userId, bannerId },
      });
      return { pityCount: 0, guaranteedFeatured: false };
   }
}

export interface ExecuteAcquisitionParams {
   userId: string;
   bannerId: string;
   idempotencyKey: string;
   randomSource?: RandomSource;
}

/**
 * Server-authoritative atomic pull transaction.
 * Deducts coins from wallet, records immutable ledger transaction,
 * evaluates pity, executes selection via CSPRNG, grants UserPokemon,
 * updates UserBannerPity, and writes an auditable PokemonAcquisition record.
 */
export async function executePokemonAcquisition(
   params: ExecuteAcquisitionParams
): Promise<AcquisitionResultViewModel> {
   const {
      userId,
      bannerId,
      idempotencyKey,
      randomSource = defaultCsprng,
   } = params;

   for (let attempt = 0; attempt < MAX_SERIALIZATION_RETRIES; attempt += 1) {
      try {
         return await prisma.$transaction(
            async (tx) => {
               // 1. Idempotency Check: check if already executed
               const existingAcquisition =
                  await tx.pokemonAcquisition.findUnique({
                     where: { idempotencyKey },
                     include: {
                        species: true,
                        banner: true,
                     },
                  });

               if (existingAcquisition) {
                  const currentWallet = await tx.wallet.findUnique({
                     where: { userId },
                  });
                  const newBal = currentWallet
                     ? currentWallet.totalBalance -
                       currentWallet.reservedBalance
                     : 0;

                  return {
                     acquisitionId: existingAcquisition.id,
                     bannerId: existingAcquisition.bannerId,
                     bannerName: existingAcquisition.banner.name,
                     species:
                        existingAcquisition.species as unknown as PokemonSpeciesWithCounts,
                     rarity: existingAcquisition.rarity,
                     isFeatured: existingAcquisition.isFeatured,
                     isDuplicate: existingAcquisition.isDuplicate,
                     duplicateOutcome:
                        existingAcquisition.duplicateOutcome ??
                        "EXISTING_ACQUISITION",
                     costPaid: existingAcquisition.costPaid,
                     newBalance: newBal,
                     pityCountBefore: existingAcquisition.pityCountBefore,
                     pityCountAfter: existingAcquisition.pityCountAfter,
                     pityTriggered: existingAcquisition.pityTriggered,
                     isIdempotentReplay: true,
                     obtainedAt: existingAcquisition.createdAt.toISOString(),
                  };
               }

               // 2. Fetch and validate banner
               const banner = await tx.pokemonBanner.findUnique({
                  where: { id: bannerId },
                  include: { featuredSpecies: true },
               });

               if (!banner) {
                  throw new BannerNotFoundError(bannerId);
               }

               if (!isBannerActiveNow(banner)) {
                  throw new BannerInactiveError(
                     `Banner "${banner.name}" is not currently active.`
                  );
               }

               assertValidBannerConfig({
                  name: banner.name,
                  slug: banner.slug,
                  description: banner.description,
                  status: banner.status as any,
                  startAt: banner.startAt,
                  endAt: banner.endAt,
                  pullCost: banner.pullCost,
                  rarityRates: banner.rarityRates as any,
                  pityConfig: banner.pityConfig as any,
               });

               // 3. Fetch user wallet and assert available balance
               const wallet = await getOrCreateWallet(userId, tx);
               const availableBalance =
                  wallet.totalBalance - wallet.reservedBalance;

               if (availableBalance < banner.pullCost) {
                  throw new InsufficientFundsError(
                     `Insufficient coin balance (${availableBalance} coins) for pull cost (${banner.pullCost} coins).`
                  );
               }

               // 4. Fetch eligible Pokemon species pool
               const speciesPool = (await tx.pokemonSpecies.findMany({
                  where: { isAvailable: true },
               })) as unknown as PokemonSpeciesWithCounts[];

               if (speciesPool.length === 0) {
                  throw new Error(
                     "No available species found in Pokémon catalogue."
                  );
               }

               // 5. Fetch authoritative cumulative eligible study seconds (Section 5 & 7)
               const authoritativeStudySeconds =
                  await getUserAuthoritativeStudySeconds(userId, tx);
               const eligibleRarities = getEligibleRarities(
                  authoritativeStudySeconds
               );

               // Filter pool to species matching user's progression-eligible rarities
               const eligibleSpeciesPool = speciesPool.filter((sp) =>
                  eligibleRarities.has(sp.rarity as any)
               );

               if (eligibleSpeciesPool.length === 0) {
                  throw new Error(
                     "No eligible species available in Pokémon catalogue for current progression level."
                  );
               }

               // 6. Fetch user's pity state for this banner
               const pityRecord = await tx.userBannerPity.findUnique({
                  where: {
                     userId_bannerId: { userId, bannerId: banner.id },
                  },
               });

               const currentPityCount = pityRecord?.pityCount ?? 0;
               const guaranteedFeatured =
                  pityRecord?.guaranteedFeatured ?? false;

               // 7. Evaluate pity (enforcing study eligibility) and run selection engine
               const pityEval = evaluatePity({
                  currentPityCount,
                  guaranteedFeatured,
                  pityConfig: banner.pityConfig as any,
                  cumulativeStudySeconds: authoritativeStudySeconds,
                  eligibleRarities,
               });

               const selection = selectPokemon({
                  eligiblePool: eligibleSpeciesPool,
                  rarityRates: banner.rarityRates as Record<string, number>,
                  featuredSpeciesId: banner.featuredSpeciesId,
                  pityEvaluation: pityEval,
                  randomSource,
                  cumulativeStudySeconds: authoritativeStudySeconds,
               });

               // 7. Check duplicate status (Law: integrates with Phase 3 collection model)
               const existingOwnedCount = await tx.userPokemon.count({
                  where: {
                     userId,
                     speciesId: selection.selectedSpecies.id,
                  },
               });

               const isDuplicate = existingOwnedCount > 0;
               const duplicateOutcome = isDuplicate
                  ? "OWNERSHIP_COUNT_INCREMENTED"
                  : "NEW_SPECIES_DISCOVERED";

               // 8. Debit coins from wallet (pure domain transition)
               const debitEffect = applyDebit(
                  {
                     totalBalance: wallet.totalBalance,
                     reservedBalance: wallet.reservedBalance,
                     rewardProgressSeconds: wallet.rewardProgressSeconds,
                     lifetimeEarned: wallet.lifetimeEarned,
                     lifetimeSpent: wallet.lifetimeSpent,
                  },
                  banner.pullCost
               );

               // Update wallet in DB
               const updatedWallet = await tx.wallet.update({
                  where: { id: wallet.id },
                  data: {
                     totalBalance: debitEffect.nextState.totalBalance,
                     lifetimeSpent: debitEffect.nextState.lifetimeSpent,
                  },
               });

               // 9. Append immutable LedgerTransaction
               const ledgerKey = `${idempotencyKey}:ledger`;
               const ledgerTx = await tx.ledgerTransaction.create({
                  data: {
                     walletId: wallet.id,
                     userId,
                     type: "GACHA_PURCHASE",
                     amount: -banner.pullCost,
                     totalDelta: debitEffect.totalDelta,
                     reservedDelta: debitEffect.reservedDelta,
                     sourceType: "POKEMON_BANNER",
                     sourceId: banner.id,
                     idempotencyKey: ledgerKey,
                     description: `Pokémon Summon: ${banner.name}`,
                     metadata: {
                        bannerId: banner.id,
                        bannerVersion: banner.version,
                        speciesId: selection.selectedSpecies.id,
                        speciesName: selection.selectedSpecies.name,
                        rarity: selection.rarity,
                        isFeatured: selection.isFeatured,
                     },
                  },
               });

               // 10. Grant UserPokemon instance in collection
               const userPokemonKey = `${idempotencyKey}:pokemon`;
               const grantedPokemon = await tx.userPokemon.create({
                  data: {
                     userId,
                     speciesId: selection.selectedSpecies.id,
                     source: "GACHA",
                     sourceReferenceId: banner.id,
                     idempotencyKey: userPokemonKey,
                     metadata: {
                        bannerId: banner.id,
                        bannerVersion: banner.version,
                        isFeatured: selection.isFeatured,
                        costPaid: banner.pullCost,
                        ledgerTransactionId: ledgerTx.id,
                     },
                  },
               });

               // 11. Calculate and persist next pity state
               const nextPity = calculateNextPityState({
                  previousPityCount: currentPityCount,
                  previousGuaranteedFeatured: guaranteedFeatured,
                  rolledRarity: selection.rarity,
                  wasFeaturedPulled: selection.isFeatured,
                  pityConfig: banner.pityConfig as any,
                  pityTriggered: pityEval.pityTriggered,
               });

               await tx.userBannerPity.upsert({
                  where: {
                     userId_bannerId: { userId, bannerId: banner.id },
                  },
                  create: {
                     userId,
                     bannerId: banner.id,
                     pityCount: nextPity.pityCount,
                     guaranteedFeatured: nextPity.guaranteedFeatured,
                     lastPullAt: new Date(),
                  },
                  update: {
                     pityCount: nextPity.pityCount,
                     guaranteedFeatured: nextPity.guaranteedFeatured,
                     lastPullAt: new Date(),
                  },
               });

               // 12. Create auditable PokemonAcquisition record
               const acquisition = await tx.pokemonAcquisition.create({
                  data: {
                     userId,
                     bannerId: banner.id,
                     bannerVersion: banner.version,
                     speciesId: selection.selectedSpecies.id,
                     userPokemonId: grantedPokemon.id,
                     rarity: selection.rarity as any,
                     isFeatured: selection.isFeatured,
                     isDuplicate,
                     duplicateOutcome,
                     costPaid: banner.pullCost,
                     ledgerTransactionId: ledgerTx.id,
                     idempotencyKey,
                     pityCountBefore: currentPityCount,
                     pityCountAfter: nextPity.pityCount,
                     pityTriggered: selection.pityTriggered,
                     metadata: {
                        bannerType: banner.bannerType,
                        pityTargetRarity: banner.pityConfig
                           ? (banner.pityConfig as any).targetRarity
                           : null,
                        authoritativeStudySeconds,
                        eligibleRarities: Array.from(eligibleRarities),
                        pityTriggered: selection.pityTriggered,
                     },
                  },
               });

               logger.info(logEvents.pokemonGranted, {
                  context: {
                     userId,
                     bannerId: banner.id,
                     speciesId: selection.selectedSpecies.id,
                     speciesName: selection.selectedSpecies.name,
                     rarity: selection.rarity,
                     costPaid: banner.pullCost,
                     acquisitionId: acquisition.id,
                     isDuplicate,
                  },
               });

               const finalAvailable =
                  updatedWallet.totalBalance - updatedWallet.reservedBalance;

               return {
                  acquisitionId: acquisition.id,
                  bannerId: banner.id,
                  bannerName: banner.name,
                  species: selection.selectedSpecies,
                  rarity: selection.rarity,
                  isFeatured: selection.isFeatured,
                  isDuplicate,
                  duplicateOutcome,
                  costPaid: banner.pullCost,
                  newBalance: finalAvailable,
                  pityCountBefore: currentPityCount,
                  pityCountAfter: nextPity.pityCount,
                  pityTriggered: selection.pityTriggered,
                  isIdempotentReplay: false,
                  obtainedAt: acquisition.createdAt.toISOString(),
               };
            },
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
         );
      } catch (error) {
         if (
            !isSerializationConflict(error) ||
            attempt === MAX_SERIALIZATION_RETRIES - 1
         ) {
            throw error;
         }
      }
   }

   throw new Error(
      "Failed to execute Pokémon acquisition transaction after maximum retries."
   );
}
