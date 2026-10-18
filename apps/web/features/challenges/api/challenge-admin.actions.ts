"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
   AdminAccessError,
   requireAdminUser,
} from "@/features/auth/api/require-admin";
import { isFeatureEnabled } from "@/features/feature-flags/api/server";
import { FEATURE_FLAG_KEYS } from "@/features/feature-flags/domain/feature-flag-keys";
import {
   adminEnrollParticipant,
   adminUpdateParticipantTarget,
   createAdminChallenge,
   deleteAdminChallenge,
   kickoffChallenge,
   lockChallengeResults,
   reassignParticipantTeam,
   removeChallengeParticipant,
   unlockChallengeResults,
   updateAdminChallenge,
} from "@/features/challenges/data/challenge-admin.repository";
import { getStorageUrlConfig } from "@/core/storage/supabase-storage";
import { findChallengeImageUrls } from "@/features/challenges/data/punishment-pfp.repository";
import { cleanupUnreferencedChallengeImages } from "@/features/challenges/data/challenge-image-cleanup";
import { validateChallengeCreation } from "@/features/challenges/domain/challenge-lifecycle";
import { validateWeeklyTargetSeconds } from "@/features/challenges/domain/target-hours.validation";
import { composeDurationSeconds } from "@/features/study-logs/domain/daily-log.validation";
import {
   extractManagedObjectPath,
   type ChallengeImagePurpose,
} from "@/features/challenges/domain/punishment-pfp";
import { cacheTags, invalidateTags } from "@/core/cache";
import { clearTeamColorCache } from "@/features/challenges/domain/team-colors";
import { createLogger, logEvents } from "@/core/observability/logger";

const logger = createLogger("challenge.admin");

const BANNER_REQUIRED_MESSAGE = "Please upload an event header image.";
const PFP_REQUIRED_MESSAGE = "Please upload a punishment PFP.";

function isImageUrlAllowed(
   url: string | null,
   purpose: ChallengeImagePurpose
): boolean {
   try {
      return (
         extractManagedObjectPath(url, getStorageUrlConfig(purpose)) !== null
      );
   } catch {
      return false;
   }
}

const createChallengeSchema = z.object({
   title: z.string().min(3).max(80),
   description: z.string().max(5000).optional().nullable(),
   format: z.enum(["TEAM_VS_TEAM", "DUOS", "SOLOS"]),
   startAt: z.string().min(1),
   endAt: z.string().min(1),
   eventBannerUrl: z.string().trim().min(1, BANNER_REQUIRED_MESSAGE),
   punishmentPfpUrl: z.string().trim().min(1, PFP_REQUIRED_MESSAGE),
   rewardCoins: z.number().int().min(0).max(10000).optional(),
   isBettingEnabled: z.boolean().optional(),
   teams: z
      .array(
         z.object({
            name: z.string().min(1),
            color: z.string().optional().nullable(),
            iconEmoji: z.string().optional().nullable(),
            mascotUrl: z.string().optional().nullable(),
         })
      )
      .min(1),
});

export type AdminActionResult<T = undefined> =
   { ok: true; data?: T } | { ok: false; code: string; message: string };

