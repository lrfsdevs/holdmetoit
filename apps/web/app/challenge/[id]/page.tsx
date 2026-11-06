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
   params: Promise<{
      id: string;
   }>;
   searchParams?: Promise<{
      tab?: string;
      as?: string;
      view?: string;
      day?: string;
      date?: string;
      search?: string;
      team?: string;
      page?: string;
   }>;
}

/** Builds challenge metadata for Discord link embeds. */
export async function generateMetadata({
   params,
}: ChallengePageProps): Promise<Metadata> {
   const { id } = await params;
   let challenge: Awaited<ReturnType<typeof getChallengeScoreboard>> = null;
   try {
      challenge = await getChallengeScoreboard(id);
   } catch (error) {
      logError(logEvents.appError, {
         scope: "challenge.metadata",
         context: { challengeId: id },
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
   const { id } = await params;
   const query = (await searchParams) ?? {};
   const session = await auth();
   const cookieStore = await cookies();
   const previewCookie = cookieStore.get(PARTICIPANT_PREVIEW_COOKIE)?.value;

   const { isAdmin } = getEffectiveAdminState({
      userRole: session?.user?.role,
      previewCookie,
      searchParamAs: query.as,
   });

   const isWrappedEnabled = await isFeatureEnabled(WRAPPED_FEATURE_FLAG_KEY);
   const isBettingEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.betting);
   const isWithdrawalEnabled = await isFeatureEnabled(
      FEATURE_FLAG_KEYS.withdrawal
   );
   const isGlobalLeaderboardEnabled = await isFeatureEnabled(
      FEATURE_FLAG_KEYS.globalLeaderboard
   );

   let challenge: Awaited<ReturnType<typeof getChallengeScoreboard>> = null;
   try {
      challenge = await getChallengeScoreboard(id, session?.user?.id);
   } catch (error) {
      logError(logEvents.appError, {
         scope: "challenge.page",
         context: { challengeId: id },
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
      query.tab,
      isAdmin,
      { isSummaryVisible }
   );
   const initialLeaderboardViewMode = resolveLeaderboardViewMode(
      query.view,
      challenge.format
   );

   const initialRosterSearch = query.search ?? "";
   const initialRosterTeamFilter = query.team ?? "ALL";
   const initialRosterPage = query.page
      ? Math.max(1, parseInt(query.page, 10) || 1)
      : 1;

   return (
      <ChallengeView
         challenge={challenge}
         initialTab={initialTab}
         isAdmin={isAdmin}
         initialLeaderboardViewMode={initialLeaderboardViewMode}
         initialLeaderboardDay={query.day ?? query.date}
         initialRosterSearch={initialRosterSearch}
         initialRosterTeamFilter={initialRosterTeamFilter}
         initialRosterPage={initialRosterPage}
         isWrappedEnabled={isWrappedEnabled}
         isBettingEnabled={isBettingEnabled}
         isWithdrawalEnabled={isWithdrawalEnabled}
         isGlobalLeaderboardEnabled={isGlobalLeaderboardEnabled}
      />
   );
}
