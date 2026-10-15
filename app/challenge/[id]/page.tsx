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
import { isFeatureEnabled } from "@/features/feature-flags/api/server";
import { WRAPPED_FEATURE_FLAG_KEY } from "@/features/wrapped/api/wrapped-flag";

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

   const isWrappedEnabled = await isFeatureEnabled(WRAPPED_FEATURE_FLAG_KEY);

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

   const isSummaryVisible =
      Boolean(challenge.resultsLockedAt) && isWrappedEnabled;

   const initialTab: ChallengeTab = resolveAllowedChallengeTab(
      searchParams?.tab,
      isAdmin,
      { isSummaryVisible }
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
         isWrappedEnabled={isWrappedEnabled}
      />
   );
}