export async function createChallengeAction(
   input: z.infer<typeof createChallengeSchema>
): Promise<AdminActionResult<{ challengeId: string }>> {
   try {
      const admin = await requireAdminUser();
      const parsed = createChallengeSchema.safeParse(input);

      if (!parsed.success) {
         return {
            ok: false,
            code: "INVALID_INPUT",
            message: parsed.error.issues.some(
               (issue) => issue.path[0] === "eventBannerUrl"
            )
               ? BANNER_REQUIRED_MESSAGE
               : parsed.error.issues.some(
                      (issue) => issue.path[0] === "punishmentPfpUrl"
                   )
                 ? PFP_REQUIRED_MESSAGE
                 : "Please ensure all challenge fields and dates are filled properly.",
         };
      }

      if (!isImageUrlAllowed(parsed.data.eventBannerUrl, "event-banner")) {
         return {
            ok: false,
            code: "INVALID_EVENT_BANNER",
            message:
               "Please upload an event header image through its image picker.",
         };
      }
      if (!isImageUrlAllowed(parsed.data.punishmentPfpUrl, "punishment-pfp")) {
         return {
            ok: false,
            code: "INVALID_PUNISHMENT_PFP",
            message: "Please upload a punishment PFP through its image picker.",
         };
      }

      const validation = validateChallengeCreation(parsed.data);
      if (!validation.valid) {
         const firstError =
            Object.values(validation.errors)[0] ?? "Validation error.";
         return {
            ok: false,
            code: "VALIDATION_FAILED",
            message: firstError,
         };
      }

      const challenge = await createAdminChallenge(parsed.data, {
         id: admin.id,
         username: admin.username,
      });

      revalidatePath("/challenges");
      revalidatePath("/admin");

      logger.info(logEvents.challengeCreated, {
         context: {
            challengeId: challenge.id,
            adminId: admin.id,
            format: parsed.data.format,
         },
      });

      return {
         ok: true,
         data: { challengeId: challenge.id },
      };
   } catch (error) {
      logger.error(logEvents.challengeCreated, { error });
      return {
         ok: false,
         code: "CREATION_FAILED",
         message:
            error instanceof Error
               ? error.message
               : "Failed to create challenge event.",
      };
   }
}

export async function kickoffChallengeAction(
   challengeId: string
): Promise<AdminActionResult> {
   try {
      const admin = await requireAdminUser();
      await kickoffChallenge(challengeId, {
         id: admin.id,
         username: admin.username,
      });

      invalidateTags([
         cacheTags.challengeScoreboard(challengeId),
         cacheTags.challengeMetadata(challengeId),
      ]);

      revalidatePath(`/challenge/${challengeId}`);
      revalidatePath("/challenges");
      revalidatePath("/admin");
      revalidatePath("/");

      logger.info(logEvents.challengeKickoff, {
         context: { challengeId, adminId: admin.id },
      });

      return { ok: true };
   } catch (error) {
      logger.error(logEvents.challengeKickoff, {
         context: { challengeId },
         error,
      });
      return {
         ok: false,
         code: "KICKOFF_FAILED",
         message:
            error instanceof Error ? error.message : "Failed to start event.",
      };
   }
}

export async function lockChallengeResultsAction(
   challengeId: string
): Promise<AdminActionResult> {
   try {
      const admin = await requireAdminUser();
      const settleTrophies = await isFeatureEnabled(
         FEATURE_FLAG_KEYS.globalLeaderboard
      );
      await lockChallengeResults(
         challengeId,
         { id: admin.id, username: admin.username },
         { settleTrophies }
      );

      invalidateTags([
         cacheTags.challengeScoreboard(challengeId),
         cacheTags.challengeMetadata(challengeId),
      ]);

      revalidatePath(`/challenge/${challengeId}`);
      revalidatePath("/challenges");
      revalidatePath("/admin");
      revalidatePath("/");

      logger.info(logEvents.challengeLocked, {
         context: { challengeId, adminId: admin.id },
      });

      return { ok: true };
   } catch (error) {
      logger.error(logEvents.challengeLocked, {
         context: { challengeId },
         error,
      });
      return {
         ok: false,
         code: "LOCK_FAILED",
         message:
            error instanceof Error
               ? error.message
               : "Failed to finalize and lock results.",
      };
   }
}

export async function unlockChallengeResultsAction(
   challengeId: string
): Promise<AdminActionResult> {
   try {
      const admin = await requireAdminUser();
      await unlockChallengeResults(challengeId, {
         id: admin.id,
         username: admin.username,
      });

      invalidateTags([
         cacheTags.challengeScoreboard(challengeId),
         cacheTags.challengeMetadata(challengeId),
      ]);

      revalidatePath(`/challenge/${challengeId}`);
      revalidatePath("/challenges");
      revalidatePath("/admin");
      revalidatePath("/");

      logger.info(logEvents.challengeUnlocked, {
         context: { challengeId, adminId: admin.id },
      });

      return { ok: true };
   } catch (error) {
      logger.error(logEvents.challengeUnlocked, {
         context: { challengeId },
         error,
      });
      return {
         ok: false,
         code: "UNLOCK_FAILED",
         message:
            error instanceof Error
               ? error.message
               : "Failed to unlock the final results.",
      };
   }
}

