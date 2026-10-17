import { prisma } from "@/core/db";
import { YptConnectionStatus, Prisma } from "@prisma/client";
import {
   encryptSensitiveToken,
   decryptSensitiveToken,
} from "@/core/security/encryption";
import {
   restoreYptClientSession,
   getYptJoinedGroups,
   getYptGroupMembers,
   getYptAllJoinedMembers,
} from "./ypt-client.service";
import { recordAuditEvent } from "@/features/audit/data/audit-log.repository";
import { createLogger, logEvents } from "@/core/observability/logger";

const logger = createLogger("ypt.connection-repo");

export interface YptConnectionSummary {
   id?: string;
   userId: string;
   yptUserId: string;
   yptNickname: string | null;
   status: YptConnectionStatus;
   hasSavedSession: boolean;
   lastSyncedAt: Date | null;
   lastSyncError: string | null;
   activeClaim?: {
      id: string;
      status: string;
      yptId: string;
      yptName: string | null;
      groupId: string | null;
      rejectionReason: string | null;
   } | null;
}

export interface YptRealGroupMemberItem {
   yptUserId: string;
   nickname: string;
   todayStudySeconds: number;
   liveStudySeconds: number;
   isStudying: boolean;
   currentSubject: string | null;
   avatarUrl: string | null;
   groupIds: (string | number)[];
   isSelf: boolean;
   claimStatus: "AVAILABLE" | "VERIFIED" | "PENDING" | "LINKED";
}

/**
 * Retrieves the full YPT connection and claim status for a user.
 */
export async function getUserYptConnection(
   userId: string
): Promise<YptConnectionSummary | null> {
   const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
         id: true,
         yptId: true,
         yptConnection: true,
         yptClaims: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
               id: true,
               status: true,
               yptId: true,
               yptName: true,
               groupId: true,
               rejectionReason: true,
            },
         },
      },
   });

   if (!user) return null;

   const conn = user.yptConnection;
   const activeClaim = user.yptClaims[0] || null;

   // If the user has a verified yptId but no connection record, synthesize an initial summary
   if (!conn && user.yptId) {
      return {
         userId: user.id,
         yptUserId: user.yptId,
         yptNickname: activeClaim?.yptName || null,
         status:
            activeClaim?.status === "VERIFIED"
               ? YptConnectionStatus.VERIFIED
               : YptConnectionStatus.CONNECTED,
         hasSavedSession: false,
         lastSyncedAt: null,
         lastSyncError: null,
         activeClaim,
      };
   }

   if (!conn) {
      return {
         userId: user.id,
         yptUserId: "",
         yptNickname: null,
         status: YptConnectionStatus.NOT_CONNECTED,
         hasSavedSession: false,
         lastSyncedAt: null,
         lastSyncError: null,
         activeClaim,
      };
   }

   return {
      id: conn.id,
      userId: conn.userId,
      yptUserId: conn.yptUserId,
      yptNickname: conn.yptNickname,
      status: conn.status,
      hasSavedSession: Boolean(conn.encryptedRefreshToken),
      lastSyncedAt: conn.lastSyncedAt,
      lastSyncError: conn.lastSyncError,
      activeClaim,
   };
}

/**
 * Saves/upserts an authenticated YPT connection with encrypted refresh token.
 */
export async function saveAuthenticatedYptConnection({
   userId,
   yptUserId,
   yptNickname,
   refreshToken,
   status = YptConnectionStatus.CONNECTED,
}: {
   userId: string;
   yptUserId: string;
   yptNickname?: string;
   refreshToken?: string;
   status?: YptConnectionStatus;
}) {
   const encryptedRefreshToken = refreshToken
      ? encryptSensitiveToken(refreshToken)
      : null;

   const [existing, user] = await Promise.all([
      prisma.yptConnection.findUnique({
         where: { userId },
         select: { status: true, yptUserId: true },
      }),
      prisma.user.findUnique({
         where: { id: userId },
         select: { yptId: true },
      }),
   ]);

   const wasVerified =
      (existing?.status === YptConnectionStatus.VERIFIED &&
         existing?.yptUserId === yptUserId) ||
      user?.yptId === yptUserId;

   const effectiveStatus = wasVerified ? YptConnectionStatus.VERIFIED : status;

   return prisma.yptConnection.upsert({
      where: { userId },
      create: {
         userId,
         yptUserId,
         yptNickname: yptNickname || null,
         status: effectiveStatus,
         encryptedRefreshToken,
      },
      update: {
         yptUserId,
         yptNickname: yptNickname || null,
         status: effectiveStatus,
         encryptedRefreshToken: encryptedRefreshToken || undefined,
         lastSyncError: null,
      },
   });
}

