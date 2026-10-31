import {
   hasAdminPrivileges,
   type UserRoleType,
} from "@/features/auth/domain/auth-roles";

export interface ProfilePrivacyParams {
   viewerId?: string | null;
   viewerRole?: UserRoleType | string | null;
   targetUserId: string;
   isAcceptedFriend?: boolean;
}

/**
 * Determines whether a viewer has permission to view a target user's full challenge history.
 *
 * Full history access is allowed if:
 * 1. Viewer is the target user themselves (Self: viewerId === targetUserId)
 * 2. Viewer has administrative or host authority (ADMIN, DEV, or HOST)
 * 3. Viewer and target user are accepted mutual friends (#145)
 */
export function canViewFullProfileHistory({
   viewerId,
   viewerRole,
   targetUserId,
   isAcceptedFriend = false,
}: ProfilePrivacyParams): boolean {
   if (!targetUserId || targetUserId.trim().length === 0) {
      return false;
   }

   // 1. Self check: Users can always view their own full challenge history
   if (viewerId && viewerId === targetUserId) {
      return true;
   }

   // 2. Admin / Host check: Platform admins, developers, and hosts can view all histories
   if (hasAdminPrivileges(viewerRole) || viewerRole === "HOST") {
      return true;
   }

   // 3. Accepted friend check: Mutual friends can view detailed history (#145)
   if (isAcceptedFriend) {
      return true;
   }

   // 4. Default: Spectators and non-friends are denied detailed challenge performance
   return false;
}
