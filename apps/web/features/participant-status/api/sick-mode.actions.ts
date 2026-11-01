"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSessionUser } from "@/features/auth/api/require-session";
import {
   activateSickMode,
   deactivateSickMode,
   getUserSickStatus,
   snoozeSickReminder,
} from "../data/sick-mode.repository";
import { SICK_MODE_MAX_NOTE_LENGTH } from "../domain/sick-mode";
import type { SickStatusSummary } from "../domain/sick-mode.types";

const toggleSickModeSchema = z.object({
   isSick: z.boolean(),
   note: z.string().max(SICK_MODE_MAX_NOTE_LENGTH).optional().nullable(),
});

const reminderResponseSchema = z.object({
   action: z.enum(["turn_off", "extend"]),
});

export type SickModeActionResult =
   { ok: true; status: SickStatusSummary } | { ok: false; message: string };

/**
 * Toggles Sick Mode for the authenticated participant.
 */
export async function toggleSickModeAction(
   input: z.infer<typeof toggleSickModeSchema>
): Promise<SickModeActionResult> {
   try {
      const user = await requireSessionUser();
      const parsed = toggleSickModeSchema.safeParse(input);

      if (!parsed.success) {
         return {
            ok: false,
            message: "Invalid input. Note must be 80 characters or fewer.",
         };
      }

      let status: SickStatusSummary;
      if (parsed.data.isSick) {
         status = await activateSickMode(user.id, parsed.data.note);
      } else {
         status = await deactivateSickMode(user.id);
      }

      revalidatePath("/");
      revalidatePath("/profile");
      revalidatePath("/admin/users");
      revalidatePath("/leaderboard");

      return { ok: true, status };
   } catch (error) {
      return {
         ok: false,
         message:
            error instanceof Error
               ? error.message
               : "An error occurred while updating Sick Mode.",
      };
   }
}

/**
 * Responds to the 3-day Sick Mode check-in reminder prompt.
 * Either deactivates Sick Mode immediately ("turn_off") or extends snooze for +2 days ("extend").
 */
export async function respondSickReminderAction(
   input: z.infer<typeof reminderResponseSchema>
): Promise<SickModeActionResult> {
   try {
      const user = await requireSessionUser();
      const parsed = reminderResponseSchema.safeParse(input);

      if (!parsed.success) {
         return {
            ok: false,
            message: "Invalid action.",
         };
      }

      let status: SickStatusSummary;
      if (parsed.data.action === "turn_off") {
         status = await deactivateSickMode(user.id);
      } else {
         status = await snoozeSickReminder(user.id);
      }

      revalidatePath("/");
      revalidatePath("/profile");
      revalidatePath("/admin/users");
      revalidatePath("/leaderboard");

      return { ok: true, status };
   } catch (error) {
      return {
         ok: false,
         message:
            error instanceof Error
               ? error.message
               : "An error occurred while processing reminder response.",
      };
   }
}

/**
 * Retrieves the current authenticated participant's Sick Mode status.
 */
export async function getMySickStatusAction(): Promise<SickStatusSummary | null> {
   try {
      const user = await requireSessionUser();
      return await getUserSickStatus(user.id);
   } catch {
      return null;
   }
}