const adminEnrollParticipantSchema = z.object({
   challengeId: z.string().min(1),
   userId: z.string().min(1),
   teamId: z.string().min(1),
   targetSeconds: z.number().int().min(0).default(126000),
   reason: z.string().min(3, "Audit reason must be at least 3 characters."),
});

export async function adminEnrollParticipantAction(
   input: z.infer<typeof adminEnrollParticipantSchema>
): Promise<AdminActionResult> {
   try {
      const admin = await requireAdminUser();
      const parsed = adminEnrollParticipantSchema.safeParse(input);

      if (!parsed.success) {
         return {
            ok: false,
            code: "INVALID_INPUT",
            message:
               parsed.error.issues[0]?.message ?? "Invalid enrollment data.",
         };
      }

      await adminEnrollParticipant({
         challengeId: parsed.data.challengeId,
         userId: parsed.data.userId,
         teamId: parsed.data.teamId,
         targetSeconds: parsed.data.targetSeconds,
         reason: parsed.data.reason,
         admin: {
            id: admin.id,
            username: admin.username,
         },
      });

      invalidateTags([
         cacheTags.challengeScoreboard(parsed.data.challengeId),
         cacheTags.participantCockpit(
            parsed.data.userId,
            parsed.data.challengeId
         ),
      ]);

      revalidatePath(`/challenge/${parsed.data.challengeId}`);
      revalidatePath("/challenges");
      revalidatePath("/");

      logger.info(logEvents.challengeEnrolled, {
         context: {
            challengeId: parsed.data.challengeId,
            userId: parsed.data.userId,
            teamId: parsed.data.teamId,
            targetSeconds: parsed.data.targetSeconds,
            adminId: admin.id,
         },
      });

      return { ok: true };
   } catch (error) {
      if (error instanceof AdminAccessError) {
         logger.debug(logEvents.challengeEnrolled, {
            context: { challengeId: input?.challengeId, code: error.code },
            error,
         });
         return {
            ok: false,
            code: error.code,
            message: error.message,
         };
      }

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
               : "Failed to enroll member in challenge.",
      };
   }
}

const updateChallengeSchema = z.object({
   challengeId: z.string().min(1),
   title: z.string().min(3).max(80),
   description: z.string().max(5000).optional().nullable(),
   startAt: z.string().min(1),
   endAt: z.string().min(1),
   // Updates preserve exact legacy strings; only changed values need folder validation.
   eventBannerUrl: z.string().nullable(),
   punishmentPfpUrl: z.string().nullable(),
   rewardCoins: z.number().int().min(0).max(10000).optional(),
   isBettingEnabled: z.boolean().optional(),
   teams: z
      .array(
         z.object({
            id: z.string().optional(),
            name: z.string().min(1),
            color: z.string().optional().nullable(),
            iconEmoji: z.string().optional().nullable(),
            mascotUrl: z.string().optional().nullable(),
         })
      )
      .min(1),
});

