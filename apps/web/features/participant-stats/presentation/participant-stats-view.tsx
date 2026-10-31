"use client";

import { useState } from "react";
import type { ParticipantStatsViewModel } from "../domain/participant-stats.types";
import { ParticipantProfileHeader } from "./participant-profile-header";
import { ParticipantFallbackBanner } from "./participant-fallback-banner";
import { ChallengeSnapshot } from "./challenge-snapshot";
import { AdminTargetOverrideModal } from "@/features/challenges/presentation/admin-target-override-modal";

interface ParticipantStatsViewProps {
   stats: ParticipantStatsViewModel;
   viewParam?: string;
}

export function ParticipantStatsView({
   stats,
   viewParam,
}: ParticipantStatsViewProps) {
   const { profile, summary, viewer, isFallback = false } = stats;
   const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);

   return (
      <div className="space-y-8 max-w-6xl mx-auto pb-12">
         {/* 1. Profile Header with Breadcrumbs */}
         <ParticipantProfileHeader
            profile={profile}
            isAdmin={viewer.isAdmin}
            isOwner={viewer.isOwner}
            viewParam={viewParam}
            isFallback={isFallback}
         />

         {/* 2. Fallback Notice Banner if user is unenrolled or has no data */}
         {isFallback && (
            <ParticipantFallbackBanner profile={profile} viewer={viewer} />
         )}

         {/* 3. Reusable Challenge Performance Snapshot */}
         <ChallengeSnapshot
            stats={stats}
            showChallengeHeader={true}
            showCockpitLink={false}
            onEditTarget={
               isFallback ? undefined : () => setIsTargetModalOpen(true)
            }
         />

         {/* 4. Admin Target Override Modal (FEAT-DECL-04 - Enrolled Only) */}
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
