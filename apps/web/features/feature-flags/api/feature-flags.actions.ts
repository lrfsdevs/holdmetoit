"use server";

import { revalidatePath } from "next/cache";
import { toClientError } from "@/core/errors";
import { requireDevUser } from "@/features/auth/api/require-dev";
import {
   assignTesterTx,
   createFeatureFlagTx,
   getFlagAuditTrail,
   removeTesterTx,
   searchAssignableDiscordUsers,
   setRolloutModeTx,
   softDeleteFeatureFlagTx,
   updateFeatureFlagTx,
} from "../data/feature-flags.repository";
import {
   createFeatureFlagSchema,
   manageTesterSchema,
   setRolloutModeSchema,
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
      const clientError = toClientError(error, {
         scope: "feature_flags.create",
         defaultCode: "FLAG_CREATE_FAILED",
         defaultMessage: "Failed to create flag.",
      });
      return {
         ok: false,
         error: clientError.message,
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
      const clientError = toClientError(error, {
         scope: "feature_flags.update",
         defaultCode: "FLAG_UPDATE_FAILED",
         defaultMessage: "Failed to update flag.",
      });
      return {
         ok: false,
         error: clientError.message,
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
      const clientError = toClientError(error, {
         scope: "feature_flags.set_rollout",
         defaultCode: "ROLLOUT_MODE_FAILED",
         defaultMessage: "Failed to update rollout mode.",
      });
      return {
         ok: false,
         error: clientError.message,
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
      const clientError = toClientError(error, {
         scope: "feature_flags.assign_tester",
         defaultCode: "ASSIGN_TESTER_FAILED",
         defaultMessage: "Failed to assign tester.",
      });
      return {
         ok: false,
         error: clientError.message,
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
      const clientError = toClientError(error, {
         scope: "feature_flags.remove_tester",
         defaultCode: "REMOVE_TESTER_FAILED",
         defaultMessage: "Failed to remove tester.",
      });
      return {
         ok: false,
         error: clientError.message,
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
      const clientError = toClientError(error, {
         scope: "feature_flags.delete",
         defaultCode: "FLAG_DELETE_FAILED",
         defaultMessage: "Failed to delete flag.",
      });
      return {
         ok: false,
         error: clientError.message,
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
      const clientError = toClientError(error, {
         scope: "feature_flags.audit_trail",
         defaultCode: "AUDIT_TRAIL_FAILED",
         defaultMessage: "Failed to retrieve audit trail.",
      });
      return {
         ok: false,
         error: clientError.message,
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
      const clientError = toClientError(error, {
         scope: "feature_flags.search_users",
         defaultCode: "SEARCH_USERS_FAILED",
         defaultMessage: "Failed to search Discord users.",
      });
      return {
         ok: false,
         error: clientError.message,
      };
   }
}