export async function updateChallengeAction(
   input: z.infer<typeof updateChallengeSchema>
): Promise<AdminActionResult> {
   try {
      const parsed = updateChallengeSchema.safeParse(input);

      if (!parsed.success) {
         return {
            ok: false,
            code: "INVALID_INPUT",
            message: parsed.error.issues.some(
               (issue) => issue.path[0] === "eventBannerUrl"
            )
               ? BANNER_REQUIRED_MESSAGE
               : parsed.error.issues.some(
                      (issue) => issue.path[0] === "punishmentPfpUrl"
                   )
                 ? PFP_REQUIRED_MESSAGE
                 : "Please check all required fields and team names.",
         };
      }

      if (new Date(parsed.data.endAt) <= new Date(parsed.data.startAt)) {
         return {
            ok: false,
            code: "INVALID_DATES",
            message: "Conclusion date must be strictly after the kickoff date.",
         };
      }

      const [admin, previousImages] = await Promise.all([
         requireAdminUser(),
         findChallengeImageUrls(parsed.data.challengeId),
      ]);

      if (!previousImages) {
         return {
            ok: false,
            code: "NOT_FOUND",
            message: "Challenge not found.",
         };
      }

      // Grandfather only the exact persisted values (including null); replacements
      // must come from their designated folder, never from the other image picker.
      if (
         parsed.data.eventBannerUrl !== previousImages.eventBannerUrl &&
         !isImageUrlAllowed(parsed.data.eventBannerUrl, "event-banner")
      ) {
         return {
            ok: false,
            code: "INVALID_EVENT_BANNER",
            message:
               "Please upload an event header image through its image picker.",
         };
      }
      if (
         parsed.data.punishmentPfpUrl !== previousImages.punishmentPfpUrl &&
         !isImageUrlAllowed(parsed.data.punishmentPfpUrl, "punishment-pfp")
      ) {
         return {
            ok: false,
            code: "INVALID_PUNISHMENT_PFP",
            message: "Please upload a punishment PFP through its image picker.",
         };
      }

      await updateAdminChallenge(
         parsed.data.challengeId,
         {
            title: parsed.data.title,
            description: parsed.data.description,
            startAt: parsed.data.startAt,
            endAt: parsed.data.endAt,
            eventBannerUrl: parsed.data.eventBannerUrl,
            punishmentPfpUrl: parsed.data.punishmentPfpUrl,
            rewardCoins: parsed.data.rewardCoins,
            isBettingEnabled: parsed.data.isBettingEnabled,
            teams: parsed.data.teams,
         },
         {
            id: admin.id,
            username: admin.username,
         }
      );

      // Cleanup only after commit, and retain images still referenced by either field.
      const replacedUrls: Array<string | null> = [];
      if (previousImages.eventBannerUrl !== parsed.data.eventBannerUrl) {
         replacedUrls.push(previousImages.eventBannerUrl);
      }
      if (previousImages.punishmentPfpUrl !== parsed.data.punishmentPfpUrl) {
         replacedUrls.push(previousImages.punishmentPfpUrl);
      }
      await cleanupUnreferencedChallengeImages(replacedUrls);

      invalidateTags([
         cacheTags.challengeScoreboard(parsed.data.challengeId),
         cacheTags.challengeMetadata(parsed.data.challengeId),
      ]);
      clearTeamColorCache();

      revalidatePath(`/challenge/${parsed.data.challengeId}`);
      revalidatePath("/challenges");
      revalidatePath("/admin");
      revalidatePath("/");

      logger.info(logEvents.challengeUpdated, {
         context: {
            challengeId: parsed.data.challengeId,
            adminId: admin.id,
         },
      });

      return { ok: true };
   } catch (error) {
      if (error instanceof AdminAccessError) {
         logger.debug(logEvents.challengeUpdated, {
            context: { challengeId: input?.challengeId, code: error.code },
            error,
         });
         return {
            ok: false,
            code: error.code,
            message: error.message,
         };
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
               : "Failed to update challenge.",
      };
   }
}

const reassignParticipantTeamSchema = z.object({
   challengeId: z.string().min(1),
   participantId: z.string().min(1),
   newTeamId: z.string().min(1),
   reason: z.string().optional(),
});

