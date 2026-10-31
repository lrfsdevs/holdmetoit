import { redirect } from "next/navigation";
import { auth } from "@/core/auth";
import { hasAdminPrivileges } from "@/features/auth/domain/auth-roles";
import {
   getGlobalUserProfile,
   getChallengeSnapshotForUser,
} from "@/features/participant-stats/data/global-profile.repository";
import { GlobalProfileView } from "@/features/participant-stats/presentation/global-profile-view";
import type { ParticipantStatsViewModel } from "@/features/participant-stats/domain/participant-stats.types";

export const dynamic = "force-dynamic";

interface ProfilePageProps {
   searchParams?: {
      challengeId?: string;
      tab?: string;
   };
}

/** Renders the current authenticated session user's global profile view. */
export default async function ProfilePage({ searchParams }: ProfilePageProps) {
   const session = await auth();

   if (!session?.user?.id) {
      redirect("/");
      return;
   }

   const profile = await getGlobalUserProfile(session.user.id);
   if (!profile) {
      redirect("/");
      return;
   }

   let initialSnapshot: ParticipantStatsViewModel | null = null;
   let selectedChallengeId = searchParams?.challengeId;

   if (profile.challengeHistory.length > 0) {
      const match = profile.challengeHistory.find(
         (c) => c.challengeId === selectedChallengeId
      );
      if (!match) {
         selectedChallengeId = profile.challengeHistory[0].challengeId;
      }

      if (selectedChallengeId) {
         initialSnapshot = await getChallengeSnapshotForUser(
            session.user.id,
            selectedChallengeId,
            {
               currentUserId: session.user.id,
               isAdmin: hasAdminPrivileges(session.user.role),
            }
         );
      }
   }

   return (
      <GlobalProfileView
         profile={profile}
         initialChallengeSnapshot={initialSnapshot}
         selectedChallengeId={selectedChallengeId}
         isAuthorizedHistory={true}
         isOwnProfile={true}
         viewerRole={session.user.role}
         initialYptId={profile.user.yptId}
      />
   );
}