/**
 * Updates the connection status (e.g. SYNC_ERROR, REAUTHENTICATION_REQUIRED, VERIFIED).
 */
export async function updateYptConnectionStatus({
   userId,
   status,
   errorMessage,
   lastSyncedAt,
}: {
   userId: string;
   status: YptConnectionStatus;
   errorMessage?: string | null;
   lastSyncedAt?: Date;
}) {
   return prisma.yptConnection.updateMany({
      where: { userId },
      data: {
         status,
         lastSyncError: errorMessage !== undefined ? errorMessage : undefined,
         lastSyncedAt: lastSyncedAt || undefined,
      },
   });
}

/**
 * Disconnects the user's YPT connection, wiping saved session credentials.
 */
export async function disconnectYptConnection(userId: string) {
   return prisma.yptConnection.updateMany({
      where: { userId },
      data: {
         encryptedRefreshToken: null,
         status: YptConnectionStatus.NOT_CONNECTED,
         lastSyncError: null,
      },
   });
}

/**
 * Discovers real YPT group members from the user's connected YPT account.
 */
export async function fetchRealYptGroupMembers(
   userId: string
): Promise<YptRealGroupMemberItem[]> {
   const conn = await prisma.yptConnection.findUnique({
      where: { userId },
   });

   if (!conn?.encryptedRefreshToken) {
      return [];
   }

   let refreshToken: string;
   try {
      refreshToken = decryptSensitiveToken(conn.encryptedRefreshToken);
   } catch {
      await updateYptConnectionStatus({
         userId,
         status: YptConnectionStatus.REAUTHENTICATION_REQUIRED,
         errorMessage: "Saved session token corrupted or expired.",
      });
      return [];
   }

   const client = await restoreYptClientSession(refreshToken);
   const unifiedMembers = await getYptAllJoinedMembers(client);

   // Find verified and pending claims in DB to label already-linked members
   const activeClaims = await prisma.yptIdentityClaim.findMany({
      where: {
         status: { in: ["VERIFIED", "PENDING"] },
      },
      select: { yptId: true, userId: true, status: true },
   });

   const claimsMap = new Map<string, { userId: string; status: string }>();
   for (const c of activeClaims) {
      claimsMap.set(c.yptId, { userId: c.userId, status: c.status });
   }

   return unifiedMembers.map((m) => {
      const yptIdStr = String(m.userId);
      const isSelf = yptIdStr === conn.yptUserId;
      const claim = claimsMap.get(yptIdStr);

      let claimStatus: "AVAILABLE" | "VERIFIED" | "PENDING" | "LINKED" =
         "AVAILABLE";
      if (claim) {
         if (claim.userId === userId) {
            claimStatus = claim.status === "VERIFIED" ? "VERIFIED" : "PENDING";
         } else {
            claimStatus = "LINKED";
         }
      }

      return {
         yptUserId: yptIdStr,
         nickname: m.nickname,
         todayStudySeconds: Math.max(0, Math.floor(m.todayStudyMs / 1000)),
         liveStudySeconds: Math.max(0, Math.floor(m.liveStudyMs / 1000)),
         isStudying: m.isStudying,
         currentSubject: m.currentSubject,
         avatarUrl: m.avatarUrl || null,
         groupIds: m.groupIds,
         isSelf,
         claimStatus,
      };
   });
}

/**
 * Submits an identity claim for a selected YPT member identity.
 */
export async function submitYptMemberClaim({
   userId,
   yptUserId,
   yptNickname,
   groupId,
}: {
   userId: string;
   yptUserId: string;
   yptNickname?: string;
   groupId?: string;
}) {
   // 1. Check if another user is already verified with this YPT ID
   const existingVerified = await prisma.yptIdentityClaim.findFirst({
      where: {
         yptId: yptUserId,
         status: "VERIFIED",
         userId: { not: userId },
      },
   });

   if (existingVerified) {
      throw new Error(
         "This Yeolpumta ID is already linked and verified by another user."
      );
   }

   // 2. Mark previous pending claims by this user as REJECTED or superseded
   await prisma.yptIdentityClaim.updateMany({
      where: {
         userId,
         status: "PENDING",
      },
      data: {
         status: "REJECTED",
         rejectionReason: "Superseded by new identity verification request.",
      },
   });

   // 3. Create new PENDING claim
   const claim = await prisma.yptIdentityClaim.create({
      data: {
         userId,
         yptId: yptUserId,
         yptName: yptNickname || null,
         groupId: groupId || null,
         status: "PENDING",
      },
   });

   // 4. Update connection status to PENDING_VERIFICATION
   await prisma.yptConnection.upsert({
      where: { userId },
      create: {
         userId,
         yptUserId,
         yptNickname: yptNickname || null,
         status: YptConnectionStatus.PENDING_VERIFICATION,
      },
      update: {
         yptUserId,
         yptNickname: yptNickname || null,
         status: YptConnectionStatus.PENDING_VERIFICATION,
         lastSyncError: null,
      },
   });

   return claim;
}