export async function reassignParticipantTeamAction(
   input: z.infer<typeof reassignParticipantTeamSchema>
): Promise<AdminActionResult> {
   try {
      const admin = await requireAdminUser();
      const parsed = reassignParticipantTeamSchema.safeParse(input);

      if (!parsed.success) {
         return {
            ok: false,
            code: "INVALID_INPUT",
            message: "Invalid team reassignment parameters.",
         };
      }

      await reassignParticipantTeam({
         participantId: parsed.data.participantId,
         newTeamId: parsed.data.newTeamId,
         reason: parsed.data.reason,
         admin: {
            id: admin.id,
            username: admin.username,
         },
      });

      invalidateTags([cacheTags.challengeScoreboard(parsed.data.challengeId)]);

      revalidatePath(`/challenge/${parsed.data.challengeId}`);
      revalidatePath("/challenges");
      revalidatePath("/admin");
      revalidatePath("/");

      logger.info(logEvents.challengeParticipantReassigned, {
         context: {
            challengeId: parsed.data.challengeId,
            participantId: parsed.data.participantId,
            newTeamId: parsed.data.newTeamId,
            adminId: admin.id,
         },
      });

      return { ok: true };
   } catch (error) {
      if (error instanceof AdminAccessError) {
         logger.debug(logEvents.challengeParticipantReassigned, {
            context: { challengeId: input?.challengeId, code: error.code },
            error,
         });
         return {
            ok: false,
            code: error.code,
            message: error.message,
         };
      }

      logger.error(logEvents.challengeParticipantReassigned, {
         context: {
            challengeId: input?.challengeId,
            participantId: input?.participantId,
         },
         error,
      });
      return {
         ok: false,
         code: "REASSIGN_FAILED",
         message:
            error instanceof Error
               ? error.message
               : "Failed to reassign participant to team.",
      };
   }
}

const removeParticipantSchema = z.object({
   challengeId: z.string().min(1),
   participantId: z.string().min(1),
   reason: z.string().min(3, "Audit reason must be at least 3 characters."),
});

export async function removeChallengeParticipantAction(
   input: z.infer<typeof removeParticipantSchema>
): Promise<AdminActionResult> {
   try {
      const admin = await requireAdminUser();
      const parsed = removeParticipantSchema.safeParse(input);

      if (!parsed.success) {
         return {
            ok: false,
            code: "INVALID_INPUT",
            message: parsed.error.issues[0]?.message ?? "Invalid removal data.",
         };
      }

      await removeChallengeParticipant({
         participantId: parsed.data.participantId,
         reason: parsed.data.reason,
         admin: {
            id: admin.id,
            username: admin.username,
         },
      });

      invalidateTags([cacheTags.challengeScoreboard(parsed.data.challengeId)]);

      revalidatePath(`/challenge/${parsed.data.challengeId}`);
      revalidatePath("/challenges");
      revalidatePath("/admin");
      revalidatePath("/");

      logger.info(logEvents.challengeParticipantRemoved, {
         context: {
            challengeId: parsed.data.challengeId,
            participantId: parsed.data.participantId,
            adminId: admin.id,
         },
      });

      return { ok: true };
   } catch (error) {
      if (error instanceof AdminAccessError) {
         logger.debug(logEvents.challengeParticipantRemoved, {
            context: { challengeId: input?.challengeId, code: error.code },
            error,
         });
         return {
            ok: false,
            code: error.code,
            message: error.message,
         };
      }

      logger.error(logEvents.challengeParticipantRemoved, {
         context: {
            challengeId: input?.challengeId,
            participantId: input?.participantId,
         },
         error,
      });
      return {
         ok: false,
         code: "REMOVAL_FAILED",
         message:
            error instanceof Error
               ? error.message
               : "Failed to remove participant from challenge.",
      };
   }
}
const adminUpdateParticipantTargetSchema = z.object({
   challengeId: z.string().min(1),
   participantId: z.string().min(1),
   hours: z.number().int().min(0).max(105).optional(),
   minutes: z.number().int().min(0).max(59).optional(),
   seconds: z.number().int().min(0).max(59).optional(),
   targetSeconds: z.number().int().optional(),
   reason: z.string().optional(),
});

/**
 * Host/Mod/Dev manual target hours override action (Law L5 / FEAT-DECL-04).
 */
