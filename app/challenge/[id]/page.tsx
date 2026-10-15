import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { ErrorState } from "@/components/state/error-state";
import { auth } from "@/core/auth";
import {
   getEffectiveAdminState,
   PARTICIPANT_PREVIEW_COOKIE,
} from "@/features/auth/domain/preview-mode";
import { getChallengeScoreboard } from "@/features/leaderboard/data/leaderboard-data";
import { ChallengeView } from "@/features/challenges/presentation/challenge-view";
import {
   ChallengeTab,
   resolveAllowedChallengeTab,
} from "@/features/challenges/domain/challenge-tabs";
import { resolveLeaderboardViewMode } from "@/features/leaderboard/domain/leaderboard";
import { logError, logEvents } from "@/core/observability/logger";

interface ChallengePageProps {
   params: {
      id: string;
   };
   searchParams?: {
      tab?: string;
      as?: string;
      view?: string;
   };
}

/** Loads a challenge scoreboard and resolves its initial tab and view mode. */
export default async function ChallengePage({
   params,
   searchParams,
}: ChallengePageProps) {
   const session = await auth();
   const cookieStore = await cookies();
   const previewCookie = cookieStore.get(PARTICIPANT_PREVIEW_COOKIE)?.value;

   const { isAdmin } = getEffectiveAdminState({
      userRole: session?.user?.role,
      previewCookie,
      searchParamAs: searchParams?.as,
   });

   let challenge: Awaited<ReturnType<typeof getChallengeScoreboard>> = null;
   try {
      challenge = await getChallengeScoreboard(params.id, session?.user?.id);
   } catch (error) {
      logError(logEvents.appError, {
         scope: "challenge.page",
         context: { challengeId: params.id },
         error,
      });
      return (
         <ErrorState
            title="Could not load scoreboard"
            message="Something went wrong while fetching the live standings. Please refresh the page."
         />
      );
   }

   if (!challenge || challenge.isDeleted) {
      notFound();
   }

   const initialTab: ChallengeTab = resolveAllowedChallengeTab(
      searchParams?.tab,
      isAdmin,
      { isSummaryVisible: Boolean(challenge.resultsLockedAt) }
   );
   const initialLeaderboardViewMode = resolveLeaderboardViewMode(
      searchParams?.view
   );

   return (
      <ChallengeView
         challenge={challenge}
         initialTab={initialTab}
         isAdmin={isAdmin}
         initialLeaderboardViewMode={initialLeaderboardViewMode}
      />
   );
}
