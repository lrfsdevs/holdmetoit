import { prisma } from "@/core/db";
import { Prisma } from "@prisma/client";
import {
   applyTrophyChange,
   detectRankChange,
   getRankForTrophies,
} from "../domain/trophy-rank";
import { recordAuditEvent } from "@/features/audit/data/audit-log.repository";

export type TrophyTransactionType =
   | "CHALLENGE_WIN"
   | "CHALLENGE_LOSS"
   | "ADMIN_ADJUSTMENT"
   | "REVERSAL"
   | "SEASON_RESET";

export interface RecordTrophyTransactionParams {
   userId: string;
   amount: number;
   type: TrophyTransactionType;
   sourceType?: string;
   sourceId?: string;
   idempotencyKey?: string;
   description: string;
   metadata?: Record<string, unknown>;
   relatedTransactionId?: string;
   groupId?: string;
}

export async function getUserTrophyBalance(userId: string): Promise<number> {
   const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { trophyBalance: true },
   });
   return user?.trophyBalance ?? 0;
}

export async function recordTrophyTransaction(
   params: RecordTrophyTransactionParams,
   existingTx?: Prisma.TransactionClient
) {
   const execute = async (tx: Prisma.TransactionClient) => {
      // 1. Check idempotency if key provided
      if (params.idempotencyKey) {
         const existingTxn = await tx.trophyTransaction.findUnique({
            where: { idempotencyKey: params.idempotencyKey },
         });
         if (existingTxn) {
            return {
               transaction: existingTxn,
               balanceAfter: existingTxn.balanceAfter,
               isDuplicate: true,
               rankChange: {
                  changed: false,
                  type: "NONE" as const,
                  previousRole: getRankForTrophies(existingTxn.balanceAfter)
                     .role,
                  newRole: getRankForTrophies(existingTxn.balanceAfter).role,
                  previousTrophies: existingTxn.balanceAfter,
                  newTrophies: existingTxn.balanceAfter,
               },
            };
         }
      }

      // 2. Fetch current balance
      const user = await tx.user.findUnique({
         where: { id: params.userId },
         select: { trophyBalance: true, displayName: true, username: true },
      });

      if (!user) {
         throw new Error(`User ${params.userId} not found.`);
      }

      const currentBalance = user.trophyBalance ?? 0;

      // 3. Apply floor and compute new balance
      const changeResult = applyTrophyChange(currentBalance, params.amount);
      const balanceAfter = changeResult.balanceAfter;

      // 4. Create immutable ledger entry
      const transaction = await tx.trophyTransaction.create({
         data: {
            userId: params.userId,
            groupId: params.groupId ?? null,
            amount: params.amount,
            balanceAfter,
            type: params.type,
            sourceType: params.sourceType ?? null,
            sourceId: params.sourceId ?? null,
            idempotencyKey: params.idempotencyKey ?? null,
            description: params.description,
            metadata: params.metadata
               ? (params.metadata as Prisma.InputJsonValue)
               : Prisma.JsonNull,
            relatedTransactionId: params.relatedTransactionId ?? null,
         },
      });

      // 5. Update cached balance on User
      await tx.user.update({
         where: { id: params.userId },
         data: { trophyBalance: balanceAfter },
      });

      // 6. Detect Rank Change & Audit
      const rankChange = detectRankChange(currentBalance, balanceAfter);

      if (rankChange.changed) {
         await recordAuditEvent({
            actorId: params.userId,
            actorUsername: user.username || user.displayName || "system",
            actionType: "RANK_CHANGED",
            targetEntityId: params.userId,
            targetEntityType: "USER",
            targetEntityName: user.displayName || user.username,
            previousValue: {
               role: rankChange.previousRole,
               trophies: currentBalance,
            },
            newValue: {
               role: rankChange.newRole,
               trophies: balanceAfter,
               type: rankChange.type,
            },
            auditReason: `Rank transition: ${rankChange.previousRole} → ${rankChange.newRole} (${rankChange.type})`,
         });
      }

      return {
         transaction,
         balanceAfter,
         isDuplicate: false,
         rankChange,
      };
   };

   if (existingTx) {
      return execute(existingTx);
   }

   return prisma.$transaction(async (tx) => execute(tx));
}

export async function getTrophyHistory(
   userId: string,
   options: { page?: number; limit?: number } = {}
) {
   const { page = 1, limit = 20 } = options;
   const skip = (page - 1) * limit;

   const [transactions, totalCount] = await Promise.all([
      prisma.trophyTransaction.findMany({
         where: { userId },
         orderBy: { createdAt: "desc" },
         skip,
         take: limit,
      }),
      prisma.trophyTransaction.count({ where: { userId } }),
   ]);

   return {
      transactions,
      pagination: {
         page,
         limit,
         totalCount,
         totalPages: Math.ceil(totalCount / limit) || 1,
      },
   };
}

