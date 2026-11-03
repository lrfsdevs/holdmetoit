import { cacheTags, invalidateTags } from "@/core/cache";
import { createLogger, logEvents } from "@/core/observability/logger";
import { toClientError } from "@/core/errors";
import { revalidatePath } from "next/cache";
import { processStudyReward } from "@/features/economy/api/study-reward.service";
import { ChallengeStateError } from "@/features/challenges/domain/challenge-lifecycle";
import { upsertDailyStudyLog } from "@/features/study-logs/data/daily-study-log.repository";
import { clampDailyLogSeconds } from "@/features/study-logs/domain/duration";
import {
   findActiveParticipantForUserOnDate,
   findExistingLogByExternalId,
   findUserByYptOrDiscordId,
} from "../data/ypt.repository";
import { YptIngestPayload, YptIngestResult } from "../domain/ypt.types";

const logger = createLogger("ypt.ingest");

export async function ingestYptActivity(
   payload: YptIngestPayload,
   source: "YPT_BOT" | "YPT_MANUAL" = "YPT_BOT"
): Promise<YptIngestResult> {
   const durationSeconds = clampDailyLogSeconds(payload.durationSeconds);

   try {
      // 1. Resolve user by YPT ID or Discord ID
      const user = await findUserByYptOrDiscordId({
         discordId: payload.discordId,
         yptId: payload.yptId,
      });

      if (!user) {
         logger.warn(logEvents.appError, {
            context: {
               action: "ingestYptActivity",
               reason: "User not found for provided identifiers",
               discordId: payload.discordId,
               yptId: payload.yptId,
            },
         });
         return {
            ok: false,
            code: "USER_NOT_FOUND",
            message: "User not found for provided Discord ID or YPT ID.",
            durationSeconds,
            coinsCredited: 0,
            isDuplicate: false,
         };
      }

      // 1b. Enforce YPT verification requirement (Law / Section 6 & 34)
      if (!user.yptId) {
         logger.warn(logEvents.yptSyncFailed, {
            context: {
               action: "ingestYptActivity",
               reason: "User has not verified YPT identity",
               userId: user.id,
            },
         });
         return {
            ok: false,
            code: "YPT_NOT_VERIFIED",
            message:
               "User does not have an active verified YPT identity. Please request admin verification first.",
            durationSeconds,
            coinsCredited: 0,
            isDuplicate: false,
         };
      }

      logger.info(logEvents.yptSyncStarted, {
         context: {
            userId: user.id,
            yptId: user.yptId,
            date: payload.date,
            durationSeconds,
         },
      });

      // 2. Validate date (cannot be future date)
      const [year, month, day] = payload.date.split("-").map(Number);
      const targetDate = new Date(Date.UTC(year, month - 1, day));
      const todayKey = new Date().toISOString().slice(0, 10);

      if (payload.date > todayKey) {
         return {
            ok: false,
            code: "FUTURE_DATE_NOT_ALLOWED",
            message: "Cannot ingest study time for future dates.",
            durationSeconds,
            coinsCredited: 0,
            isDuplicate: false,
         };
      }

      // 3. Find active challenge participant on targetDate
      const participant = await findActiveParticipantForUserOnDate(
         user.id,
         targetDate
      );

      if (!participant) {
         return {
            ok: false,
            code: "NOT_ENROLLED_IN_ACTIVE_CHALLENGE",
            message:
               "No active, unlocked challenge found for user on the given date.",
            durationSeconds,
            coinsCredited: 0,
            isDuplicate: false,
         };
      }

      // 4. External activity deduplication check
      if (payload.externalActivityId) {
         const existingLog = await findExistingLogByExternalId(
            participant.id,
            payload.externalActivityId
         );

         if (existingLog && existingLog.durationSeconds >= durationSeconds) {
            return {
               ok: true,
               userId: user.id,
               participantId: participant.id,
               studyLogId: existingLog.id,
               durationSeconds: existingLog.durationSeconds,
               coinsCredited: 0,
               isDuplicate: true,
               message:
                  "Activity already ingested with equal or greater duration.",
            };
         }
      }

      // 5. Upsert daily study log with source tracking
      let updatedLog: Awaited<ReturnType<typeof upsertDailyStudyLog>>;
      try {
         updatedLog = await upsertDailyStudyLog({
            participantId: participant.id,
            challengeId: participant.challengeId,
            logDate: payload.date,
            durationSeconds,
            isLeave: false,
            source,
            externalActivityId: payload.externalActivityId,
            yptSubject: payload.yptSubject,
            actor: {
               id: user.id,
               username: user.username || user.name || "user",
               displayName: user.displayName || user.name || null,
               image: user.image || null,
            },
         });
      } catch (error) {
         if (error instanceof ChallengeStateError) {
            logger.warn(logEvents.yptSyncFailed, {
               context: {
                  action: "ingestYptActivity",
                  reason: "challenge_locked",
                  participantId: participant.id,
               },
            });
            return {
               ok: false,
               code: "CHALLENGE_LOCKED",
               message: "Challenge results are locked; activity skipped.",
               durationSeconds,
               coinsCredited: 0,
               isDuplicate: false,
            };
         }
         throw error;
      }

      // 6. Credit study reward via Phase 1 economy
      let coinsCredited = 0;
      let isDuplicate = false;

      if (updatedLog?.id && durationSeconds > 0) {
         try {
            const rewardResult = await processStudyReward({
               studyLogId: updatedLog.id,
               userId: user.id,
            });
            coinsCredited = rewardResult.coinsCredited;
            isDuplicate = rewardResult.isDuplicate;
         } catch (rewardErr) {
            logger.error(logEvents.appError, {
               context: {
                  action: "processStudyRewardInYptIngest",
                  studyLogId: updatedLog.id,
               },
               error: rewardErr,
            });
         }
      }

      // 7. Invalidate caches
      invalidateTags([
         cacheTags.challengeScoreboard(participant.challengeId),
         cacheTags.participantCockpit(user.id, participant.challengeId),
      ]);

      try {
         revalidatePath("/");
         revalidatePath("/dashboard");
         revalidatePath("/wallet");
         revalidatePath(`/challenge/${participant.challengeId}`);
      } catch {
         // Silently handle next/cache outside request scope in unit tests
      }

      logger.info(logEvents.studyLogAdded, {
         context: {
            source,
            userId: user.id,
            participantId: participant.id,
            studyLogId: updatedLog.id,
            coinsCredited,
         },
      });

      logger.info(logEvents.yptSyncCompleted, {
         context: {
            userId: user.id,
            participantId: participant.id,
            studyLogId: updatedLog.id,
            durationSeconds,
            coinsCredited,
         },
      });

      return {
         ok: true,
         userId: user.id,
         participantId: participant.id,
         studyLogId: updatedLog.id,
         durationSeconds,
         coinsCredited,
         isDuplicate,
      };
   } catch (error) {
      const clientError = toClientError(error, {
         scope: "ypt.ingest",
         event: logEvents.appError,
         context: {
            action: "ingestYptActivity",
            date: payload.date,
            durationSeconds,
         },
         defaultCode: "INGEST_ERROR",
         defaultMessage:
            "An unexpected error occurred during YPT activity ingestion.",
      });

      return {
         ok: false,
         code: clientError.code,
         message: clientError.message,
         durationSeconds,
         coinsCredited: 0,
         isDuplicate: false,
      };
   }
}