/**
 * Administrator approval of a YPT identity claim.
 */
export async function adminApproveClaim({
   claimId,
   adminUserId,
}: {
   claimId: string;
   adminUserId: string;
}) {
   const claim = await prisma.yptIdentityClaim.findUnique({
      where: { id: claimId },
   });

   if (!claim) {
      throw new Error("Verification claim not found.");
   }

   if (claim.status !== "PENDING") {
      throw new Error(`Cannot approve claim with status '${claim.status}'.`);
   }

   // Check conflict
   const conflict = await prisma.user.findFirst({
      where: {
         yptId: claim.yptId,
         id: { not: claim.userId },
      },
   });
   if (conflict) {
      throw new Error(
         `Yeolpumta ID ${claim.yptId} is already bound to user ${conflict.id}.`
      );
   }

   return prisma.$transaction(async (tx) => {
      // 1. Mark claim VERIFIED
      const updatedClaim = await tx.yptIdentityClaim.update({
         where: { id: claimId },
         data: {
            status: "VERIFIED",
            reviewedById: adminUserId,
            reviewedAt: new Date(),
         },
      });

      // 2. Bind YPT ID to User model
      await tx.user.update({
         where: { id: claim.userId },
         data: {
            yptId: claim.yptId,
         },
      });

      // 3. Update YptConnection to VERIFIED
      await tx.yptConnection.upsert({
         where: { userId: claim.userId },
         create: {
            userId: claim.userId,
            yptUserId: claim.yptId,
            yptNickname: claim.yptName,
            status: YptConnectionStatus.VERIFIED,
         },
         update: {
            yptUserId: claim.yptId,
            yptNickname: claim.yptName,
            status: YptConnectionStatus.VERIFIED,
            lastSyncError: null,
         },
      });

      // 4. Audit Log
      await recordAuditEvent({
         actionType: "YPT_CLAIM_APPROVED",
         actorId: adminUserId,
         actorUsername: "Admin",
         targetEntityId: claim.userId,
         targetEntityType: "YPT_CLAIM",
         targetEntityName: claim.yptName || claim.yptId,
         previousValue: { status: claim.status, yptId: claim.yptId },
         newValue: { status: "VERIFIED", yptId: claim.yptId },
         auditReason: "Admin confirmed and approved YPT identity",
      });

      return updatedClaim;
   });
}

/**
 * Administrator rejection of a YPT identity claim.
 */
export async function adminRejectClaim({
   claimId,
   adminUserId,
   rejectionReason,
}: {
   claimId: string;
   adminUserId: string;
   rejectionReason: string;
}) {
   const claim = await prisma.yptIdentityClaim.findUnique({
      where: { id: claimId },
   });

   if (!claim) {
      throw new Error("Verification claim not found.");
   }

   return prisma.$transaction(async (tx) => {
      const updatedClaim = await tx.yptIdentityClaim.update({
         where: { id: claimId },
         data: {
            status: "REJECTED",
            reviewedById: adminUserId,
            reviewedAt: new Date(),
            rejectionReason: rejectionReason.trim(),
         },
      });

      await tx.yptConnection.updateMany({
         where: { userId: claim.userId },
         data: {
            status: YptConnectionStatus.REJECTED,
            lastSyncError: rejectionReason.trim(),
         },
      });

      await recordAuditEvent({
         actionType: "YPT_CLAIM_REJECTED",
         actorId: adminUserId,
         actorUsername: "Admin",
         targetEntityId: claim.userId,
         targetEntityType: "YPT_CLAIM",
         targetEntityName: claim.yptName || claim.yptId,
         previousValue: { status: claim.status },
         newValue: { status: "REJECTED", reason: rejectionReason },
         auditReason: rejectionReason,
      });

      return updatedClaim;
   });
}
