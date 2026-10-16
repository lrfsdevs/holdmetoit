"use client";

import { useState } from "react";
import type { ParticipantStatsViewModel } from "../domain/participant-stats.types";
import { ParticipantProfileHeader } from "./participant-profile-header";
import { ParticipantSummaryCards } from "./participant-summary-cards";
import { ParticipantProgressChart } from "./participant-progress-chart";
import { ParticipantDailyHistory } from "./participant-daily-history";
import { ParticipantTeamStats } from "./participant-team-stats";
import { ParticipantAccountability } from "./participant-accountability";
import { AdminTargetOverrideModal } from "@/features/challenges/presentation/admin-target-override-modal";
import { UnifiedProgressionCard } from "./unified-progression-card";

interface ParticipantStatsViewProps {
   stats: ParticipantStatsViewModel;
   viewParam?: string;
}

export function ParticipantStatsView({
   stats,
   viewParam,
}: ParticipantStatsViewProps) {
   const { profile, summary, dailyHistory, teamStats, accountability, viewer } =
      stats;
   const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);

   return (
      <div className="space-y-8 max-w-6xl mx-auto pb-12">
         {/* 1. Profile Header with Breadcrumbs */}
         <ParticipantProfileHeader
            profile={profile}
            isAdmin={viewer.isAdmin}
            viewParam={viewParam}
         />

         {/* 2. Key Metrics Summary Cards */}
         <ParticipantSummaryCards
            summary={summary}
            isAdmin={viewer.isAdmin}
            onEditTarget={() => setIsTargetModalOpen(true)}
         />

         {/* 3. Unified 3-Layer Progression (Competitive, Study, Economy) */}
         {stats.competitive && (
            <UnifiedProgressionCard
               competitive={stats.competitive}
               displayName={profile.displayName}
            />
         )}

         {/* 3. Progress Visualization Chart */}
         <ParticipantProgressChart dailyHistory={dailyHistory} />

         {/* 4. Team Standing & Share (if team-based challenge) */}
         {teamStats && <ParticipantTeamStats teamStats={teamStats} />}

         {/* 5. Accountability & Deficit Status */}
         <ParticipantAccountability accountability={accountability} />

         {/* 6. Complete Chronological Daily Study History */}
         <ParticipantDailyHistory dailyHistory={dailyHistory} />

         {/* 7. Admin Target Override Modal (FEAT-DECL-04) */}
         {viewer.isAdmin && isTargetModalOpen && (
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
