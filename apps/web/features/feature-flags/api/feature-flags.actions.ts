"use server";

import { revalidatePath } from "next/cache";
import { requireDevUser } from "@/features/auth/api/require-dev";
import {
   assignTesterTx,
   createFeatureFlagTx,
   getFlagAuditTrail,
   removeTesterTx,
   searchAssignableDiscordUsers,
   setRolloutModeTx,
   softDeleteFeatureFlagTx,
   toggleMasterSwitchTx,
   updateFeatureFlagTx,
} from "../data/feature-flags.repository";
import {
   createFeatureFlagSchema,
   manageTesterSchema,
   setRolloutModeSchema,
   toggleMasterSwitchSchema,
   updateFeatureFlagSchema,
} from "../domain/feature-flags.schema";

export type ActionResult<T = unknown> =
   { ok: true; data: T } | { ok: false; error: string };

/**
 * Creates a new feature flag in the DevBoard. Strictly DEV role only.
 */
export async function createFeatureFlagAction(
   rawInput: unknown
): Promise<ActionResult> {
   try {
      const dev = await requireDevUser();
      const parsed = createFeatureFlagSchema.safeParse(rawInput);

      if (!parsed.success) {
         return {
            ok: false,
            error:
               parsed.error.issues[0]?.message ?? "Invalid feature flag data.",
         };
      }

      const flag = await createFeatureFlagTx(parsed.data, dev.id);
      revalidatePath("/devboard");
      return { ok: true, data: flag };
   } catch (error) {
      return {
         ok: false,
         error:
            error instanceof Error ? error.message : "Failed to create flag.",
      };
   }
}

/**
 * Updates a feature flag's name and description.
 */
export async function updateFeatureFlagAction(
   rawInput: unknown
): Promise<ActionResult> {
   try {
      const dev = await requireDevUser();
      const parsed = updateFeatureFlagSchema.safeParse(rawInput);

      if (!parsed.success) {
         return {
            ok: false,
            error: parsed.error.issues[0]?.message ?? "Invalid update data.",
         };
      }

      const updated = await updateFeatureFlagTx(
         parsed.data.flagId,
         parsed.data,
         dev.id
      );
      revalidatePath("/devboard");
      return { ok: true, data: updated };
   } catch (error) {
      return {
         ok: false,
         error:
            error instanceof Error ? error.message : "Failed to update flag.",
      };
   }
}

/**
 * Toggles the master switch (isEnabled) as an emergency kill-switch.
 */
export async function toggleMasterSwitchAction(
   rawInput: unknown
): Promise<ActionResult> {
   try {
      const dev = await requireDevUser();
      const parsed = toggleMasterSwitchSchema.safeParse(rawInput);

      if (!parsed.success) {
         return {
            ok: false,
            error: parsed.error.issues[0]?.message ?? "Invalid toggle data.",
         };
      }

      const updated = await toggleMasterSwitchTx(
         parsed.data.flagId,
         parsed.data.isEnabled,
         dev.id
      );
      revalidatePath("/devboard");
      return { ok: true, data: updated };
   } catch (error) {
      return {
         ok: false,
         error:
            error instanceof Error ? error.message : "Failed to toggle switch.",
      };
   }
}

/**
 * Updates rollout mode (DISABLED, TARGETED, GLOBAL).
 */
export async function setRolloutModeAction(
   rawInput: unknown
): Promise<ActionResult> {
   try {
      const dev = await requireDevUser();
      const parsed = setRolloutModeSchema.safeParse(rawInput);

      if (!parsed.success) {
         return {
            ok: false,
            error: parsed.error.issues[0]?.message ?? "Invalid rollout mode.",
         };
      }

      const updated = await setRolloutModeTx(
         parsed.data.flagId,
         parsed.data.rolloutMode,
         dev.id
      );
      revalidatePath("/devboard");
      return { ok: true, data: updated };
   } catch (error) {
      return {
         ok: false,
         error:
            error instanceof Error
               ? error.message
               : "Failed to update rollout mode.",
      };
   }
}

/**
 * Assigns a Discord user as an alpha/beta tester.
 */
export async function assignTesterAction(
   rawInput: unknown
): Promise<ActionResult> {
   try {
      const dev = await requireDevUser();
      const parsed = manageTesterSchema.safeParse(rawInput);

      if (!parsed.success) {
         return {
            ok: false,
            error: parsed.error.issues[0]?.message ?? "Invalid tester payload.",
         };
      }

      const target = await assignTesterTx(
         parsed.data.flagId,
         parsed.data.targetUserId,
         dev.id
      );
      revalidatePath("/devboard");
      return { ok: true, data: target };
   } catch (error) {
      return {
         ok: false,
         error:
            error instanceof Error ? error.message : "Failed to assign tester.",
      };
   }
}

/**
 * Removes an assigned tester.
 */
export async function removeTesterAction(
   rawInput: unknown
): Promise<ActionResult> {
   try {
      const dev = await requireDevUser();
      const parsed = manageTesterSchema.safeParse(rawInput);

      if (!parsed.success) {
         return {
            ok: false,
            error: parsed.error.issues[0]?.message ?? "Invalid tester payload.",
         };
      }

      const removed = await removeTesterTx(
         parsed.data.flagId,
         parsed.data.targetUserId,
         dev.id
      );
      revalidatePath("/devboard");
      return { ok: true, data: removed };
   } catch (error) {
      return {
         ok: false,
         error:
            error instanceof Error ? error.message : "Failed to remove tester.",
      };
   }
}

/**
 * Soft deletes a flag.
 */
export async function deleteFeatureFlagAction(
   flagId: string
): Promise<ActionResult> {
   try {
      const dev = await requireDevUser();
      if (!flagId) {
         return { ok: false, error: "Flag ID is required." };
      }

      const deleted = await softDeleteFeatureFlagTx(flagId, dev.id);
      revalidatePath("/devboard");
      return { ok: true, data: deleted };
   } catch (error) {
      return {
         ok: false,
         error:
            error instanceof Error ? error.message : "Failed to delete flag.",
      };
   }
}

/**
 * Retrieves the full audit history for a flag.
 */
export async function getFlagAuditTrailAction(
   flagId: string
): Promise<ActionResult> {
   try {
      await requireDevUser();
      const logs = await getFlagAuditTrail(flagId);
      return { ok: true, data: logs };
   } catch (error) {
      return {
         ok: false,
         error:
            error instanceof Error
               ? error.message
               : "Failed to retrieve audit trail.",
      };
   }
}

/**
 * Searches Discord users to assign as testers.
 */
export async function searchDiscordUsersAction(
   query: string
): Promise<ActionResult> {
   try {
      await requireDevUser();
      const users = await searchAssignableDiscordUsers(query);
      return { ok: true, data: users };
   } catch (error) {
      return {
         ok: false,
         error:
            error instanceof Error
               ? error.message
               : "Failed to search Discord users.",
      };
   }
}
