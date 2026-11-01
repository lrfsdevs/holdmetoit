"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
   ParticipantAccessError,
   requireOwnedParticipant,
} from "@/features/auth/api/require-participant";
import {
   AuthError,
   requireSessionUser,
} from "@/features/auth/api/require-session";
import {
   calculateChallengeStatus,
   canLogStudyTime,
   ChallengeStateError,
} from "@/features/challenges/domain/challenge-lifecycle";
import { upsertDailyStudyLog } from "@/features/study-logs/data/daily-study-log.repository";
import {
   composeDurationSeconds,
   validateDailyLogDurationSeconds,
} from "@/features/study-logs/domain/daily-log.validation";
import {
   calculateChallengeTotalDays,
   validateStudyLogChallengeDay,
} from "@/features/study-logs/domain/challenge-day";
import {
   MAX_LEAVES_ERROR,
   MaximumLeavesExceededError,
} from "@/features/study-logs/domain/leave-allowance";
import { cacheTags, invalidateTags } from "@/core/cache";
import { createLogger, logEvents } from "@/core/observability/logger";
import { processStudyReward } from "@/features/economy/api/study-reward.service";

const logger = createLogger("study.log");

const logStudyTimeSchema = z
   .object({
      challengeId: z.string().min(1),
      challengeDay: z.number().int().min(1).optional(),
      date: z
         .string()
         .regex(/^\d{4}-\d{2}-\d{2}$/)
         .optional(),
      hours: z.number().int().min(0).max(24),
      minutes: z.number().int().min(0).max(59),
      seconds: z.number().int().min(0).max(59),
      isLeave: z.boolean().optional(),
   })
   .refine(
      (data) => data.challengeDay !== undefined || data.date !== undefined,
      {
         message: "Either challengeDay or date must be provided.",
         path: ["challengeDay"],
      }
   );

export type ActionResult =
   { ok: true } | { ok: false; code: string; message: string };

/** Validates and persists a participant's daily study log, then invalidates views. */
export async function logStudyTimeAction(
   input: z.infer<typeof logStudyTimeSchema>
): Promise<ActionResult> {
   try {
      const user = await requireSessionUser();
      const parsed = logStudyTimeSchema.safeParse(input);

      if (!parsed.success) {
         return {
            ok: false,
            code: "INVALID_INPUT",
            message: "Please enter a valid study duration.",
         };
      }

      const participant = await requireOwnedParticipant(
         user.id,
         parsed.data.challengeId
      );

      const now = new Date();
      const challengeStatus = calculateChallengeStatus(
         participant.challenge,
         now
      );
      if (
         !canLogStudyTime(
            challengeStatus,
            participant.challenge.resultsLockedAt
         )
      ) {
         return {
            ok: false,
            code: "CHALLENGE_NOT_ACTIVE",
            message:
               participant.challenge.resultsLockedAt != null
                  ? "Challenge results are locked. Study logging is closed."
                  : "Study logging is only available during active challenges.",
         };
      }

      const totalDays = calculateChallengeTotalDays(
         participant.challenge.startAt,
         participant.challenge.endAt
      );

      const dayValidation = validateStudyLogChallengeDay(
         participant.challenge.startAt,
         {
            challengeDay: parsed.data.challengeDay,
            date: parsed.data.date,
         },
         now,
         { totalDays }
      );

      if (!dayValidation.ok) {
         return {
            ok: false,
            code: dayValidation.code,
            message: dayValidation.message,
         };
      }

      const logDate = dayValidation.dateKey;

      const durationSeconds = composeDurationSeconds(
         parsed.data.hours,
         parsed.data.minutes,
         parsed.data.seconds
      );

      const validation = validateDailyLogDurationSeconds(durationSeconds);
      if (!validation.ok) {
         return {
            ok: false,
            code: validation.code,
            message: validation.message,
         };
      }

      const updatedLog = await upsertDailyStudyLog({
         participantId: participant.id,
         challengeId: parsed.data.challengeId,
         logDate,
         durationSeconds,
         isLeave: Boolean(parsed.data.isLeave),
         actor: {
            id: user.id,
            username: user.name || user.displayName || "participant",
            displayName: user.displayName || user.name || null,
            image: user.image || null,
         },
      });

      // Fail-safe economy study reward trigger (Law L8 precision; exact-once idempotent)
      if (updatedLog?.id && !parsed.data.isLeave && durationSeconds > 0) {
         try {
            await processStudyReward({
               studyLogId: updatedLog.id,
               userId: user.id,
            });
         } catch (rewardErr) {
            logger.error(logEvents.appError, {
               context: {
                  action: "processStudyRewardTrigger",
                  studyLogId: updatedLog.id,
               },
               error: rewardErr,
            });
         }
      }

      invalidateTags([
         cacheTags.challengeScoreboard(parsed.data.challengeId),
         cacheTags.participantCockpit(user.id, parsed.data.challengeId),
      ]);

      revalidatePath("/");
      revalidatePath("/wallet");
      revalidatePath(`/challenge/${parsed.data.challengeId}`);
      revalidatePath(
         `/challenge/${parsed.data.challengeId}/participant/${participant.id}`
      );

      logger.info(logEvents.studyLogAdded, {
         context: {
            challengeId: parsed.data.challengeId,
            participantId: participant.id,
            userId: user.id,
            logDate,
            durationSeconds,
            isLeave: Boolean(parsed.data.isLeave),
         },
      });

      return { ok: true };
   } catch (error) {
      if (error instanceof AuthError) {
         logger.debug(logEvents.studyLogAdded, {
            context: { code: "UNAUTHORIZED" },
            error,
         });
         return { ok: false, code: "UNAUTHORIZED", message: error.message };
      }

      if (error instanceof ParticipantAccessError) {
         logger.debug(logEvents.studyLogAdded, {
            context: { code: "NOT_ENROLLED", challengeId: input?.challengeId },
            error,
         });
         return { ok: false, code: "NOT_ENROLLED", message: error.message };
      }

      if (
         error instanceof MaximumLeavesExceededError ||
         (error instanceof Error && error.message === MAX_LEAVES_ERROR)
      ) {
         logger.warn(logEvents.studyLogAdded, {
            context: {
               code: "MAX_LEAVES_REACHED",
               challengeId: input?.challengeId,
            },
            error,
         });
         return {
            ok: false,
            code: "MAX_LEAVES_REACHED",
            message: MAX_LEAVES_ERROR,
         };
      }

      if (error instanceof ChallengeStateError) {
         logger.warn(logEvents.studyLogAdded, {
            context: {
               code: "CHALLENGE_LOCKED",
               challengeId: input?.challengeId,
            },
            error,
         });
         return {
            ok: false,
            code: "CHALLENGE_LOCKED",
            message: error.message,
         };
      }

      logger.error(logEvents.studyLogAdded, {
         context: { challengeId: input?.challengeId },
         error,
      });

      return {
         ok: false,
         code: "PERSISTENCE_ERROR",
         message: "Could not save your study time. Please try again.",
      };
   }
}
