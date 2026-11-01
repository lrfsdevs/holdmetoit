import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/core/auth";
import { hasAdminPrivileges } from "@/features/auth/domain/auth-roles";
import {
   getGlobalUserProfile,
   getChallengeSnapshotForUser,
} from "@/features/participant-stats/data/global-profile.repository";
import { canViewFullProfileHistory } from "@/features/participant-stats/domain/profile-privacy";
import { checkAreAcceptedFriends } from "@/features/participant-stats/data/profile-privacy.repository";
import { GlobalProfileView } from "@/features/participant-stats/presentation/global-profile-view";
import type { ParticipantStatsViewModel } from "@/features/participant-stats/domain/participant-stats.types";

export const dynamic = "force-dynamic";

interface UserProfilePageProps {
   params: {
      userId: string;
   };
   searchParams?: {
      challengeId?: string;
      tab?: string;
   };
}

/** Generates social and search metadata for public user profiles. */
export async function generateMetadata({
   params,
}: UserProfilePageProps): Promise<Metadata> {
   const profile = await getGlobalUserProfile(params.userId);

   if (!profile) {
      return {
         title: "Scholar Not Found | HoldMeToIt",
      };
   }

   const { user, careerStats } = profile;
   return {
      title: `${user.displayName} (@${user.username || "scholar"}) — Profile & Career Stats | HoldMeToIt`,
      description: `View ${user.displayName}'s HoldMeToIt study record: ${careerStats.lifetimeStudyHuman} lifetime study hours, ${careerStats.currentStreak}-day streak, ${careerStats.trophyRank} rank with ${careerStats.trophyTotal} trophies.`,
      openGraph: {
         title: `${user.displayName} | HoldMeToIt Scholar Profile`,
         description: `${careerStats.lifetimeStudyHuman} study hours · ${careerStats.totalChallengesEntered} challenges · ${careerStats.trophyRank} rank`,
         images: user.image ? [{ url: user.image }] : [],
      },
   };
}

/** Renders the Global User Profile and Career Statistics page. */
export default async function UserProfilePage({
   params,
   searchParams,
}: UserProfilePageProps) {
   const session = await auth();

   const targetUserId =
      params.userId === "me" && session?.user?.id
         ? session.user.id
         : params.userId;

   const profile = await getGlobalUserProfile(targetUserId);

   if (!profile) {
      notFound();
   }

   const isOwnProfile = Boolean(
      session?.user?.id && session.user.id === targetUserId
   );
   const isAcceptedFriend = await checkAreAcceptedFriends(
      session?.user?.id,
      targetUserId
   );

   const isAuthorizedHistory = canViewFullProfileHistory({
      viewerId: session?.user?.id,
      viewerRole: session?.user?.role,
      targetUserId,
      isAcceptedFriend,
   });

   let initialSnapshot: ParticipantStatsViewModel | null = null;
   let selectedChallengeId = searchParams?.challengeId;

   if (isAuthorizedHistory && profile.challengeHistory.length > 0) {
      const match = profile.challengeHistory.find(
         (c) => c.challengeId === selectedChallengeId
      );
      if (!match) {
         selectedChallengeId = profile.challengeHistory[0].challengeId;
      }

      if (selectedChallengeId) {
         initialSnapshot = await getChallengeSnapshotForUser(
            targetUserId,
            selectedChallengeId,
            {
               currentUserId: session?.user?.id,
               isAdmin: hasAdminPrivileges(session?.user?.role),
            }
         );
      }
   }

   return (
      <GlobalProfileView
         profile={profile}
         initialChallengeSnapshot={initialSnapshot}
         selectedChallengeId={selectedChallengeId}
         isAuthorizedHistory={isAuthorizedHistory}
         isOwnProfile={isOwnProfile}
         viewerRole={session?.user?.role}
         initialYptId={isOwnProfile ? profile.user.yptId : undefined}
      />
   );
}
