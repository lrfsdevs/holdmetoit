import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ErrorState } from "@/components/state/error-state";
import { auth } from "@/core/auth";
import {
   getEffectiveAdminState,
   PARTICIPANT_PREVIEW_COOKIE,
} from "@/features/auth/domain/preview-mode";
import { getChallengeScoreboard } from "@/features/leaderboard/data/leaderboard-data";
import { buildChallengeDescription } from "@/features/challenges/domain/challenge-embed";
import { ChallengeView } from "@/features/challenges/presentation/challenge-view";
import {
   ChallengeTab,
   resolveAllowedChallengeTab,
} from "@/features/challenges/domain/challenge-tabs";
import { resolveLeaderboardViewMode } from "@/features/leaderboard/domain/leaderboard";
import { logError, logEvents } from "@/core/observability/logger";
import { isFeatureEnabled } from "@/features/feature-flags/api/server";
import { FEATURE_FLAG_KEYS } from "@/features/feature-flags/domain/feature-flag-keys";
import { WRAPPED_FEATURE_FLAG_KEY } from "@/features/wrapped/api/wrapped-flag";

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

/** Builds challenge metadata for Discord link embeds. */
export async function generateMetadata({
   params,
}: ChallengePageProps): Promise<Metadata> {
   let challenge: Awaited<ReturnType<typeof getChallengeScoreboard>> = null;
   try {
      challenge = await getChallengeScoreboard(params.id);
   } catch (error) {
      logError(logEvents.appError, {
         scope: "challenge.metadata",
         context: { challengeId: params.id },
         error,
      });
   }

   if (!challenge || challenge.isDeleted) {
      return { title: "Challenge Not Found | HoldMeToIt" };
   }

   const description = buildChallengeDescription(challenge);
   const image = challenge.eventBannerUrl ?? challenge.heroImageUrl ?? null;

   return {
      title: `${challenge.title} | HoldMeToIt`,
      description,
      openGraph: {
         type: "website",
         siteName: "HoldMeToIt",
         title: challenge.title,
         description,
         ...(image ? { images: [{ url: image }] } : {}),
      },
      twitter: {
         card: image ? "summary_large_image" : "summary",
         title: challenge.title,
         description,
         ...(image ? { images: [image] } : {}),
      },
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

   const isWrappedEnabled = await isFeatureEnabled(WRAPPED_FEATURE_FLAG_KEY);
   const isBettingEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.betting);

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
         isWrappedEnabled={isWrappedEnabled}
         isBettingEnabled={isBettingEnabled}
      />
   );
}
