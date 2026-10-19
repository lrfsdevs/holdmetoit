import { prisma } from "@/core/db";
import { YptConnectionStatus } from "@prisma/client";

export interface YptConnectionSummary {
   id?: string;
   userId: string;
   yptUserId: string;
   yptNickname: string | null;
   status: YptConnectionStatus;
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

function deriveStatus({
   connectionStatus,
   claimStatus,
   hasYptId,
}: {
   connectionStatus: YptConnectionStatus | null;
   claimStatus: string | null;
   hasYptId: boolean;
}): YptConnectionStatus {
   if (claimStatus === "VERIFIED" || hasYptId) {
      return YptConnectionStatus.VERIFIED;
   }
   if (claimStatus === "PENDING") {
      return YptConnectionStatus.PENDING_VERIFICATION;
   }
   if (claimStatus === "REJECTED") {
      return YptConnectionStatus.REJECTED;
   }
   return connectionStatus ?? YptConnectionStatus.NOT_CONNECTED;
}

/**
 * Retrieves the YPT link status for a user, derived from their latest claim
 * and verified yptId. All syncing runs through the shared service account,
 * so no per-user session is stored.
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

   return {
      id: conn?.id,
      userId: user.id,
      yptUserId: conn?.yptUserId || user.yptId || "",
      yptNickname: conn?.yptNickname || activeClaim?.yptName || null,
      status: deriveStatus({
         connectionStatus: conn?.status ?? null,
         claimStatus: activeClaim?.status ?? null,
         hasYptId: Boolean(user.yptId),
      }),
      lastSyncedAt: conn?.lastSyncedAt ?? null,
      lastSyncError: conn?.lastSyncError ?? null,
      activeClaim,
   };
}

/**
 * Updates the connection status (e.g. SYNC_ERROR, VERIFIED) and sync metadata.
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
