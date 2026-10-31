"use client";

import Link from "next/link";
import { ArrowUpRight, Calendar } from "lucide-react";
import type { ParticipantStatsViewModel } from "../domain/participant-stats.types";
import { ParticipantSummaryCards } from "./participant-summary-cards";
import { ParticipantProgressChart } from "./participant-progress-chart";
import { ParticipantDailyHistory } from "./participant-daily-history";
import { ParticipantTeamStats } from "./participant-team-stats";
import { ParticipantAccountability } from "./participant-accountability";

export interface ChallengeSnapshotProps {
   stats: ParticipantStatsViewModel;
   showChallengeHeader?: boolean;
   showCockpitLink?: boolean;
   onEditTarget?: () => void;
   className?: string;
}

function getFormatBadge(format: string): { label: string } {
   switch (format) {
      case "TEAM_VS_TEAM":
         return { label: "Team Battle" };
      case "DUOS":
         return { label: "Duos" };
      case "SOLOS":
         return { label: "Solos" };
      default:
         return { label: format };
   }
}

function getParticipantStatusBadge(stats: ParticipantStatsViewModel): {
   label: string;
   className: string;
} {
   const status =
      stats.profile.participantStatus ??
      (stats.profile.challengeStatus === "COMPLETED" ? "COMPLETED" : "ACTIVE");

   switch (status) {
      case "WITHDRAWN":
         return {
            label: "Withdrawn",
            className:
               "bg-feedback-error-bg border-feedback-error/40 text-feedback-error-text",
         };
      case "COMPLETED":
         return {
            label: "Completed",
            className:
               "bg-surface-elevated border-border-strong text-text-secondary",
         };
      case "ACTIVE":
      default:
         return {
            label: "Active",
            className:
               "bg-feedback-success-bg border-feedback-success/40 text-feedback-success-text",
         };
   }
}

function formatChallengeDateRange(
   stats: ParticipantStatsViewModel
): string | null {
   if (stats.profile.startDate && stats.profile.endDate) {
      const start = new Date(stats.profile.startDate).toLocaleDateString(
         "en-US",
         {
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: "UTC",
         }
      );
      const end = new Date(stats.profile.endDate).toLocaleDateString("en-US", {
         month: "short",
         day: "numeric",
         year: "numeric",
         timeZone: "UTC",
      });
      return `${start} – ${end}`;
   }

   if (stats.dailyHistory && stats.dailyHistory.length > 0) {
      const first = stats.dailyHistory[0];
      const last = stats.dailyHistory[stats.dailyHistory.length - 1];
      if (first?.dateFormatted && last?.dateFormatted) {
         if (first.dateFormatted === last.dateFormatted) {
            return first.dateFormatted;
         }
         return `${first.dateFormatted} – ${last.dateFormatted}`;
      }
   }

   return null;
}

/**
 * Renders a self-contained, modular snapshot of a participant's performance in a single challenge.
 * Reusable between `/challenge/[id]/participant/[participantId]` and `/profile/[userId]`.
 */
export function ChallengeSnapshot({
   stats,
   showChallengeHeader = true,
   showCockpitLink = true,
   onEditTarget,
   className = "",
}: ChallengeSnapshotProps) {
   const {
      profile,
      summary,
      dailyHistory,
      teamStats,
      accountability,
      viewer,
      isFallback = false,
   } = stats;

   const formatBadge = getFormatBadge(profile.challengeFormat);
   const statusBadge = getParticipantStatusBadge(stats);
   const dateRange = formatChallengeDateRange(stats);

   const cockpitUrl = `/challenge/${profile.challengeId}/participant/${profile.participantId}`;

   return (
      <div
         className={`space-y-6 ${className}`}
         data-testid="challenge-snapshot"
      >
         {/* Challenge Context Header Bar */}
         {showChallengeHeader && (
            <div
               className="rounded-3xl border border-border-default bg-surface-primary p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
               data-testid="challenge-snapshot-header"
            >
               <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                     <h2 className="text-lg sm:text-xl font-bold text-text-primary tracking-tight truncate">
                        {profile.challengeTitle}
                     </h2>
                     <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border border-border-strong bg-surface-elevated text-text-secondary">
                        {formatBadge.label}
                     </span>
                     <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusBadge.className}`}
                     >
                        {statusBadge.label}
                     </span>
                  </div>

                  {dateRange && (
                     <p className="text-xs text-text-tertiary flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                        <span>{dateRange}</span>
                     </p>
                  )}
               </div>

               {showCockpitLink &&
                  profile.challengeId &&
                  profile.participantId && (
                     <div className="shrink-0 pt-2 sm:pt-0">
                        <Link
                           href={cockpitUrl}
                           className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-nested hover:bg-surface-elevated border border-border-strong text-xs font-semibold text-text-secondary hover:text-white transition-colors"
                           data-testid="view-challenge-cockpit-link"
                        >
                           <span>View Full Challenge Cockpit</span>
                           <ArrowUpRight className="h-3.5 w-3.5 text-text-tertiary" />
                        </Link>
                     </div>
                  )}
            </div>
         )}

         {/* 1. Summary Statistics Cards */}
         <ParticipantSummaryCards
            summary={summary}
            isAdmin={viewer.isAdmin}
            onEditTarget={isFallback ? undefined : onEditTarget}
            isFallback={isFallback}
         />

         {/* 2. Progress Visualization Chart (Enrolled Only) */}
         {!isFallback && (
            <ParticipantProgressChart dailyHistory={dailyHistory} />
         )}

         {/* 3. Team Standing & Contribution (if team-based challenge & Enrolled Only) */}
         {!isFallback && teamStats && (
            <ParticipantTeamStats teamStats={teamStats} />
         )}

         {/* 4. Accountability & Deficit Status (Enrolled Only) */}
         {!isFallback && (
            <ParticipantAccountability accountability={accountability} />
         )}

         {/* 5. Complete Chronological Daily Study History */}
         <ParticipantDailyHistory
            dailyHistory={dailyHistory}
            isFallback={isFallback}
         />
      </div>
   );
}