export async function adminUpdateParticipantTargetAction(
   input: z.infer<typeof adminUpdateParticipantTargetSchema>
): Promise<AdminActionResult<{ targetSeconds: number }>> {
   try {
      const admin = await requireAdminUser();
      const parsed = adminUpdateParticipantTargetSchema.safeParse(input);

      if (!parsed.success) {
         return {
            ok: false,
            code: "INVALID_INPUT",
            message:
               "Please enter valid target hours (between 1 and 105 hours).",
         };
      }

      const targetSeconds =
         parsed.data.targetSeconds !== undefined
            ? parsed.data.targetSeconds
            : composeDurationSeconds(
                 parsed.data.hours ?? 0,
                 parsed.data.minutes ?? 0,
                 parsed.data.seconds ?? 0
              );

      const validation = validateWeeklyTargetSeconds(targetSeconds);
      if (!validation.ok) {
         return {
            ok: false,
            code: validation.code,
            message: validation.message,
         };
      }

      const updated = await adminUpdateParticipantTarget({
         challengeId: parsed.data.challengeId,
         participantId: parsed.data.participantId,
         targetSeconds,
         reason: parsed.data.reason,
         admin: {
            id: admin.id,
            username: admin.username,
         },
      });

      invalidateTags([
         cacheTags.challengeScoreboard(parsed.data.challengeId),
         cacheTags.challengeMetadata(parsed.data.challengeId),
      ]);

      revalidatePath(`/challenge/${parsed.data.challengeId}`);
      revalidatePath(
         `/challenge/${parsed.data.challengeId}/participant/${parsed.data.participantId}`
      );
      revalidatePath("/challenges");
      revalidatePath("/admin");
      revalidatePath("/");

      logger.info(logEvents.challengeTargetOverridden, {
         context: {
            challengeId: parsed.data.challengeId,
            participantId: parsed.data.participantId,
            targetSeconds: updated.targetSeconds,
            adminId: admin.id,
         },
      });

      return {
         ok: true,
         data: { targetSeconds: updated.targetSeconds },
      };
   } catch (error) {
      if (error instanceof AdminAccessError) {
         logger.debug(logEvents.challengeTargetOverridden, {
            context: { challengeId: input?.challengeId, code: error.code },
            error,
         });
         return {
            ok: false,
            code: error.code,
            message: error.message,
         };
      }

      logger.error(logEvents.challengeTargetOverridden, {
         context: {
            challengeId: input?.challengeId,
            participantId: input?.participantId,
         },
         error,
      });
      return {
         ok: false,
         code: "UPDATE_TARGET_FAILED",
         message:
            error instanceof Error
               ? error.message
               : "Failed to update participant target hours.",
      };
   }
}

export async function deleteChallengeAction(
   challengeId: string
): Promise<AdminActionResult<{ redirectTo: string }>> {
   try {
      const admin = await requireAdminUser();
      if (!challengeId || typeof challengeId !== "string") {
         return {
            ok: false,
            code: "INVALID_INPUT",
            message: "Missing challenge ID.",
         };
      }

      const previousImages = await findChallengeImageUrls(challengeId);

      await deleteAdminChallenge(challengeId, {
         id: admin.id,
         username: admin.username,
      });

      await cleanupUnreferencedChallengeImages([
         previousImages?.eventBannerUrl,
         previousImages?.punishmentPfpUrl,
      ]);

      invalidateTags([
         cacheTags.challengeScoreboard(challengeId),
         cacheTags.challengeMetadata(challengeId),
      ]);
      clearTeamColorCache();

      revalidatePath("/challenges");
      revalidatePath("/admin");
      revalidatePath("/");

      logger.info(logEvents.challengeDeleted, {
         context: { challengeId, adminId: admin.id },
      });

      return {
         ok: true,
         data: { redirectTo: "/challenges" },
      };
   } catch (error) {
      if (error instanceof AdminAccessError) {
         logger.debug(logEvents.challengeDeleted, {
            context: { challengeId, code: error.code },
            error,
         });
         return {
            ok: false,
            code: error.code,
            message: error.message,
         };
      }

      logger.error(logEvents.challengeDeleted, {
         context: { challengeId },
         error,
      });
      return {
         ok: false,
         code: "DELETE_FAILED",
         message:
            error instanceof Error
               ? error.message
               : "Failed to delete challenge.",
      };
   }
}
