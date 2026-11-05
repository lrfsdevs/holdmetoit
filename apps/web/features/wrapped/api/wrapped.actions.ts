"use server";

import { revalidatePath } from "next/cache";

import { getServerEnv } from "@/core/env/server";
import { cacheTags, invalidateTags } from "@/core/cache";
import { toClientError } from "@/core/errors";
import { prisma } from "@/core/db";
import { createLogger, logEvents } from "@/core/observability/logger";
import {
   AuthError,
   requireSessionUser,
} from "@/features/auth/api/require-session";
import {
   ParticipantAccessError,
   requireOwnedParticipant,
} from "@/features/auth/api/require-participant";
import { isWrappedWindowExpired } from "@/features/wrapped/domain/wrapped";
import { submitChallengeFeedbackSchema } from "@/features/wrapped/domain/challenge-feedback.schema";
import { buildChallengeFeedbackEmbed } from "@/features/wrapped/domain/challenge-feedback-embed";
import { sendChallengeFeedbackToDiscord } from "@/features/wrapped/data/challenge-feedback.service";
import {
   saveChallengeFeedback,
   updateChallengeFeedbackDiscordMessageId,
} from "@/features/wrapped/data/challenge-feedback.repository";
import { isWrappedFeatureEnabled } from "@/features/wrapped/api/wrapped-flag";

const logger = createLogger("wrapped");

export type WrappedActionResult =
   { ok: true } | { ok: false; code: string; message: string };

export type ChallengeFeedbackActionResult =
   | {
        ok: true;
        isFeedbackFilled: true;
        discordDelivered: boolean;
        feedbackId?: string;
     }
   | { ok: false; code: string; message: string };

/**
 * Shared implementation for the two seen-marking flows. `auto` mirrors the
 * 3-day page-load check: it only flips the flag once the wrapped window has
 * actually expired.
 */
async function markSeen(
   challengeId: string,
   mode: "manual" | "auto"
): Promise<WrappedActionResult> {
   try {
      if (!(await isWrappedFeatureEnabled())) {
         logger.warn(logEvents.wrappedSeen, {
            context: { challengeId, mode, reason: "feature_flag_disabled" },
         });
         return { ok: true };
      }

      const user = await requireSessionUser();
      const participant = await requireOwnedParticipant(user.id, challengeId);

      if (mode === "auto") {
         const challenge = await prisma.challenge.findUnique({
            where: { id: challengeId },
            select: { resultsLockedAt: true },
         });

         if (!challenge || !isWrappedWindowExpired(challenge.resultsLockedAt)) {
            return { ok: true };
         }
      }

      if (!participant.isWrappedSeen) {
         await prisma.challengeParticipant.update({
            where: { id: participant.id },
            data: { isWrappedSeen: true },
         });
      }

      logger.info(
         mode === "auto" ? logEvents.wrappedAutoSeen : logEvents.wrappedSeen,
         {
            context: {
               challengeId,
               userId: user.id,
               participantId: participant.id,
            },
         }
      );

      return { ok: true };
   } catch (error) {
      if (error instanceof AuthError) {
         return { ok: false, code: "UNAUTHORIZED", message: error.message };
      }
      if (error instanceof ParticipantAccessError) {
         return { ok: false, code: error.code, message: error.message };
      }

      const clientError = toClientError(error, {
         scope: "wrapped.mark_seen",
         event: logEvents.wrappedSeen,
         context: { challengeId, mode },
         defaultCode: "WRAPPED_MARK_FAILED",
         defaultMessage: "Failed to update the wrapped status.",
      });

      return {
         ok: false,
         code: clientError.code,
         message: clientError.message,
      };
   }
}

/**
 * Marks the wrapped as seen (fired when the viewer reaches the feedback slide).
 */
export async function markWrappedSeenAction(
   challengeId: string
): Promise<WrappedActionResult> {
   return markSeen(challengeId, "manual");
}

/**
 * Page-load auto-seen check: if the viewer still hasn't seen the wrapped three
 * days after the results were locked, mark it seen so it stops resurfacing.
 */
export async function markWrappedSeenIfExpiredAction(
   challengeId: string
): Promise<WrappedActionResult> {
   return markSeen(challengeId, "auto");
}

/**
 * Submits feedback for a challenge: sets isFeedbackFilled = true on ChallengeParticipant,
 * builds an Obsidian-styled Discord embed with submitter identity, and sends it to
 * the challenge feedback Discord channel (1558594247895289877).
 */
