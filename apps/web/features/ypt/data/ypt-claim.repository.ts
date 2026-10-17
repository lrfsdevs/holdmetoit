import { prisma } from "@/core/db";
import { Prisma } from "@prisma/client";
import {
   assertValidClaimTransition,
   YptClaimStatus,
} from "../domain/ypt-claim-state-machine";
import { recordAuditEvent } from "@/features/audit/data/audit-log.repository";

export interface EligibleYptMember {
   id: string;
   displayName: string;
   username: string;
   image: string | null;
   yptId: string | null;
   status: "AVAILABLE" | "VERIFIED" | "PENDING" | "LINKED";
   isSelf: boolean;
}

export interface GetEligibleMembersOptions {
   currentUserId: string;
   search?: string;
   limit?: number;
}

export async function getEligibleYptMembers({
   currentUserId,
   search,
   limit = 100,
}: GetEligibleMembersOptions): Promise<EligibleYptMember[]> {
   const searchFilter = search?.trim()
      ? {
           OR: [
              {
                 displayName: {
                    contains: search.trim(),
                    mode: "insensitive" as Prisma.QueryMode,
                 },
              },
              {
                 username: {
                    contains: search.trim(),
                    mode: "insensitive" as Prisma.QueryMode,
                 },
              },
              {
                 name: {
                    contains: search.trim(),
                    mode: "insensitive" as Prisma.QueryMode,
                 },
              },
              {
                 yptId: {
                    contains: search.trim(),
                    mode: "insensitive" as Prisma.QueryMode,
                 },
              },
           ],
        }
      : {};

   const users = await prisma.user.findMany({
      where: searchFilter,
      select: {
         id: true,
         displayName: true,
         username: true,
         name: true,
         image: true,
         yptId: true,
         yptClaims: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
               id: true,
               status: true,
               yptId: true,
            },
         },
      },
      orderBy: [{ displayName: "asc" }, { username: "asc" }],
      take: limit,
   });

   // Find all currently verified YPT IDs across all users
   const verifiedClaims = await prisma.yptIdentityClaim.findMany({
      where: { status: "VERIFIED" },
      select: { yptId: true, userId: true },
   });

   const verifiedYptMap = new Map<string, string>();
   for (const vc of verifiedClaims) {
      verifiedYptMap.set(vc.yptId, vc.userId);
   }

   return users.map((u) => {
      const isSelf = u.id === currentUserId;
      const latestClaim = u.yptClaims[0];
      const verifiedOwner = u.yptId ? verifiedYptMap.get(u.yptId) : null;

      let status: "AVAILABLE" | "VERIFIED" | "PENDING" | "LINKED" = "AVAILABLE";

      if (verifiedOwner && verifiedOwner !== currentUserId) {
         status = "LINKED";
      } else if (latestClaim?.status === "VERIFIED" || u.yptId) {
         status = isSelf ? "VERIFIED" : "LINKED";
      } else if (latestClaim?.status === "PENDING") {
         status = "PENDING";
      }

      const display =
         u.displayName || u.name || u.username || "Community Member";

      return {
         id: u.id,
         displayName: display,
         username: u.username || "user",
         image: u.image,
         yptId: u.yptId,
         status,
         isSelf,
      };
   });
}

export async function getUserActiveClaim(userId: string) {
   return prisma.yptIdentityClaim.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
         reviewedBy: {
            select: {
               id: true,
               displayName: true,
               username: true,
            },
         },
      },
   });
}

