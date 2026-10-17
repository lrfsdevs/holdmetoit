"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminUser } from "@/features/auth/api/require-admin";
import { adminPardonParticipant } from "@/features/accountability/data/admin-pardon.repository";
import { createLogger, logEvents } from "@/core/observability/logger";

const logger = createLogger("accountability.pardon");

const adminPardonSchema = z.object({
   challengeId: z.string().min(1),
   participantId: z.string().min(1),
   reason: z.string().min(3, "Please provide an excuse/pardon rationale."),
});

export type AdminPardonResult =
   { ok: true } | { ok: false; code: string; message: string };

export async function adminPardonAction(
   input: z.infer<typeof adminPardonSchema>
): Promise<AdminPardonResult> {
   try {
      const admin = await requireAdminUser();
      const parsed = adminPardonSchema.safeParse(input);

      if (!parsed.success) {
         return {
            ok: false,
            code: "INVALID_INPUT",
            message:
               parsed.error.issues[0]?.message ?? "Invalid pardon request.",
         };
      }

      await adminPardonParticipant({
         participantId: parsed.data.participantId,
         reason: parsed.data.reason,
         admin: {
            id: admin.id,
            username: admin.username,
         },
      });

      revalidatePath(`/admin/challenges/${parsed.data.challengeId}`);
      revalidatePath(`/challenge/${parsed.data.challengeId}`);
      revalidatePath("/dashboard");
      revalidatePath("/");

      logger.info(logEvents.accountabilityPardoned, {
         context: {
            challengeId: parsed.data.challengeId,
            participantId: parsed.data.participantId,
            adminId: admin.id,
         },
      });

      return { ok: true };
   } catch (error) {
      logger.error(logEvents.accountabilityPardoned, {
         context: {
            challengeId: input?.challengeId,
            participantId: input?.participantId,
         },
         error,
      });
      return {
         ok: false,
         code: "PARDON_FAILED",
         message:
            error instanceof Error
               ? error.message
               : "Failed to pardon participant.",
      };
   }
}