export async function submitChallengeFeedbackAction(
   rawInput: unknown
): Promise<ChallengeFeedbackActionResult> {
   try {
      if (!(await isWrappedFeatureEnabled())) {
         return {
            ok: false,
            code: "FEATURE_DISABLED",
            message: "Challenge feedback is temporarily unavailable.",
         };
      }

      const parsed = submitChallengeFeedbackSchema.safeParse(rawInput);
      if (!parsed.success) {
         return {
            ok: false,
            code: "INVALID_INPUT",
            message:
               parsed.error.issues[0]?.message ??
               "Invalid challenge feedback input.",
         };
      }

      const {
         challengeId,
         consistency,
         fairnessRating,
         trackingPreference,
         teamBattleFeedback,
         workSchoolHours,
         soloStyle,
         soloPunishment,
         soloIdeas,
      } = parsed.data;

      const user = await requireSessionUser();
      const participant = await requireOwnedParticipant(user.id, challengeId);

      const challengeTitle =
         participant.challenge?.title ??
         (
            await prisma.challenge.findUnique({
               where: { id: challengeId },
               select: { title: true },
            })
         )?.title ??
         "Challenge";

      const feedbackRecord = await prisma.$transaction(async (tx) => {
         if (!participant.isFeedbackFilled) {
            await tx.challengeParticipant.update({
               where: { id: participant.id },
               data: { isFeedbackFilled: true },
            });
         }

         return saveChallengeFeedback(
            {
               challengeId,
               userId: user.id,
               consistency,
               fairnessRating,
               trackingPreference,
               teamBattleFeedback,
               workSchoolHours,
               soloStyle,
               soloPunishment,
               soloIdeas,
            },
            tx
         );
      });

      const embed = buildChallengeFeedbackEmbed({
         challengeId,
         challengeTitle,
         appUrl: getServerEnv().AUTH_URL,
         consistency,
         fairnessRating,
         trackingPreference,
         teamBattleFeedback,
         workSchoolHours,
         soloStyle,
         soloPunishment,
         soloIdeas,
         reporter: {
            userId: user.id,
            displayName: user.displayName ?? user.name ?? null,
            username: user.name ?? null,
            discordId: user.discordId ?? null,
         },
      });

      const discordResult = await sendChallengeFeedbackToDiscord(embed);

      if (discordResult.success && discordResult.messageId) {
         void updateChallengeFeedbackDiscordMessageId(
            feedbackRecord.id,
            discordResult.messageId
         ).catch((err) => {
            logger.warn(logEvents.feedbackSubmitted, {
               context: {
                  stage: "update_discord_message_id",
                  feedbackId: feedbackRecord.id,
                  error: err instanceof Error ? err.message : String(err),
               },
            });
         });
      }

      invalidateTags([cacheTags.challengeScoreboard(challengeId)]);
      revalidatePath(`/challenge/${challengeId}`);

      if (!discordResult.success) {
         logger.warn(logEvents.feedbackDiscordDispatchFailed, {
            context: {
               challengeId,
               userId: user.id,
               participantId: participant.id,
               feedbackId: feedbackRecord.id,
               discordError: discordResult.error,
            },
         });
      }

      logger.info(logEvents.feedbackSubmitted, {
         context: {
            challengeId,
            userId: user.id,
            participantId: participant.id,
            feedbackId: feedbackRecord.id,
            fairnessRating,
            discordDelivered: discordResult.success,
         },
      });

      return {
         ok: true,
         isFeedbackFilled: true,
         discordDelivered: discordResult.success,
         feedbackId: feedbackRecord.id,
      };
   } catch (error) {
      if (error instanceof AuthError) {
         return { ok: false, code: "UNAUTHORIZED", message: error.message };
      }
      if (error instanceof ParticipantAccessError) {
         return { ok: false, code: error.code, message: error.message };
      }

      const clientError = toClientError(error, {
         scope: "wrapped.feedback",
         event: logEvents.feedbackSubmitted,
         context: { action: "submitChallengeFeedbackAction" },
         defaultCode: "FEEDBACK_SUBMIT_FAILED",
         defaultMessage: "Failed to submit challenge feedback.",
      });

      return {
         ok: false,
         code: clientError.code,
         message: clientError.message,
      };
   }
}
