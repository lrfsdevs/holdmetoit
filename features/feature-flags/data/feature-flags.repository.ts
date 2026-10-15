import { prisma } from "@/core/db";
import type { RolloutModeType } from "../domain/feature-flags.types";
import type {
   CreateFeatureFlagInput,
   UpdateFeatureFlagInput,
} from "../domain/feature-flags.schema";

/**
 * Lists all active feature flags with their assigned targets and user previews.
 */
export async function listFeatureFlags(includeDeleted = false) {
   return prisma.featureFlag.findMany({
      where: includeDeleted ? undefined : { isDeleted: false },
      orderBy: { createdAt: "desc" },
      include: {
         targets: {
            include: {
               user: {
                  select: {
                     id: true,
                     name: true,
                     username: true,
                     displayName: true,
                     image: true,
                     discordId: true,
                  },
               },
            },
         },
         creator: {
            select: {
               id: true,
               displayName: true,
               username: true,
            },
         },
         _count: {
            select: {
               targets: true,
               auditLogs: true,
            },
         },
      },
   });
}

/**
 * Retrieves a single active feature flag by key with targets for runtime evaluation.
 */
export async function getFlagWithTargetsByKey(key: string) {
   return prisma.featureFlag.findUnique({
      where: { key, isDeleted: false },
      include: {
         targets: {
            select: {
               userId: true,
            },
         },
      },
   });
}

/**
 * Retrieves all active flags with targets for bulk evaluation.
 */
export async function getAllActiveFlagsWithTargets() {
   return prisma.featureFlag.findMany({
      where: { isDeleted: false },
      include: {
         targets: {
            select: {
               userId: true,
            },
         },
      },
   });
}

/**
 * Creates a new feature flag and records an audit log in a single transaction.
 */
export async function createFeatureFlagTx(
   input: CreateFeatureFlagInput,
   actorId: string
) {
   return prisma.$transaction(async (tx) => {
      const flag = await tx.featureFlag.create({
         data: {
            key: input.key,
            name: input.name,
            description: input.description,
            isEnabled: input.isEnabled,
            rolloutMode: input.rolloutMode,
            createdBy: actorId,
         },
      });

      await tx.featureFlagAuditLog.create({
         data: {
            flagId: flag.id,
            actorId,
            action: "CREATED",
            newValue: {
               key: flag.key,
               name: flag.name,
               isEnabled: flag.isEnabled,
               rolloutMode: flag.rolloutMode,
            },
         },
      });

      return flag;
   });
}

/**
 * Updates a flag's name and description atomically with audit logging.
 */
export async function updateFeatureFlagTx(
   flagId: string,
   input: UpdateFeatureFlagInput,
   actorId: string
) {
   return prisma.$transaction(async (tx) => {
      const existing = await tx.featureFlag.findUniqueOrThrow({
         where: { id: flagId, isDeleted: false },
      });

      const updated = await tx.featureFlag.update({
         where: { id: flagId },
         data: {
            name: input.name,
            description: input.description,
         },
      });

      await tx.featureFlagAuditLog.create({
         data: {
            flagId,
            actorId,
            action: "UPDATED",
            oldValue: {
               name: existing.name,
               description: existing.description,
            },
            newValue: {
               name: updated.name,
               description: updated.description,
            },
         },
      });

      return updated;
   });
}

/**
 * Toggles the master switch (isEnabled) atomically with audit logging.
 */
export async function toggleMasterSwitchTx(
   flagId: string,
   isEnabled: boolean,
   actorId: string
) {
   return prisma.$transaction(async (tx) => {
      const existing = await tx.featureFlag.findUniqueOrThrow({
         where: { id: flagId, isDeleted: false },
      });

      const updated = await tx.featureFlag.update({
         where: { id: flagId },
         data: { isEnabled },
      });

      await tx.featureFlagAuditLog.create({
         data: {
            flagId,
            actorId,
            action: "TOGGLED_MASTER",
            oldValue: { isEnabled: existing.isEnabled },
            newValue: { isEnabled: updated.isEnabled },
         },
      });

      return updated;
   });
}

/**
 * Updates the rollout mode atomically with audit logging.
 */
