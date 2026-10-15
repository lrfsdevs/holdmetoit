import { cacheTags, invalidateTags } from "@/core/cache";
import { createLogger, logEvents } from "@/core/observability/logger";
import { revalidatePath } from "next/cache";
import { processStudyReward } from "@/features/economy/api/study-reward.service";
import { upsertDailyStudyLog } from "@/features/study-logs/data/daily-study-log.repository";
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
            durationSeconds: payload.durationSeconds,
            coinsCredited: 0,
            isDuplicate: false,
         };
      }

      // 2. Validate date (cannot be future date)
      const [year, month, day] = payload.date.split("-").map(Number);
      const targetDate = new Date(Date.UTC(year, month - 1, day));
      const todayKey = new Date().toISOString().slice(0, 10);

      if (payload.date > todayKey) {
         return {
            ok: false,
            code: "FUTURE_DATE_NOT_ALLOWED",
            message: "Cannot ingest study time for future dates.",
            durationSeconds: payload.durationSeconds,
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
            durationSeconds: payload.durationSeconds,
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

         if (
            existingLog &&
            existingLog.durationSeconds >= payload.durationSeconds
         ) {
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
      const updatedLog = await upsertDailyStudyLog({
         participantId: participant.id,
         challengeId: participant.challengeId,
         logDate: payload.date,
         durationSeconds: payload.durationSeconds,
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

      // 6. Credit study reward via Phase 1 economy
      let coinsCredited = 0;
      let isDuplicate = false;

      if (updatedLog?.id && payload.durationSeconds > 0) {
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
            durationSeconds: payload.durationSeconds,
            coinsCredited,
         },
      });

      return {
         ok: true,
         userId: user.id,
         participantId: participant.id,
         studyLogId: updatedLog.id,
         durationSeconds: payload.durationSeconds,
         coinsCredited,
         isDuplicate,
      };
   } catch (error) {
      logger.error(logEvents.appError, {
         context: {
            action: "ingestYptActivity",
            date: payload.date,
            durationSeconds: payload.durationSeconds,
         },
         error,
      });

      return {
         ok: false,
         code: "INGEST_ERROR",
         message:
            error instanceof Error
               ? error.message
               : "An unexpected error occurred during YPT activity ingestion.",
         durationSeconds: payload.durationSeconds,
         coinsCredited: 0,
         isDuplicate: false,
      };
   }
}
