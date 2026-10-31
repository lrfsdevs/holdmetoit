import { cookies } from "next/headers";
import { auth } from "@/core/auth";
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
import { isFeatureEnabled } from "@/features/feature-flags/api/server";
import { WRAPPED_FEATURE_FLAG_KEY } from "@/features/wrapped/api/wrapped-flag";
import {
   COLLAPSED_CATEGORIES_COOKIE,
   ROLLOVER_SNOOZE_COOKIE,
} from "@/features/study-logs/presentation/cockpit/cockpit-tasks-storage";

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
   const userId = session?.user?.id;
   const scope = userId && userId.trim().length > 0 ? userId.trim() : "guest";
   const rawCollapsedCookie = cookieStore.get(
      COLLAPSED_CATEGORIES_COOKIE
   )?.value;
   let initialCollapsedCategoryIds: string[] = [];
   if (rawCollapsedCookie) {
      try {
         const parsed = JSON.parse(decodeURIComponent(rawCollapsedCookie));
         let list: unknown = [];
         if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            list = parsed[scope] || parsed["all"] || [];
         } else if (Array.isArray(parsed)) {
            list = parsed;
         }
         if (Array.isArray(list)) {
            initialCollapsedCategoryIds = list.filter(
               (k) =>
                  typeof k === "string" &&
                  (k.startsWith("daily:") || k.startsWith("weekly:"))
            );
         }
      } catch {
         initialCollapsedCategoryIds = [];
      }
   }

   const { isAdmin, effectiveRole } = getEffectiveAdminState({
      userRole: session?.user?.role,
      previewCookie,
      searchParamAs: searchParams?.as,
   });

   const [
      cockpit,
      fetchedUserTasks,
      fetchedUpcomingChallenge,
      eligibleWrapped,
      isWrappedEnabled,
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
      userId
         ? isFeatureEnabled(WRAPPED_FEATURE_FLAG_KEY)
         : Promise.resolve(false),
   ]);

   const userTasks = cockpit?.userTasks ?? fetchedUserTasks;
   const upcomingChallenge =
      userId && (!cockpit || cockpit.challengeStatus !== "ACTIVE")
         ? fetchedUpcomingChallenge
         : null;

   let wrappedChallenge = null;
   if (eligibleWrapped && userId && isWrappedEnabled) {
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

   const profileUrl = cockpit?.challengeId
      ? `/profile?challengeId=${cockpit.challengeId}`
      : "/profile";

   const rawSnoozeCookie = cookieStore.get(ROLLOVER_SNOOZE_COOKIE)?.value;
   let initialIsRolloverSnoozed = false;
   if (rawSnoozeCookie) {
      try {
         const parsed = JSON.parse(decodeURIComponent(rawSnoozeCookie));
         const todayDateKey =
            cockpit?.todayDate || new Date().toISOString().slice(0, 10);
         const utcDateKey = new Date().toISOString().slice(0, 10);
         const validDates = new Set([todayDateKey, utcDateKey]);
         if (cockpit?.todayDate) validDates.add(cockpit.todayDate);

         if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            if (parsed[scope] && validDates.has(parsed[scope])) {
               initialIsRolloverSnoozed = true;
            }
         } else if (
            scope === "guest" &&
            typeof parsed === "string" &&
            validDates.has(parsed)
         ) {
            initialIsRolloverSnoozed = true;
         }
      } catch {
         initialIsRolloverSnoozed = false;
      }
   }

   return (
      <div className="min-h-[calc(100vh-4rem)] bg-surface-page text-text-primary">
         <main className="w-full">
            <HomeCockpitView
               displayName={displayName}
               challengeId={cockpit?.challengeId ?? upcomingChallenge?.id ?? ""}
               todayLoggedSeconds={cockpit?.todayLoggedSeconds ?? 0}
               todayLoggedClock={cockpit?.todayLoggedClock ?? "00:00:00"}
               user={effectiveUser}
               cockpit={cockpit}
               upcomingChallenge={upcomingChallenge}
               wrappedChallenge={wrappedChallenge}
               userTasks={userTasks}
               isAdmin={isAdmin}
               profileUrl={profileUrl}
               initialCollapsedCategoryIds={initialCollapsedCategoryIds}
               initialIsRolloverSnoozed={initialIsRolloverSnoozed}
            />
         </main>
      </div>
   );
}
