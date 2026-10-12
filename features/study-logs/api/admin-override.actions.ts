"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminUser } from "@/features/auth/api/require-admin";
import {
   executeAdminHoursOverride,
   executeAdminResetOverallHours,
} from "@/features/study-logs/data/admin-override.repository";
import { cacheTags, invalidateTags } from "@/core/cache";
import {
   composeDurationSeconds,
   validateDailyLogDurationSeconds,
} from "@/features/study-logs/domain/daily-log.validation";
import { createLogger, logEvents } from "@/core/observability/logger";

const logger = createLogger("study.log.admin");

const adminOverrideSchema = z.object({
   challengeId: z.string().min(1),
   participantId: z.string().min(1),
   logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
   hours: z.number().int().min(0).max(24),
   minutes: z.number().int().min(0).max(59),
   seconds: z.number().int().min(0).max(59),
   reason: z.string().optional(),
});

export type AdminOverrideResult =
   { ok: true } | { ok: false; code: string; message: string };

/**
 * Host manual hours override action (Law L5 / FEAT-LOG-04).
 */
export async function adminOverrideStudyHoursAction(
   input: z.infer<typeof adminOverrideSchema>
): Promise<AdminOverrideResult> {
   try {
      const admin = await requireAdminUser();
      const parsed = adminOverrideSchema.safeParse(input);

      if (!parsed.success) {
         const firstError = parsed.error.issues[0]?.message ?? "Invalid input.";
         return {
            ok: false,
            code: "INVALID_INPUT",
            message: firstError,
         };
      }

      const todayDateKey = new Date().toISOString().slice(0, 10);
      if (parsed.data.logDate > todayDateKey) {
         return {
            ok: false,
            code: "FUTURE_DATE_NOT_ALLOWED",
            message: "Cannot log or edit study time for future dates.",
         };
      }

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

      const rawReason = parsed.data.reason?.trim() ?? "";
      if (durationSeconds > 0 && rawReason.length < 3) {
         return {
            ok: false,
            code: "INVALID_INPUT",
            message: "Audit reason must be at least 3 characters.",
         };
      }

      const effectiveReason =
         rawReason.length >= 3
            ? rawReason
            : "Set study hours to 00:00:00 by moderator";

      await executeAdminHoursOverride({
         participantId: parsed.data.participantId,
         logDate: parsed.data.logDate,
         durationSeconds,
         reason: effectiveReason,
         admin: {
            id: admin.id,
            username: admin.username,
         },
      });

      invalidateTags([cacheTags.challengeScoreboard(parsed.data.challengeId)]);

      revalidatePath(`/admin/challenges/${parsed.data.challengeId}`);
      revalidatePath(`/admin/challenges/${parsed.data.challengeId}/roster`);
      revalidatePath(`/challenge/${parsed.data.challengeId}`);
      revalidatePath("/dashboard");
      revalidatePath("/");

      logger.info(logEvents.studyLogOverride, {
         context: {
            challengeId: parsed.data.challengeId,
            participantId: parsed.data.participantId,
            logDate: parsed.data.logDate,
            durationSeconds,
            adminId: admin.id,
         },
      });

      return { ok: true };
   } catch (error) {
      logger.error(logEvents.studyLogOverride, {
         context: {
            challengeId: input?.challengeId,
            participantId: input?.participantId,
         },
         error,
      });
      return {
         ok: false,
         code: "OVERRIDE_FAILED",
         message:
            error instanceof Error
               ? error.message
               : "Failed to record manual hours override.",
      };
   }
}

const resetOverallSchema = z.object({
   challengeId: z.string().min(1),
   participantId: z.string().min(1),
   reason: z.string().optional(),
});

/**
 * Host manual overall hours reset action (Law L5 / FEAT-LOG-04).
 * Resets all study time for a participant across all challenge days to 0.
 */
export async function adminResetParticipantOverallHoursAction(
   input: z.infer<typeof resetOverallSchema>
): Promise<AdminOverrideResult> {
   try {
      const admin = await requireAdminUser();
      const parsed = resetOverallSchema.safeParse(input);

      if (!parsed.success) {
         return {
            ok: false,
            code: "INVALID_INPUT",
            message: "Invalid input provided.",
         };
      }

      const rawReason = parsed.data.reason?.trim() ?? "";
      const effectiveReason =
         rawReason.length >= 3
            ? rawReason
            : "Reset overall study hours to 00:00:00 by moderator";

      await executeAdminResetOverallHours({
         participantId: parsed.data.participantId,
         challengeId: parsed.data.challengeId,
         reason: effectiveReason,
         admin: {
            id: admin.id,
            username: admin.username,
         },
      });

      invalidateTags([cacheTags.challengeScoreboard(parsed.data.challengeId)]);

      revalidatePath(`/admin/challenges/${parsed.data.challengeId}`);
      revalidatePath(`/admin/challenges/${parsed.data.challengeId}/roster`);
      revalidatePath(`/challenge/${parsed.data.challengeId}`);
      revalidatePath("/dashboard");
      revalidatePath("/");

      logger.info(logEvents.studyLogTotalReset, {
         context: {
            challengeId: parsed.data.challengeId,
            participantId: parsed.data.participantId,
            adminId: admin.id,
         },
      });

      return { ok: true };
   } catch (error) {
      logger.error(logEvents.studyLogTotalReset, {
         context: {
            challengeId: input?.challengeId,
            participantId: input?.participantId,
         },
         error,
      });
      return {
         ok: false,
         code: "RESET_FAILED",
         message:
            error instanceof Error
               ? error.message
               : "Failed to reset overall hours.",
      };
   }
}
