import { prisma } from "@/core/db";
import { createLogger, logEvents } from "@/core/observability/logger";
import { isFeatureEnabled } from "@/features/feature-flags/api/server";
import { FEATURE_FLAG_KEYS } from "@/features/feature-flags/domain/feature-flag-keys";
import { recordStudyRewardTransaction } from "../data/study-reward.repository";

const logger = createLogger("economy.study-reward");

export interface ProcessStudyRewardParams {
   studyLogId: string;
   userId?: string;
}

export interface ProcessStudyRewardResult {
   ok: boolean;
   coinsCredited: number;
   fractionalSecondsRemaining: number;
   isDuplicate: boolean;
   eligibleSeconds: number;
   message?: string;
}

/**
 * Authoritative study reward processing service.
 * Validates study log eligibility and commits coin rewards idempotently.
 */
export async function processStudyReward(
   params: ProcessStudyRewardParams
): Promise<ProcessStudyRewardResult> {
   const { studyLogId, userId } = params;

   try {
      const economyEnabled = await isFeatureEnabled(
         FEATURE_FLAG_KEYS.globalLeaderboard
      );
      if (!economyEnabled) {
         logger.info(logEvents.economyRewardSkipped, {
            context: {
               studyLogId,
               userId,
               reason: "Wallet economy disabled",
            },
         });
         return {
            ok: true,
            coinsCredited: 0,
            fractionalSecondsRemaining: 0,
            isDuplicate: false,
            eligibleSeconds: 0,
            message: "Wallet economy is temporarily disabled.",
         };
      }

      // 1. Load authoritative study log with participant and challenge context
      const log = await prisma.dailyStudyLog.findUnique({
         where: { id: studyLogId },
         include: {
            participant: {
               include: {
                  challenge: {
                     select: {
                        id: true,
                        isDeleted: true,
                     },
                  },
               },
            },
         },
      });

      if (!log) {
         logger.warn(logEvents.economyRewardSkipped, {
            context: { studyLogId, reason: "Study log not found" },
         });
         return {
            ok: false,
            coinsCredited: 0,
            fractionalSecondsRemaining: 0,
            isDuplicate: false,
            eligibleSeconds: 0,
            message: "Study log not found.",
         };
      }

      const participant = log.participant;
      const targetUserId = userId ?? participant.userId;

      // 2. Ownership check
      if (participant.userId !== targetUserId) {
         logger.warn(logEvents.economyRewardSkipped, {
            context: {
               studyLogId,
               expectedUserId: participant.userId,
               actualUserId: targetUserId,
               reason: "Ownership mismatch",
            },
         });
         return {
            ok: false,
            coinsCredited: 0,
            fractionalSecondsRemaining: 0,
            isDuplicate: false,
            eligibleSeconds: 0,
            message: "Unauthorized: study log does not belong to user.",
         };
      }

      // 3. Eligibility Policy:
      // - Challenge must not be soft-deleted
      if (participant.challenge.isDeleted) {
         logger.info(logEvents.economyRewardSkipped, {
            context: { studyLogId, reason: "Challenge soft-deleted" },
         });
         return {
            ok: false,
            coinsCredited: 0,
            fractionalSecondsRemaining: 0,
            isDuplicate: false,
            eligibleSeconds: 0,
            message: "Challenge is deleted.",
         };
      }

      // - Leave days do not grant study rewards
      if (log.isLeave) {
         logger.info(logEvents.economyRewardSkipped, {
            context: { studyLogId, reason: "Study log is marked as leave" },
         });
         return {
            ok: true,
            coinsCredited: 0,
            fractionalSecondsRemaining: 0,
            isDuplicate: false,
            eligibleSeconds: 0,
            message: "Leave day: no study time rewarded.",
         };
      }

      // - Duration must be positive
      if (log.durationSeconds <= 0) {
         logger.info(logEvents.economyRewardSkipped, {
            context: { studyLogId, reason: "Zero study duration" },
         });
         return {
            ok: true,
            coinsCredited: 0,
            fractionalSecondsRemaining: 0,
            isDuplicate: false,
            eligibleSeconds: 0,
            message: "Zero duration logged.",
         };
      }

      const eligibleSeconds = log.durationSeconds;
      const idempotencyKey = `study-log:${log.id}`;

      // 4. Atomically record study reward and credit wallet
      const result = await recordStudyRewardTransaction({
         userId: targetUserId,
         studySessionId: log.id,
         eligibleSeconds,
         sourceType: "DAILY_STUDY_LOG",
         idempotencyKey,
         metadata: {
            challengeId: participant.challenge.id,
            participantId: participant.id,
            logDate: log.logDate.toISOString().slice(0, 10),
         },
      });

      if (result.isDuplicate) {
         logger.info(logEvents.economyRewardSkipped, {
            context: {
               studyLogId,
               userId: targetUserId,
               reason: "Already rewarded (idempotent duplicate)",
            },
         });
      } else {
         logger.info(logEvents.economyRewardCredited, {
            context: {
               studyLogId,
               userId: targetUserId,
               coinsCredited: result.coinsCredited,
               fractionalSecondsRemaining: result.fractionalSecondsRemaining,
               eligibleSeconds,
            },
         });
      }

      return {
         ok: true,
         coinsCredited: result.coinsCredited,
         fractionalSecondsRemaining: result.fractionalSecondsRemaining,
         isDuplicate: result.isDuplicate,
         eligibleSeconds,
      };
   } catch (error) {
      logger.error(logEvents.appError, {
         context: { studyLogId, userId },
         error,
      });
      return {
         ok: false,
         coinsCredited: 0,
         fractionalSecondsRemaining: 0,
         isDuplicate: false,
         eligibleSeconds: 0,
         message:
            error instanceof Error
               ? error.message
               : "Failed to process study reward.",
      };
   }
}
