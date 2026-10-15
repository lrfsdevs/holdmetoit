import { cookies } from "next/headers";
import { auth } from "@/core/auth";
import { AppHeader } from "@/features/auth/presentation/auth-nav";
import {
   getEffectiveAdminState,
   PARTICIPANT_PREVIEW_COOKIE,
} from "@/features/auth/domain/preview-mode";
import { HomeCockpitView } from "@/features/study-logs/presentation/home-cockpit-view";
import { getParticipantCockpit } from "@/features/study-logs/data/cockpit-data";
import {
   findLatestAvailableChallenge,
   findLatestCompletedChallengeForWrapped,
} from "@/features/challenges/data/challenge.repository";
import { getChallengeScoreboard } from "@/features/leaderboard/data/leaderboard-data";
import { getUserCategorizedTasks } from "@/features/tasks/data/task.repository";

export const dynamic = "force-dynamic";

interface HomePageProps {
   searchParams?: {
      challenge?: string;
      as?: string;
      preview?: string;
      role?: string;
   };
}

/** Loads the participant cockpit and related dashboard content. */
export default async function HomePage({ searchParams }: HomePageProps) {
   const session = await auth();
   const cookieStore = await cookies();
   const previewCookie = cookieStore.get(PARTICIPANT_PREVIEW_COOKIE)?.value;

   const { isActualAdmin, isPreviewActive, isAdmin, effectiveRole } =
      getEffectiveAdminState({
         userRole: session?.user?.role,
         previewCookie,
         searchParamAs: searchParams?.as,
      });

   const userId = session?.user?.id;
   const [
      cockpit,
      fetchedUserTasks,
      fetchedUpcomingChallenge,
      eligibleWrapped,
   ] = await Promise.all([
      userId
         ? getParticipantCockpit(userId, searchParams?.challenge)
         : Promise.resolve(null),
      userId
         ? getUserCategorizedTasks(userId).catch(() => null)
         : Promise.resolve(null),
      userId
         ? findLatestAvailableChallenge().catch(() => null)
         : Promise.resolve(null),
      userId
         ? findLatestCompletedChallengeForWrapped(userId).catch(() => null)
         : Promise.resolve(null),
   ]);

   const userTasks = cockpit?.userTasks ?? fetchedUserTasks;
   const upcomingChallenge =
      userId && (!cockpit || cockpit.challengeStatus === "UPCOMING")
         ? fetchedUpcomingChallenge
         : null;

   let wrappedChallenge = null;
   if (eligibleWrapped && userId) {
      try {
         wrappedChallenge = await getChallengeScoreboard(
            eligibleWrapped.id,
            userId
         );
      } catch {
         wrappedChallenge = null;
      }
   }

   const displayName = session?.user?.displayName || session?.user?.name || "";

   const effectiveUser = session?.user
      ? { ...session.user, role: effectiveRole ?? session.user.role }
      : session?.user;

   const profileUrl =
      cockpit?.challengeId && cockpit?.participant?.id
         ? `/challenge/${cockpit.challengeId}/participant/${cockpit.participant.id}`
         : "/profile";

   return (
      <div className="min-h-screen bg-[#0d0d0d] text-[#f4f3f6]">
         <AppHeader
            user={session?.user}
            isActualAdmin={isActualAdmin}
            isPreviewActive={isPreviewActive}
            profileUrl={profileUrl}
         />
         <main className="w-full">
            <HomeCockpitView
               displayName={displayName}
               challengeId={
                  cockpit?.challengeId ??
                  upcomingChallenge?.id ??
                  "seed-honey-bees-vs-lavender-butterflies"
               }
               todayLoggedSeconds={cockpit?.todayLoggedSeconds ?? 0}
               todayLoggedClock={cockpit?.todayLoggedClock ?? "00:00:00"}
               user={effectiveUser}
               cockpit={cockpit}
               upcomingChallenge={upcomingChallenge}
               wrappedChallenge={wrappedChallenge}
               userTasks={userTasks}
               isAdmin={isAdmin}
               profileUrl={profileUrl}
            />
         </main>
      </div>
   );
}