export interface TrophyLeaderboardEntry {
   rank: number;
   userId: string;
   displayName: string;
   username: string;
   image: string | null;
   trophyBalance: number;
   rankRole: string;
   wins: number;
   losses: number;
   winRate: number;
   tierConfig: ReturnType<typeof getRankForTrophies>["tierConfig"];
}

export async function getTrophyLeaderboard(
   options: { page?: number; limit?: number } = {}
) {
   const { page = 1, limit = 50 } = options;
   const skip = (page - 1) * limit;

   const [users, totalCount] = await Promise.all([
      prisma.user.findMany({
         orderBy: { trophyBalance: "desc" },
         skip,
         take: limit,
         select: {
            id: true,
            displayName: true,
            username: true,
            name: true,
            image: true,
            trophyBalance: true,
            trophyTransactions: {
               select: { type: true },
            },
         },
      }),
      prisma.user.count(),
   ]);

   const entries: TrophyLeaderboardEntry[] = users.map((u, index) => {
      const wins = u.trophyTransactions.filter(
         (t) => t.type === "CHALLENGE_WIN"
      ).length;
      const losses = u.trophyTransactions.filter(
         (t) => t.type === "CHALLENGE_LOSS"
      ).length;
      const totalMatches = wins + losses;
      const winRate =
         totalMatches > 0 ? Math.round((wins / totalMatches) * 1000) / 10 : 0;
      const rankCalculation = getRankForTrophies(u.trophyBalance);

      return {
         rank: skip + index + 1,
         userId: u.id,
         displayName: u.displayName || u.name || u.username || "Companion",
         username: u.username || "user",
         image: u.image,
         trophyBalance: u.trophyBalance,
         rankRole: rankCalculation.role,
         wins,
         losses,
         winRate,
         tierConfig: rankCalculation.tierConfig,
      };
   });

   return {
      entries,
      pagination: {
         page,
         limit,
         totalCount,
         totalPages: Math.ceil(totalCount / limit) || 1,
      },
   };
}

export async function getUserCompetitiveStats(userId: string) {
   const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
         wallet: {
            select: { totalBalance: true },
         },
         yptClaims: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { status: true, yptId: true, yptName: true },
         },
         trophyTransactions: {
            select: { type: true },
         },
         participations: {
            select: {
               dailyStudyLogs: {
                  select: { durationSeconds: true },
               },
            },
         },
      },
   });

   if (!user) return null;

   const trophies = user.trophyBalance ?? 0;
   const rankCalc = getRankForTrophies(trophies);

   const wins = user.trophyTransactions.filter(
      (t) => t.type === "CHALLENGE_WIN"
   ).length;
   const losses = user.trophyTransactions.filter(
      (t) => t.type === "CHALLENGE_LOSS"
   ).length;
   const totalMatches = wins + losses;
   const winRate =
      totalMatches > 0 ? Math.round((wins / totalMatches) * 1000) / 10 : 0;

   // Study hours calculation
   let totalStudySeconds = 0;
   for (const p of user.participations) {
      for (const log of p.dailyStudyLogs) {
         totalStudySeconds += log.durationSeconds || 0;
      }
   }

   const latestClaim = user.yptClaims[0];
   let yptStatus: "VERIFIED" | "PENDING" | "REJECTED" | "NOT_CONNECTED" =
      "NOT_CONNECTED";

   if (latestClaim?.status === "VERIFIED" || user.yptId) {
      yptStatus = "VERIFIED";
   } else if (latestClaim?.status === "PENDING") {
      yptStatus = "PENDING";
   } else if (latestClaim?.status === "REJECTED") {
      yptStatus = "REJECTED";
   }

   return {
      userId: user.id,
      displayName:
         user.displayName || user.name || user.username || "Companion",
      username: user.username || "user",
      image: user.image,
      trophies,
      rank: rankCalc,
      wins,
      losses,
      winRate,
      coins: user.wallet?.totalBalance ?? 0,
      totalStudySeconds,
      yptStatus,
      yptId: user.yptId || latestClaim?.yptId || null,
   };
}