export async function findVerifiedClaimByYptId(yptId: string) {
   return prisma.yptIdentityClaim.findFirst({
      where: {
         yptId,
         status: "VERIFIED",
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
}

export interface SubmitYptClaimInput {
   userId: string;
   yptId: string;
   yptName?: string;
   selectedUserId?: string;
   actor: { id: string; username: string };
}

export async function submitYptClaim({
   userId,
   yptId,
   yptName,
   selectedUserId,
   actor,
}: SubmitYptClaimInput) {
   const normalizedYptId = yptId.trim();

   // 1. Protection Rule: One YPT identity -> One HoldMeToIt user
   // Check if this YPT ID is already VERIFIED by another user
   const existingVerified = await findVerifiedClaimByYptId(normalizedYptId);
   if (existingVerified && existingVerified.userId !== userId) {
      throw new Error(
         "This YPT identity is already linked to another verified participant."
      );
   }

   const userWithYpt = await prisma.user.findFirst({
      where: {
         yptId: normalizedYptId,
         id: { not: userId },
      },
   });

   if (userWithYpt) {
      throw new Error(
         "This YPT identity is already linked to another verified participant."
      );
   }

   // 2. Fetch existing latest claim
   const latestClaim = await prisma.yptIdentityClaim.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
   });

   let claim;
   if (latestClaim && latestClaim.status === "PENDING") {
      claim = await prisma.yptIdentityClaim.update({
         where: { id: latestClaim.id },
         data: {
            yptId: normalizedYptId,
            yptName: yptName?.trim() || null,
            selectedUserId: selectedUserId || null,
            rejectionReason: null,
            reviewedById: null,
            reviewedAt: null,
         },
      });
   } else {
      claim = await prisma.yptIdentityClaim.create({
         data: {
            userId,
            yptId: normalizedYptId,
            yptName: yptName?.trim() || null,
            selectedUserId: selectedUserId || null,
            status: "PENDING",
         },
      });
   }

   // 3. Record Audit Event
   await recordAuditEvent({
      actorId: actor.id,
      actorUsername: actor.username,
      actionType: "YPT_CLAIM_CREATED",
      targetEntityId: claim.id,
      targetEntityType: "YPT_CLAIM",
      targetEntityName: yptName || normalizedYptId,
      previousValue: latestClaim ? { status: latestClaim.status } : null,
      newValue: {
         claimId: claim.id,
         status: "PENDING",
         yptId: normalizedYptId,
         yptName,
      },
      auditReason: "Participant submitted YPT identity verification claim",
   });

   return claim;
}

export interface ReviewYptClaimInput {
   claimId: string;
   admin: { id: string; username: string };
   reason?: string;
}

export async function adminApproveYptClaim({
   claimId,
   admin,
   reason,
}: ReviewYptClaimInput) {
   return prisma.$transaction(async (tx) => {
      const claim = await tx.yptIdentityClaim.findUnique({
         where: { id: claimId },
      });

      if (!claim) {
         throw new Error("YPT claim not found.");
      }

      assertValidClaimTransition(claim.status as YptClaimStatus, "VERIFIED");

      // Verify uniqueness constraint in transaction
      const existingUser = await tx.user.findFirst({
         where: {
            yptId: claim.yptId,
            id: { not: claim.userId },
         },
      });

      if (existingUser) {
         throw new Error(
            "This YPT identity is already linked to another verified participant."
         );
      }

      const existingVerifiedClaim = await tx.yptIdentityClaim.findFirst({
         where: {
            yptId: claim.yptId,
            status: "VERIFIED",
            userId: { not: claim.userId },
         },
      });

      if (existingVerifiedClaim) {
         throw new Error(
            "This YPT identity is already linked to another verified participant."
         );
      }

      // Transition claim
      const updatedClaim = await tx.yptIdentityClaim.update({
         where: { id: claimId },
         data: {
            status: "VERIFIED",
            reviewedById: admin.id,
            reviewedAt: new Date(),
            rejectionReason: null,
         },
      });

      // Update User record with authoritative verified YPT ID
      await tx.user.update({
         where: { id: claim.userId },
         data: { yptId: claim.yptId },
      });

      // Synchronize YptConnection status
      await tx.yptConnection.upsert({
         where: { userId: claim.userId },
         create: {
            userId: claim.userId,
            yptUserId: claim.yptId,
            yptNickname: claim.yptName,
            status: "VERIFIED",
         },
         update: {
            yptUserId: claim.yptId,
            yptNickname: claim.yptName,
            status: "VERIFIED",
            lastSyncError: null,
         },
      });

      await recordAuditEvent({
         actorId: admin.id,
         actorUsername: admin.username,
         actionType: "YPT_CLAIM_APPROVED",
         targetEntityId: claim.id,
         targetEntityType: "YPT_CLAIM",
         targetEntityName: claim.yptName || claim.yptId,
         previousValue: { status: claim.status, yptId: claim.yptId },
         newValue: { status: "VERIFIED", yptId: claim.yptId },
         auditReason: reason || "Admin confirmed and approved YPT identity",
      });

      return updatedClaim;
   });
}

export async function adminRejectYptClaim({
   claimId,
   admin,
   reason = "Rejected by administrator",
}: ReviewYptClaimInput) {
   return prisma.$transaction(async (tx) => {
      const claim = await tx.yptIdentityClaim.findUnique({
         where: { id: claimId },
      });

      if (!claim) {
         throw new Error("YPT claim not found.");
      }

      assertValidClaimTransition(claim.status as YptClaimStatus, "REJECTED");

      const updatedClaim = await tx.yptIdentityClaim.update({
         where: { id: claimId },
         data: {
            status: "REJECTED",
            rejectionReason: reason,
            reviewedById: admin.id,
            reviewedAt: new Date(),
         },
      });

      // Synchronize YptConnection status
      await tx.yptConnection.updateMany({
         where: { userId: claim.userId },
         data: {
            status: "REJECTED",
            lastSyncError: reason,
         },
      });

      await recordAuditEvent({
         actorId: admin.id,
         actorUsername: admin.username,
         actionType: "YPT_CLAIM_REJECTED",
         targetEntityId: claim.id,
         targetEntityType: "YPT_CLAIM",
         targetEntityName: claim.yptName || claim.yptId,
         previousValue: { status: claim.status },
         newValue: { status: "REJECTED", reason },
         auditReason: reason,
      });

      return updatedClaim;
   });
}

export async function adminRevokeYptClaim({
   claimId,
   admin,
   reason = "Revoked by administrator",
}: ReviewYptClaimInput) {
   return prisma.$transaction(async (tx) => {
      const claim = await tx.yptIdentityClaim.findUnique({
         where: { id: claimId },
      });

      if (!claim) {
         throw new Error("YPT claim not found.");
      }

      assertValidClaimTransition(claim.status as YptClaimStatus, "REVOKED");

      const updatedClaim = await tx.yptIdentityClaim.update({
         where: { id: claimId },
         data: {
            status: "REVOKED",
            rejectionReason: reason,
            reviewedById: admin.id,
            reviewedAt: new Date(),
         },
      });

      // Clear yptId on User
      await tx.user.update({
         where: { id: claim.userId },
         data: { yptId: null },
      });

      // Synchronize YptConnection status
      await tx.yptConnection.updateMany({
         where: { userId: claim.userId },
         data: {
            status: "NOT_CONNECTED",
            encryptedRefreshToken: null,
         },
      });

      await recordAuditEvent({
         actorId: admin.id,
         actorUsername: admin.username,
         actionType: "YPT_ID_UNLINKED",
         targetEntityId: claim.id,
         targetEntityType: "YPT_CLAIM",
         targetEntityName: claim.yptName || claim.yptId,
         previousValue: { status: claim.status, yptId: claim.yptId },
         newValue: { status: "REVOKED", yptId: null },
         auditReason: reason,
      });

      return updatedClaim;
   });
}

export interface GetAdminClaimsOptions {
   status?: YptClaimStatus;
   page?: number;
   limit?: number;
}

export async function getAdminClaimsList({
   status,
   page = 1,
   limit = 20,
}: GetAdminClaimsOptions = {}) {
   const skip = (page - 1) * limit;
   const where: Prisma.YptIdentityClaimWhereInput = status ? { status } : {};

   const [claims, totalCount, pendingCount, verifiedCount, rejectedCount] =
      await Promise.all([
         prisma.yptIdentityClaim.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
            include: {
               user: {
                  select: {
                     id: true,
                     displayName: true,
                     username: true,
                     name: true,
                     image: true,
                     discordId: true,
                  },
               },
               reviewedBy: {
                  select: {
                     id: true,
                     displayName: true,
                     username: true,
                  },
               },
            },
         }),
         prisma.yptIdentityClaim.count({ where }),
         prisma.yptIdentityClaim.count({ where: { status: "PENDING" } }),
         prisma.yptIdentityClaim.count({ where: { status: "VERIFIED" } }),
         prisma.yptIdentityClaim.count({ where: { status: "REJECTED" } }),
      ]);

   // Augment claims with attempt counts and already-linked check
   const augmented = await Promise.all(
      claims.map(async (c) => {
         const attemptsCount = await prisma.yptIdentityClaim.count({
            where: { userId: c.userId },
         });

         const alreadyLinkedToAnother = Boolean(
            await prisma.user.findFirst({
               where: {
                  yptId: c.yptId,
                  id: { not: c.userId },
               },
            })
         );

         return {
            ...c,
            attemptsCount,
            alreadyLinkedToAnother,
         };
      })
   );

   return {
      claims: augmented,
      pagination: {
         page,
         limit,
         totalCount,
         totalPages: Math.ceil(totalCount / limit) || 1,
      },
      counts: {
         pending: pendingCount,
         verified: verifiedCount,
         rejected: rejectedCount,
      },
   };
}
