"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSessionUser } from "@/features/auth/api/require-session";
import { enrollParticipantInChallenge } from "@/features/challenges/data/participant.repository";
import { validateWeeklyTargetSeconds } from "@/features/challenges/domain/target-hours.validation";
import { composeDurationSeconds } from "@/features/study-logs/domain/daily-log.validation";
import { cacheTags, invalidateTags } from "@/core/cache";
import { createLogger, logEvents } from "@/core/observability/logger";

const logger = createLogger("challenge.enroll");

const enrollParticipantSchema = z.object({
   challengeId: z.string().min(1),
   teamId: z.string().optional(),
   hours: z.number().int().min(0).max(105).default(35),
   minutes: z.number().int().min(0).max(59).default(0),
   seconds: z.number().int().min(0).max(59).default(0),
   leaveDays: z.number().int().min(0).max(30).optional(),
});

export type EnrollActionResult =
   { ok: true } | { ok: false; code: string; message: string };

export async function enrollInChallengeAction(
   input: z.infer<typeof enrollParticipantSchema>
): Promise<EnrollActionResult> {
   try {
      const user = await requireSessionUser();
      const parsed = enrollParticipantSchema.safeParse(input);

      if (!parsed.success) {
         return {
            ok: false,
            code: "INVALID_INPUT",
            message: "Please enter a valid target duration.",
         };
      }

      const targetSeconds = composeDurationSeconds(
         parsed.data.hours,
         parsed.data.minutes,
         parsed.data.seconds
      );

      const validation = validateWeeklyTargetSeconds(targetSeconds);
      if (!validation.ok) {
         return {
            ok: false,
            code: validation.code,
            message: validation.message,
         };
      }

      const resolvedTeamId =
         parsed.data.teamId && parsed.data.teamId !== "no-assigned"
            ? parsed.data.teamId
            : null;

      await enrollParticipantInChallenge({
         userId: user.id,
         challengeId: parsed.data.challengeId,
         teamId: resolvedTeamId,
         targetSeconds,
      });

      invalidateTags([cacheTags.challengeScoreboard(parsed.data.challengeId)]);

      revalidatePath(`/challenge/${parsed.data.challengeId}`);
      revalidatePath("/dashboard");
      revalidatePath("/");
      revalidatePath("/admin");

      logger.info(logEvents.challengeEnrolled, {
         context: {
            challengeId: parsed.data.challengeId,
            userId: user.id,
            teamId: resolvedTeamId,
            targetSeconds,
         },
      });

      return { ok: true };
   } catch (error) {
      logger.error(logEvents.challengeEnrolled, {
         context: { challengeId: input?.challengeId },
         error,
      });

      return {
         ok: false,
         code: "ENROLLMENT_FAILED",
         message:
            error instanceof Error
               ? error.message
               : "Failed to enroll in challenge.",
      };
   }
}
