"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/core/auth";
import { requireSessionUser, AuthError } from "@/features/auth/api/require-session";
import {
   findUserById,
   isUsernameAvailable,
   updateUsername,
   UsernameTakenError,
   InvalidUsernameError,
} from "@/features/auth/data/user.repository";
import {
   isUsernameChangeAllowed,
   validateUsername,
} from "@/features/auth/domain/username";
import { FEATURE_FLAG_KEYS } from "@/features/feature-flags/domain/feature-flag-keys";
import { isFeatureEnabled } from "@/features/feature-flags/api/server";
import { recordAuditEvent } from "@/features/audit/data/audit-log.repository";
import { createLogger, logEvents } from "@/core/observability/logger";
import { toClientError } from "@/core/errors";

const logger = createLogger("auth.username.actions");

export type ServerActionResult<T> =
   | { ok: true; data: T }
   | { ok: false; code: string; message: string; data?: T };

export interface CheckUsernameResult {
   available: boolean;
   candidate: string;
   canonical: string;
   reason?: string;
}

export interface UpdateUsernameResult {
   username: string;
   usernameChangedAt: string;
}

/**
 * Checks whether a candidate username is valid and available.
 * Gated behind the platform_username feature flag.
 */
export async function checkUsernameAvailabilityAction(
   candidate: string
): Promise<ServerActionResult<CheckUsernameResult>> {
   try {
      const enabled = await isFeatureEnabled(
         FEATURE_FLAG_KEYS.platformUsername
      );
      if (!enabled) {
         return {
            ok: false,
            code: "FEATURE_DISABLED",
            message: "Platform usernames are currently disabled.",
         };
      }

      const validation = validateUsername(candidate);
      if (!validation.ok) {
         return {
            ok: true,
            data: {
               available: false,
               candidate: typeof candidate === "string" ? candidate.trim() : "",
               canonical:
                  typeof candidate === "string"
                     ? candidate.trim().toLowerCase()
                     : "",
               reason: validation.message,
            },
         };
      }

      const session = await auth();
      const currentUserId = session?.user?.id;

      const available = await isUsernameAvailable(
         validation.canonical,
         currentUserId
      );

      return {
         ok: true,
         data: {
            available,
            candidate: validation.formatted,
            canonical: validation.canonical,
            reason: available ? undefined : "This username is already taken.",
         },
      };
   } catch (error) {
      logger.error(logEvents.authUsernameCheckFailed, {
         context: { candidate },
         error,
      });
      const clientError = toClientError(error, {
         scope: "auth.username.check_availability",
         defaultCode: "CHECK_FAILED",
         defaultMessage: "Failed to check username availability.",
      });
      return {
         ok: false,
         code: clientError.code,
         message: clientError.message,
      };
   }
}

/**
 * Updates the authenticated user's platform username, enforcing validation,
 * 7-day cooldown, and logging an immutable audit record.
 * Gated behind the platform_username feature flag.
 */
export async function updateUsernameAction(
   newUsername: string
): Promise<ServerActionResult<UpdateUsernameResult>> {
   try {
      const enabled = await isFeatureEnabled(
         FEATURE_FLAG_KEYS.platformUsername
      );
      if (!enabled) {
         return {
            ok: false,
            code: "FEATURE_DISABLED",
            message: "Platform usernames are currently disabled.",
         };
      }

      const sessionUser = await requireSessionUser();

      const validation = validateUsername(newUsername);
      if (!validation.ok) {
         return {
            ok: false,
            code: validation.code,
            message: validation.message,
         };
      }

      const user = await findUserById(sessionUser.id);
      if (!user) {
         return {
            ok: false,
            code: "USER_NOT_FOUND",
            message: "User account could not be found.",
         };
      }

      const cooldown = isUsernameChangeAllowed(user.usernameChangedAt);
      if (!cooldown.allowed) {
         return {
            ok: false,
            code: "COOLDOWN_ACTIVE",
            message: `You can change your username again in ${cooldown.remainingDays} day(s).`,
         };
      }

      const oldUsername = user.username ?? null;
      const updatedUser = await updateUsername(user.id, validation.formatted);

      try {
         await recordAuditEvent({
            actionType: "USERNAME_UPDATED",
            actorId: user.id,
            actorUsername: updatedUser.username || "scholar",
            actorDisplayName: user.displayName || user.name || null,
            actorImage: user.image ?? sessionUser.image ?? null,
            targetEntityType: "USER",
            targetEntityId: user.id,
            targetEntityName: updatedUser.username,
            previousValue: { username: oldUsername },
            newValue: { username: updatedUser.username },
         });
      } catch (auditError) {
         // Audit recording must fail soft for users while logging diagnostics
         logger.error(logEvents.appError, {
            context: {
               action: "recordAuditEvent_USERNAME_UPDATED",
               userId: user.id,
            },
            error: auditError,
         });
      }

      logger.info(logEvents.authUsernameUpdated, {
         context: {
            userId: user.id,
            oldUsername,
            newUsername: updatedUser.username,
         },
      });

      revalidatePath("/profile");
      revalidatePath("/");

      return {
         ok: true,
         data: {
            username: updatedUser.username!,
            usernameChangedAt:
               updatedUser.usernameChangedAt?.toISOString() ??
               new Date().toISOString(),
         },
      };
   } catch (error) {
      if (error instanceof AuthError) {
         return {
            ok: false,
            code: "AUTH_REQUIRED",
            message: error.message,
         };
      }

      if (error instanceof UsernameTakenError) {
         return {
            ok: false,
            code: "USERNAME_TAKEN",
            message: error.message,
         };
      }

      if (error instanceof InvalidUsernameError) {
         return {
            ok: false,
            code: "INVALID_USERNAME",
            message: error.message,
         };
      }

      const clientError = toClientError(error, {
         scope: "auth.username.update",
         defaultCode: "UPDATE_FAILED",
         defaultMessage: "Failed to update username. Please try again.",
      });

      return {
         ok: false,
         code: clientError.code,
         message: clientError.message,
      };
   }
}
