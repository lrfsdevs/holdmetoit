import { prisma } from "@/core/db";
import { Prisma, WagerStatus } from "@prisma/client";
import {
   validateWagerPlacement,
   WagerValidationError,
} from "@/features/economy/domain/economy-settings";
import { calculateChallengeStatus } from "@/features/challenges/domain/challenge-lifecycle";
import {
   calculateWagerAccountingDeltas,
   evaluateWagerOutcome,
} from "../domain/wager-accounting";
import {
   getOrCreateWallet,
   getWalletSummary,
} from "@/features/economy/data/wallet.repository";
import { validateWalletInvariants } from "@/features/economy/domain/wallet-accounting";

const MAX_SERIALIZATION_RETRIES = 3;

function isSerializationConflict(error: unknown): boolean {
   return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
   );
}

export interface PlaceWagerParams {
   userId: string;
   challengeId: string;
   targetTeamId: string;
   stake: number;
   idempotencyKey?: string;
}

export async function placeWager(params: PlaceWagerParams) {
   const idempotencyKey =
      params.idempotencyKey ??
      `wager:${params.challengeId}:${params.userId}:${params.targetTeamId}:${params.stake}`;

   for (let attempt = 0; attempt < MAX_SERIALIZATION_RETRIES; attempt += 1) {
      try {
         return await prisma.$transaction(
            async (tx) => {
               // 1. Check idempotency
               const existingWager = await tx.wager.findUnique({
                  where: { idempotencyKey },
                  include: { team: true },
               });

               if (existingWager) {
                  return {
                     wager: existingWager,
                     isDuplicate: true,
                  };
               }

               // 2. Load challenge and target team
               const challenge = await tx.challenge.findUnique({
                  where: { id: params.challengeId },
                  include: { teams: true },
               });

               if (!challenge) {
                  throw new WagerValidationError(
                     "Challenge tournament not found."
                  );
               }

               const targetTeam = challenge.teams.find(
                  (t) => t.id === params.targetTeamId
               );

               const now = new Date();
               const currentStatus = calculateChallengeStatus(challenge, now);

               // 3. Load wallet and check available balance
               const wallet = await getOrCreateWallet(params.userId, tx);
               const availableBalance =
                  wallet.totalBalance - wallet.reservedBalance;

               // 4. Validate wager rules
               validateWagerPlacement({
                  stake: params.stake,
                  availableBalance,
                  challengeStatus: currentStatus,
                  isBettingEnabled: challenge.isBettingEnabled,
                  resultsLockedAt: challenge.resultsLockedAt,
                  startAt: challenge.startAt,
                  currentTime: now,
                  targetTeamExists: Boolean(targetTeam),
               });

               // 5. Reserve funds in wallet
               const nextReserved = wallet.reservedBalance + params.stake;
               validateWalletInvariants({
                  totalBalance: wallet.totalBalance,
                  reservedBalance: nextReserved,
                  rewardProgressSeconds: wallet.rewardProgressSeconds,
                  lifetimeEarned: wallet.lifetimeEarned,
                  lifetimeSpent: wallet.lifetimeSpent,
               });

               await tx.wallet.update({
                  where: { id: wallet.id },
                  data: { reservedBalance: nextReserved },
               });

               // 6. Create Wager record
               const wager = await tx.wager.create({
                  data: {
                     challengeId: challenge.id,
                     userId: params.userId,
                     teamId: params.targetTeamId,
                     walletId: wallet.id,
                     stake: params.stake,
                     payout: params.stake * 2,
                     status: "ACCEPTED",
                     idempotencyKey,
                  },
                  include: { team: true },
               });

               // 7. Append immutable ledger transaction
               await tx.ledgerTransaction.create({
                  data: {
                     walletId: wallet.id,
                     userId: params.userId,
                     type: "WAGER_RESERVATION",
                     amount: params.stake,
                     totalDelta: 0,
                     reservedDelta: params.stake,
                     sourceType: "WAGER",
                     sourceId: wager.id,
                     idempotencyKey: `wager-res:${wager.id}`,
                     description: `Wager stake reserved on team "${targetTeam?.name ?? "Team"}" (${params.stake} coins)`,
                     metadata: {
                        challengeId: challenge.id,
                        targetTeamId: params.targetTeamId,
                        teamName: targetTeam?.name,
                        stake: params.stake,
                     },
                  },
               });

               return {
                  wager,
                  isDuplicate: false,
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
      "Failed to place wager after maximum serialization retries."
   );
}

export async function getWagersForChallenge(challengeId: string) {
   return prisma.wager.findMany({
      where: { challengeId },
      include: {
         user: {
            select: {
               id: true,
               username: true,
               displayName: true,
               image: true,
            },
         },
         team: {
            select: {
               id: true,
               name: true,
               color: true,
               iconEmoji: true,
            },
         },
      },
      orderBy: { createdAt: "desc" },
   });
}

export async function getUserWagersForChallenge(
   userId: string,
   challengeId: string
) {
   return prisma.wager.findMany({
      where: { userId, challengeId },
      include: {
         team: {
            select: {
               id: true,
               name: true,
               color: true,
               iconEmoji: true,
            },
         },
      },
      orderBy: { createdAt: "desc" },
   });
}

/**
 * Authoritatively settles all ACCEPTED wagers for a challenge when results are locked.
 * Can be run inside an existing transaction `tx`.
 */
export async function settleChallengeWagers(
   challengeId: string,
   winningTeamIds: string[],
   tx: Prisma.TransactionClient
) {
   if (!(tx as any)?.wager) {
      return { settledCount: 0 };
   }

   const wagers = await tx.wager.findMany({
      where: {
         challengeId,
         status: "ACCEPTED",
      },
   });

   if (wagers.length === 0) {
      return { settledCount: 0 };
   }

   const now = new Date();

   for (const wager of wagers) {
      const resolution = evaluateWagerOutcome({
         targetTeamId: wager.teamId || (wager as any).targetTeamId,
         winningTeamIds,
      });

      const deltas = calculateWagerAccountingDeltas(wager.stake, resolution);
      const wallet = await tx.wallet.findUniqueOrThrow({
         where: { id: wager.walletId },
      });

      const nextTotal = wallet.totalBalance + deltas.totalDelta;
      const nextReserved = wallet.reservedBalance + deltas.reservedDelta;

      validateWalletInvariants({
         totalBalance: nextTotal,
         reservedBalance: nextReserved,
         rewardProgressSeconds: wallet.rewardProgressSeconds,
         lifetimeEarned:
            deltas.totalDelta > 0
               ? wallet.lifetimeEarned + deltas.totalDelta
               : wallet.lifetimeEarned,
         lifetimeSpent:
            resolution === "LOST"
               ? wallet.lifetimeSpent + wager.stake
               : wallet.lifetimeSpent,
      });

      await tx.wallet.update({
         where: { id: wallet.id },
         data: {
            totalBalance: nextTotal,
            reservedBalance: nextReserved,
            lifetimeEarned:
               deltas.totalDelta > 0
                  ? wallet.lifetimeEarned + deltas.totalDelta
                  : undefined,
            lifetimeSpent:
               resolution === "LOST"
                  ? wallet.lifetimeSpent + wager.stake
                  : undefined,
         },
      });

      if (resolution === "WON") {
         await tx.ledgerTransaction.create({
            data: {
               walletId: wallet.id,
               userId: wager.userId,
               type: "WAGER_SETTLEMENT",
               amount: wager.stake,
               totalDelta: deltas.totalDelta,
               reservedDelta: deltas.reservedDelta,
               sourceType: "WAGER",
               sourceId: wager.id,
               idempotencyKey: `wager-settle:${wager.id}`,
               description: `Wager won: +${wager.stake} coins profit (1:1 payout)`,
               metadata: {
                  challengeId,
                  targetTeamId: wager.teamId,
                  winningTeamIds,
                  stake: wager.stake,
                  payoutAmount: deltas.payoutAmount,
               },
            },
         });

         await tx.wager.update({
            where: { id: wager.id },
            data: {
               status: "WON",
               settledAt: now,
               payout: deltas.payoutAmount,
            },
         });
      } else if (resolution === "LOST") {
         await tx.ledgerTransaction.create({
            data: {
               walletId: wallet.id,
               userId: wager.userId,
               type: "WAGER_SETTLEMENT",
               amount: -wager.stake,
               totalDelta: deltas.totalDelta,
               reservedDelta: deltas.reservedDelta,
               sourceType: "WAGER",
               sourceId: wager.id,
               idempotencyKey: `wager-settle:${wager.id}`,
               description: `Wager lost: -${wager.stake} coins stake consumed`,
               metadata: {
                  challengeId,
                  targetTeamId: wager.teamId,
                  winningTeamIds,
                  stake: wager.stake,
               },
            },
         });

         await tx.wager.update({
            where: { id: wager.id },
            data: {
               status: "LOST",
               settledAt: now,
               payout: 0,
            },
         });
      } else {
         // REFUND (Tie, draw, or cancellation)
         await tx.ledgerTransaction.create({
            data: {
               walletId: wallet.id,
               userId: wager.userId,
               type: "WAGER_REFUND",
               amount: wager.stake,
               totalDelta: 0,
               reservedDelta: deltas.reservedDelta,
               sourceType: "WAGER",
               sourceId: wager.id,
               idempotencyKey: `wager-refund:${wager.id}`,
               description: `Wager refund: ${wager.stake} coins released back to available balance (draw/tie)`,
               metadata: {
                  challengeId,
                  targetTeamId: wager.teamId,
                  winningTeamIds,
                  stake: wager.stake,
               },
            },
         });

         await tx.wager.update({
            where: { id: wager.id },
            data: {
               status: "REFUNDED",
               settledAt: now,
               payout: wager.stake,
            },
         });
      }
   }

   return { settledCount: wagers.length };
}

/**
 * Refunds all ACCEPTED wagers if a challenge is cancelled or results are unlocked.
 */
export async function refundAllChallengeWagers(
   challengeId: string,
   tx: Prisma.TransactionClient,
   reason = "Challenge cancelled or results reset"
) {
   if (!(tx as any)?.wager) {
      return { refundedCount: 0 };
   }

   const wagers = await tx.wager.findMany({
      where: {
         challengeId,
         status: "ACCEPTED",
      },
   });

   const now = new Date();

   for (const wager of wagers) {
      const wallet = await tx.wallet.findUniqueOrThrow({
         where: { id: wager.walletId },
      });

      const nextReserved = wallet.reservedBalance - wager.stake;
      validateWalletInvariants({
         totalBalance: wallet.totalBalance,
         reservedBalance: nextReserved,
         rewardProgressSeconds: wallet.rewardProgressSeconds,
         lifetimeEarned: wallet.lifetimeEarned,
         lifetimeSpent: wallet.lifetimeSpent,
      });

      await tx.wallet.update({
         where: { id: wallet.id },
         data: { reservedBalance: nextReserved },
      });

      await tx.ledgerTransaction.create({
         data: {
            walletId: wallet.id,
            userId: wager.userId,
            type: "WAGER_REFUND",
            amount: wager.stake,
            totalDelta: 0,
            reservedDelta: -wager.stake,
            sourceType: "WAGER",
            sourceId: wager.id,
            idempotencyKey: `wager-refund:${wager.id}`,
            description: `Wager refund: ${wager.stake} coins (${reason})`,
            metadata: {
               challengeId,
               targetTeamId: wager.teamId,
               stake: wager.stake,
               reason,
            },
         },
      });

      await tx.wager.update({
         where: { id: wager.id },
         data: {
            status: "REFUNDED",
            settledAt: now,
            payout: wager.stake,
         },
      });
   }

   return { refundedCount: wagers.length };
}
