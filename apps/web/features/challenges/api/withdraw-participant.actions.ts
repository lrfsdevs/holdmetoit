"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { cacheTags, invalidateTags } from "@/core/cache";
import { createLogger, logEvents } from "@/core/observability/logger";
import { requireSessionUser } from "@/features/auth/api/require-session";
import { withdrawParticipant } from "@/features/challenges/data/participant.repository";
import { isFeatureEnabled } from "@/features/feature-flags/api/server";
import { FEATURE_FLAG_KEYS } from "@/features/feature-flags/domain/feature-flag-keys";

const logger = createLogger("challenge.withdraw");

const withdrawSchema = z.object({
   challengeId: z.string().min(1),
});

export type WithdrawActionResult =
   { ok: true } | { ok: false; code: string; message: string };

/** Authenticates and soft-withdraws the current participant from a challenge. */
export async function withdrawFromChallengeAction(
   input: z.infer<typeof withdrawSchema>
): Promise<WithdrawActionResult> {
   try {
      const withdrawalEnabled = await isFeatureEnabled(
         FEATURE_FLAG_KEYS.withdrawal
      );
      if (!withdrawalEnabled) {
         return {
            ok: false,
            code: "FEATURE_DISABLED",
            message: "Withdrawal is currently unavailable.",
         };
      }

      const user = await requireSessionUser();
      const parsed = withdrawSchema.safeParse(input);

      if (!parsed.success) {
         return {
            ok: false,
            code: "INVALID_INPUT",
            message: "Please provide a valid challenge.",
         };
      }

      await withdrawParticipant({
         challengeId: parsed.data.challengeId,
         userId: user.id,
      });

      invalidateTags([
         cacheTags.challengeScoreboard(parsed.data.challengeId),
         cacheTags.participantCockpit(user.id, parsed.data.challengeId),
      ]);

      revalidatePath(`/challenge/${parsed.data.challengeId}`);
      revalidatePath("/challenges");
      revalidatePath("/admin");
      revalidatePath("/");

      logger.info(logEvents.challengeParticipantWithdrew, {
         context: {
            challengeId: parsed.data.challengeId,
            userId: user.id,
         },
      });

      return { ok: true };
   } catch (error) {
      logger.error(logEvents.challengeParticipantWithdrew, {
         context: { challengeId: input?.challengeId },
         error,
      });

      return {
         ok: false,
         code: "WITHDRAWAL_FAILED",
         message:
            error instanceof Error
               ? error.message
               : "Failed to withdraw from challenge.",
      };
   }
}
