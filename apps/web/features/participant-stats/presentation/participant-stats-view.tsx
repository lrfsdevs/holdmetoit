"use client";

import { useState } from "react";
import type { ParticipantStatsViewModel } from "../domain/participant-stats.types";
import { ParticipantProfileHeader } from "./participant-profile-header";
import { ParticipantFallbackBanner } from "./participant-fallback-banner";
import { ParticipantSummaryCards } from "./participant-summary-cards";
import { ParticipantProgressChart } from "./participant-progress-chart";
import { ParticipantDailyHistory } from "./participant-daily-history";
import { ParticipantTeamStats } from "./participant-team-stats";
import { ParticipantAccountability } from "./participant-accountability";
import { AdminTargetOverrideModal } from "@/features/challenges/presentation/admin-target-override-modal";

interface ParticipantStatsViewProps {
   stats: ParticipantStatsViewModel;
   viewParam?: string;
}

export function ParticipantStatsView({
   stats,
   viewParam,
}: ParticipantStatsViewProps) {
   const {
      profile,
      summary,
      dailyHistory,
      teamStats,
      accountability,
      viewer,
      isFallback = false,
   } = stats;
   const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);

   return (
      <div className="space-y-8 max-w-6xl mx-auto pb-12">
         {/* 1. Profile Header with Breadcrumbs */}
         <ParticipantProfileHeader
            profile={profile}
            isAdmin={viewer.isAdmin}
            viewParam={viewParam}
            isFallback={isFallback}
         />

         {/* 2. Fallback Notice Banner if user is unenrolled or has no data */}
         {isFallback && (
            <ParticipantFallbackBanner profile={profile} viewer={viewer} />
         )}

         {/* 3. Key Metrics Summary Cards */}
         <ParticipantSummaryCards
            summary={summary}
            isAdmin={viewer.isAdmin}
            onEditTarget={
               isFallback ? undefined : () => setIsTargetModalOpen(true)
            }
            isFallback={isFallback}
         />

         {/* 4. Progress Visualization Chart (Enrolled Only) */}
         {!isFallback && (
            <ParticipantProgressChart dailyHistory={dailyHistory} />
         )}

         {/* 5. Team Standing & Share (if team-based challenge & Enrolled Only) */}
         {!isFallback && teamStats && (
            <ParticipantTeamStats teamStats={teamStats} />
         )}

         {/* 6. Accountability & Deficit Status (Enrolled Only) */}
         {!isFallback && (
            <ParticipantAccountability accountability={accountability} />
         )}

         {/* 7. Complete Chronological Daily Study History */}
         <ParticipantDailyHistory
            dailyHistory={dailyHistory}
            isFallback={isFallback}
         />

         {/* 8. Admin Target Override Modal (FEAT-DECL-04 - Enrolled Only) */}
         {!isFallback && viewer.isAdmin && isTargetModalOpen && (
            <AdminTargetOverrideModal
               isOpen={isTargetModalOpen}
               onClose={() => setIsTargetModalOpen(false)}
               challengeId={profile.challengeId}
               participant={{
                  participantId: profile.participantId,
                  userId: profile.userId,
                  displayName: profile.displayName,
                  username: profile.username,
                  image: profile.image,
                  teamName: profile.teamName,
                  teamColor: profile.teamColor,
                  targetSeconds: summary.targetSeconds,
                  targetClock: summary.targetClock,
               }}
            />
         )}
      </div>
   );
}
