import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ErrorState } from "@/components/state/error-state";
import { Button } from "@/components/ui/button";
import { auth } from "@/core/auth";
import {
   getEffectiveAdminState,
   PARTICIPANT_PREVIEW_COOKIE,
} from "@/features/auth/domain/preview-mode";
import { getChallengeParticipantStats } from "@/features/participant-stats/data/participant-stats.repository";
import { ParticipantStatsView } from "@/features/participant-stats/presentation/participant-stats-view";
import { logError, logEvents } from "@/core/observability/logger";

interface ParticipantStatsPageProps {
   params: Promise<{
      id: string;
      participantId: string;
   }>;
   searchParams?: Promise<{
      as?: string;
      view?: string;
   }>;
}

/** Builds participant profile metadata for search and social previews. */
export async function generateMetadata({
   params,
}: ParticipantStatsPageProps): Promise<Metadata> {
   const { id, participantId } = await params;
   let stats: Awaited<ReturnType<typeof getChallengeParticipantStats>> = null;
   try {
      stats = await getChallengeParticipantStats(id, participantId);
   } catch (error) {
      logError(logEvents.appError, {
         scope: "participant.stats.metadata",
         context: {
            challengeId: id,
            participantId,
         },
         error,
      });
   }

   if (!stats) {
      return {
         title: "Participant Not Found | HoldMeToIt",
      };
   }

   return {
      title: `${stats.profile.displayName} — ${stats.profile.challengeTitle} | HoldMeToIt`,
      description: `View ${stats.profile.displayName}'s study stats, targets, daily history, and leaderboard standing in ${stats.profile.challengeTitle}.`,
   };
}

/** Loads challenge-scoped participant statistics with recovery handling. */
export default async function ParticipantStatsPage({
   params,
   searchParams,
}: ParticipantStatsPageProps) {
   const { id, participantId } = await params;
   const query = (await searchParams) ?? {};
   const session = await auth();
   const cookieStore = await cookies();
   const previewCookie = cookieStore.get(PARTICIPANT_PREVIEW_COOKIE)?.value;

   const { isAdmin, isPreviewActive } = getEffectiveAdminState({
      userRole: session?.user?.role,
      previewCookie,
      searchParamAs: query.as,
   });

   let statsFailed = false;
   let stats: Awaited<ReturnType<typeof getChallengeParticipantStats>> = null;
   try {
      stats = await getChallengeParticipantStats(id, participantId, {
         currentUserId: session?.user?.id,
         isAdmin,
         isPreviewActive,
      });
   } catch (error) {
      statsFailed = true;
      logError(logEvents.appError, {
         scope: "participant.stats.page",
         context: {
            challengeId: id,
            participantId,
            userId: session?.user?.id,
         },
         error,
      });
   }

   const returnLeaderboardUrl = `/challenge/${id}?tab=leaderboard${
      query.view ? `&view=${encodeURIComponent(query.view)}` : ""
   }`;

   if (statsFailed) {
      return (
         <div className="mx-auto max-w-2xl px-4 py-16">
            <ErrorState
               title="Couldn't load participant stats"
               message="Something went wrong while fetching this participant's data. Please try again shortly."
            />
            <div className="mt-6 flex justify-center">
               <Button asChild variant="secondary" className="min-h-control-sm">
                  <Link href={returnLeaderboardUrl}>Return to Leaderboard</Link>
               </Button>
            </div>
         </div>
      );
   }

   if (!stats) {
      notFound();
   }

   return <ParticipantStatsView stats={stats} viewParam={query.view} />;
}
