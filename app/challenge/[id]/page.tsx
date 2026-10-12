import Link from "next/link";
import { cookies } from "next/headers";

import { EmptyState } from "@/components/state/empty-state";
import { ErrorState } from "@/components/state/error-state";
import { Button } from "@/components/ui/button";
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
      search?: string;
      team?: string;
      page?: string;
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

   try {
      const challenge = await getChallengeScoreboard(
         params.id,
         session?.user?.id
      );

      if (!challenge) {
         return (
            <EmptyState
               title="Challenge not found"
               description="We couldn't locate this study challenge in our records. It may not exist or might still be in draft setup."
               action={
                  <Button asChild variant="secondary" className="min-h-[44px]">
                     <Link href="/">Return to Study Lounge</Link>
                  </Button>
               }
            />
         );
      }

      const initialTab: ChallengeTab = resolveAllowedChallengeTab(
         searchParams?.tab,
         isAdmin,
         { isSummaryVisible: Boolean(challenge.resultsLockedAt) }
      );
      const initialLeaderboardViewMode = resolveLeaderboardViewMode(
         searchParams?.view
      );

      const initialRosterSearch = searchParams?.search ?? "";
      const initialRosterTeamFilter = searchParams?.team ?? "ALL";
      const initialRosterPage = searchParams?.page
         ? Math.max(1, parseInt(searchParams.page, 10) || 1)
         : 1;

      return (
         <ChallengeView
            challenge={challenge}
            initialTab={initialTab}
            isAdmin={isAdmin}
            initialLeaderboardViewMode={initialLeaderboardViewMode}
            initialRosterSearch={initialRosterSearch}
            initialRosterTeamFilter={initialRosterTeamFilter}
            initialRosterPage={initialRosterPage}
         />
      );
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
}
