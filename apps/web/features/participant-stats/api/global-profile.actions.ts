"use server";

import { auth } from "@/core/auth";
import { hasAdminPrivileges } from "@/features/auth/domain/auth-roles";
import { canViewFullProfileHistory } from "../domain/profile-privacy";
import { checkAreAcceptedFriends } from "../data/profile-privacy.repository";
import { getChallengeSnapshotForUser } from "../data/global-profile.repository";
import type { ParticipantStatsViewModel } from "../domain/participant-stats.types";

export interface GetChallengeSnapshotActionResult {
   success: boolean;
   data?: ParticipantStatsViewModel;
   error?: "UNAUTHORIZED" | "NOT_FOUND" | "BAD_REQUEST" | "INTERNAL_ERROR";
   message?: string;
}

/**
 * Server action to fetch a challenge snapshot for a target user,
 * enforcing privacy boundaries: only self, friends (#145), and admins/hosts have full access.
 */
export async function getChallengeSnapshotAction(
   targetUserId: string,
   challengeId: string
): Promise<GetChallengeSnapshotActionResult> {
   if (!targetUserId?.trim() || !challengeId?.trim()) {
      return {
         success: false,
         error: "BAD_REQUEST",
         message: "Target user ID and challenge ID are required.",
      };
   }

   const session = await auth();
   const viewerId = session?.user?.id ?? null;
   const viewerRole = session?.user?.role ?? null;

   const isAcceptedFriend = await checkAreAcceptedFriends(
      viewerId,
      targetUserId.trim()
   );

   const hasAccess = canViewFullProfileHistory({
      viewerId,
      viewerRole,
      targetUserId: targetUserId.trim(),
      isAcceptedFriend,
   });

   if (!hasAccess) {
      return {
         success: false,
         error: "UNAUTHORIZED",
         message:
            "Full challenge history is only visible to friends and administrators.",
      };
   }

   const snapshot = await getChallengeSnapshotForUser(
      targetUserId.trim(),
      challengeId.trim(),
      {
         currentUserId: viewerId ?? undefined,
         isAdmin: hasAdminPrivileges(viewerRole),
      }
   );

   if (!snapshot) {
      return {
         success: false,
         error: "NOT_FOUND",
         message: "Challenge snapshot not found for this participant.",
      };
   }

   return {
      success: true,
      data: snapshot,
   };
}
