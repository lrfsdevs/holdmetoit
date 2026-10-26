"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { cacheTags, invalidateTags } from "@/core/cache";
import { createLogger, logEvents } from "@/core/observability/logger";
import {
   AuthError,
   requireSessionUser,
} from "@/features/auth/api/require-session";
import {
   DuoTeamIdentityError,
   DUO_TEAM_EMOJI_MAX_INPUT_LENGTH,
   DUO_TEAM_NAME_MAX_LENGTH,
} from "@/features/challenges/domain/duo-team-identity";
import { updateDuoTeamIdentity } from "@/features/challenges/data/team.repository";
import { clearTeamColorCache } from "@/features/challenges/domain/team-colors";

const logger = createLogger("challenge.duo-team");

const updateDuoTeamIdentitySchema = z.object({
   challengeId: z.string().min(1),
   name: z
      .string()
      .trim()
      .min(1, "Duo name cannot be empty.")
      .max(
         DUO_TEAM_NAME_MAX_LENGTH,
         `Duo name cannot exceed ${DUO_TEAM_NAME_MAX_LENGTH} characters.`
      ),
   iconEmoji: z
      .string()
      .trim()
      .max(DUO_TEAM_EMOJI_MAX_INPUT_LENGTH, "Please pick a single emoji.")
      .optional()
      .nullable(),
});

export type UpdateDuoTeamIdentityActionResult =
   { ok: true } | { ok: false; code: string; message: string };

/** Updates the signed-in participant's duo name and emoji while unlocked. */
export async function updateDuoTeamIdentityAction(
   input: z.infer<typeof updateDuoTeamIdentitySchema>
): Promise<UpdateDuoTeamIdentityActionResult> {
   try {
      const user = await requireSessionUser();
      const parsed = updateDuoTeamIdentitySchema.safeParse(input);

      if (!parsed.success) {
         return {
            ok: false,
            code: "INVALID_INPUT",
            message:
               parsed.error.issues[0]?.message ??
               "Please enter valid duo details.",
         };
      }

      await updateDuoTeamIdentity({
         challengeId: parsed.data.challengeId,
         userId: user.id,
         name: parsed.data.name,
         iconEmoji: parsed.data.iconEmoji || null,
         actor: {
            username: user.name ?? user.displayName ?? "participant",
            displayName: user.displayName ?? null,
         },
      });

      invalidateTags([
         cacheTags.challengeScoreboard(parsed.data.challengeId),
         cacheTags.challengeMetadata(parsed.data.challengeId),
      ]);
      clearTeamColorCache();

      revalidatePath(`/challenge/${parsed.data.challengeId}`);
      revalidatePath("/");
      revalidatePath("/challenges");

      logger.info(logEvents.challengeUpdated, {
         context: {
            challengeId: parsed.data.challengeId,
            userId: user.id,
            name: parsed.data.name,
            iconEmoji: parsed.data.iconEmoji || null,
         },
      });

      return { ok: true };
   } catch (error) {
      if (error instanceof AuthError) {
         return {
            ok: false,
            code: "UNAUTHENTICATED",
            message: error.message,
         };
      }

      if (error instanceof DuoTeamIdentityError) {
         logger.debug(logEvents.challengeUpdated, {
            context: {
               challengeId: input?.challengeId,
               code: error.code,
            },
         });
         return { ok: false, code: error.code, message: error.message };
      }

      logger.error(logEvents.challengeUpdated, {
         context: { challengeId: input?.challengeId },
         error,
      });

      return {
         ok: false,
         code: "UPDATE_FAILED",
         message:
            error instanceof Error
               ? error.message
               : "Failed to update your duo team.",
      };
   }
}