export async function setRolloutModeTx(
   flagId: string,
   rolloutMode: RolloutModeType,
   actorId: string
) {
   return prisma.$transaction(async (tx) => {
      const existing = await tx.featureFlag.findUniqueOrThrow({
         where: { id: flagId, isDeleted: false },
      });

      const updated = await tx.featureFlag.update({
         where: { id: flagId },
         data: { rolloutMode },
      });

      await tx.featureFlagAuditLog.create({
         data: {
            flagId,
            actorId,
            action: "ROLLOUT_CHANGED",
            oldValue: { rolloutMode: existing.rolloutMode },
            newValue: { rolloutMode: updated.rolloutMode },
         },
      });

      return updated;
   });
}

/**
 * Assigns a tester to a targeted feature flag atomically with audit logging.
 */
export async function assignTesterTx(
   flagId: string,
   targetUserId: string,
   actorId: string
) {
   return prisma.$transaction(async (tx) => {
      await tx.featureFlag.findUniqueOrThrow({
         where: { id: flagId, isDeleted: false },
      });

      const target = await tx.featureFlagTarget.upsert({
         where: {
            flagId_userId: { flagId, userId: targetUserId },
         },
         update: {},
         create: {
            flagId,
            userId: targetUserId,
            createdBy: actorId,
         },
         include: {
            user: {
               select: {
                  id: true,
                  displayName: true,
                  username: true,
                  image: true,
               },
            },
         },
      });

      await tx.featureFlagAuditLog.create({
         data: {
            flagId,
            actorId,
            action: "TARGET_ADDED",
            newValue: {
               targetUserId,
               targetUsername: target.user.username,
               targetDisplayName: target.user.displayName,
            },
         },
      });

      return target;
   });
}

/**
 * Removes an assigned tester from a feature flag atomically with audit logging.
 */
export async function removeTesterTx(
   flagId: string,
   targetUserId: string,
   actorId: string
) {
   return prisma.$transaction(async (tx) => {
      const deleted = await tx.featureFlagTarget.delete({
         where: {
            flagId_userId: { flagId, userId: targetUserId },
         },
         include: {
            user: {
               select: {
                  id: true,
                  displayName: true,
                  username: true,
               },
            },
         },
      });

      await tx.featureFlagAuditLog.create({
         data: {
            flagId,
            actorId,
            action: "TARGET_REMOVED",
            oldValue: {
               targetUserId,
               targetUsername: deleted.user.username,
            },
         },
      });

      return deleted;
   });
}

/**
 * Soft deletes a feature flag and logs the action.
 */
export async function softDeleteFeatureFlagTx(flagId: string, actorId: string) {
   return prisma.$transaction(async (tx) => {
      const existing = await tx.featureFlag.findUniqueOrThrow({
         where: { id: flagId },
      });

      const deleted = await tx.featureFlag.update({
         where: { id: flagId },
         data: {
            isDeleted: true,
            deletedAt: new Date(),
            isEnabled: false,
         },
      });

      await tx.featureFlagAuditLog.create({
         data: {
            flagId,
            actorId,
            action: "SOFT_DELETED",
            oldValue: {
               key: existing.key,
               name: existing.name,
            },
         },
      });

      return deleted;
   });
}

/**
 * Fetches the audit trail for a flag ordered newest to oldest.
 */
export async function getFlagAuditTrail(flagId: string) {
   return prisma.featureFlagAuditLog.findMany({
      where: { flagId },
      orderBy: { createdAt: "desc" },
      include: {
         actor: {
            select: {
               id: true,
               displayName: true,
               username: true,
               image: true,
            },
         },
      },
   });
}

/**
 * Searches registered Discord users for assignment as testers.
 */
export async function searchAssignableDiscordUsers(query: string) {
   const trimmed = query.trim();
   if (!trimmed) {
      return prisma.user.findMany({
         take: 10,
         orderBy: { createdAt: "desc" },
         select: {
            id: true,
            name: true,
            username: true,
            displayName: true,
            image: true,
            discordId: true,
            role: true,
         },
      });
   }

   return prisma.user.findMany({
      where: {
         OR: [
            { displayName: { contains: trimmed, mode: "insensitive" } },
            { username: { contains: trimmed, mode: "insensitive" } },
            { discordId: { contains: trimmed } },
         ],
      },
      take: 10,
      orderBy: { displayName: "asc" },
      select: {
         id: true,
         name: true,
         username: true,
         displayName: true,
         image: true,
         discordId: true,
         role: true,
      },
   });
}