export async function adminAdjustTrophies(
   userId: string,
   admin: { id: string; username: string },
   amount: number,
   reason: string
) {
   if (!reason?.trim()) {
      throw new Error(
         "A justification reason is required for admin trophy adjustments."
      );
   }

   const result = await recordTrophyTransaction({
      userId,
      amount,
      type: "ADMIN_ADJUSTMENT",
      sourceType: "ADMIN",
      sourceId: admin.id,
      description: `Admin Trophy Adjustment: ${reason.trim()} (${amount >= 0 ? "+" : ""}${amount})`,
      metadata: {
         adminId: admin.id,
         adminUsername: admin.username,
         reason: reason.trim(),
         requestedDelta: amount,
      },
   });

   await recordAuditEvent({
      actorId: admin.id,
      actorUsername: admin.username,
      actionType: "ADMIN_TROPHY_ADJUSTMENT",
      targetEntityId: userId,
      targetEntityType: "TROPHY",
      previousValue: {
         trophyBalance: result.balanceAfter - amount,
      },
      newValue: {
         trophyBalance: result.balanceAfter,
         amount,
         reason,
      },
      auditReason: reason,
   });

   return result;
}

export interface SettleChallengeTrophiesOptions {
   challengeId: string;
   challengeTitle: string;
   winningTeamIds: string[];
   totalTeamsCount: number;
   participants: Array<{
      id: string;
      userId: string;
      teamId: string | null;
   }>;
   savedParticipantIds: string[];
}

export async function settleChallengeTrophies(
   options: SettleChallengeTrophiesOptions,
   tx: Prisma.TransactionClient
) {
   if (!tx || !(tx as any).trophyTransaction) {
      return { settledCount: 0 };
   }
   const {
      challengeId,
      challengeTitle,
      winningTeamIds,
      totalTeamsCount,
      participants,
      savedParticipantIds,
   } = options;

   // Draw check (all teams tied): 0 trophies for everyone (Requirement 12)
   const isDraw =
      totalTeamsCount > 1 && winningTeamIds.length === totalTeamsCount;
   if (isDraw) {
      return { settledCount: 0, isDraw: true };
   }

   let settledCount = 0;

   for (const participant of participants) {
      const isInWinningTeam =
         participant.teamId != null &&
         winningTeamIds.includes(participant.teamId);
      const isSaved = savedParticipantIds.includes(participant.id);

      if (isInWinningTeam && isSaved) {
         // WIN: +25 trophies
         await recordTrophyTransaction(
            {
               userId: participant.userId,
               amount: 25,
               type: "CHALLENGE_WIN",
               sourceType: "CHALLENGE",
               sourceId: challengeId,
               idempotencyKey: `challenge-trophy:${challengeId}:${participant.userId}`,
               description: `Challenge victory bonus: +25 trophies (${challengeTitle})`,
               metadata: {
                  challengeId,
                  challengeTitle,
                  outcome: "WIN",
                  participantId: participant.id,
               },
            },
            tx
         );
         settledCount++;
      } else if (!isInWinningTeam) {
         // LOSS: -15 trophies (floored at 0)
         await recordTrophyTransaction(
            {
               userId: participant.userId,
               amount: -15,
               type: "CHALLENGE_LOSS",
               sourceType: "CHALLENGE",
               sourceId: challengeId,
               idempotencyKey: `challenge-trophy:${challengeId}:${participant.userId}`,
               description: `Challenge defeat penalty: -15 trophies (${challengeTitle})`,
               metadata: {
                  challengeId,
                  challengeTitle,
                  outcome: "LOSS",
                  participantId: participant.id,
               },
            },
            tx
         );
         settledCount++;
      }
   }

   return { settledCount, isDraw: false };
}

export async function reverseChallengeTrophies(
   challengeId: string,
   tx: Prisma.TransactionClient,
   reason: string = "Challenge results unlocked"
) {
   if (!tx || !(tx as any).trophyTransaction) {
      return { reversedCount: 0 };
   }
   const existingTransactions = await tx.trophyTransaction.findMany({
      where: {
         sourceType: "CHALLENGE",
         sourceId: challengeId,
         type: { in: ["CHALLENGE_WIN", "CHALLENGE_LOSS"] },
      },
      include: {
         reversals: true,
      },
   });

   let reversedCount = 0;

   for (const txn of existingTransactions) {
      if (txn.reversals.length > 0) continue;

      const reverseAmount = -txn.amount;
      const reverseKey = `reversal:${txn.id}`;

      await recordTrophyTransaction(
         {
            userId: txn.userId,
            amount: reverseAmount,
            type: "REVERSAL",
            sourceType: "CHALLENGE",
            sourceId: challengeId,
            relatedTransactionId: txn.id,
            idempotencyKey: reverseKey,
            description: `Trophy reversal: ${reason} (${reverseAmount >= 0 ? "+" : ""}${reverseAmount})`,
            metadata: {
               originalTransactionId: txn.id,
               originalType: txn.type,
               originalAmount: txn.amount,
               reason,
            },
         },
         tx
      );

      reversedCount++;
   }

   return { reversedCount };
}
