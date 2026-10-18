import { Users, Shield, Award } from "lucide-react";
import type { ParticipantTeamStats as TeamStatsType } from "../domain/participant-stats.types";
import {
   getTeamColorPalette,
   getTeamBadgeStyle,
} from "@/features/challenges/domain/team-colors";

interface ParticipantTeamStatsProps {
   teamStats: TeamStatsType;
}

export function ParticipantTeamStats({ teamStats }: ParticipantTeamStatsProps) {
   const palette = getTeamColorPalette(teamStats.teamColor);
   return (
      <div className="rounded-3xl border border-border-default bg-surface-primary p-5 sm:p-7 shadow-xl space-y-4">
         <div className="flex items-center justify-between pb-3 border-b border-border-default">
            <div className="flex items-center gap-2">
               <Shield className="h-5 w-5" style={{ color: palette.solid }} />
               <h2 className="text-base sm:text-lg font-bold text-text-primary">
                  Team Standing & Contribution
               </h2>
            </div>
            <span
               className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border"
               style={getTeamBadgeStyle(teamStats.teamColor)}
            >
               <span>{teamStats.teamIcon || "🛡️"}</span>
               <span>{teamStats.teamName}</span>
               <span className="text-meta opacity-75 font-normal">
                  (House #{teamStats.teamRank})
               </span>
            </span>
         </div>

         <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Team Rank */}
            <div className="rounded-2xl border border-border-default bg-surface-tertiary p-4 space-y-1">
               <span className="text-xs text-text-tertiary flex items-center gap-1.5">
                  <Award className="h-3.5 w-3.5 text-brand-1" />
                  House Standing
               </span>
               <p className="text-xl font-extrabold text-text-primary">
                  Rank #{teamStats.participantTeamRank}
               </p>
               <p className="text-meta text-text-tertiary">
                  of {teamStats.companionCount} house{" "}
                  {teamStats.companionCount === 1 ? "member" : "members"}
               </p>
            </div>

            {/* Team Total Hours */}
            <div className="rounded-2xl border border-border-default bg-surface-tertiary p-4 space-y-1">
               <span className="text-xs text-text-tertiary flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-feedback-info" />
                  House Cumulative
               </span>
               <p className="text-xl font-extrabold font-sans font-sans-tabular text-text-primary">
                  {teamStats.teamTotalLoggedClock}
               </p>
               <p className="text-meta text-text-tertiary">
                  Combined study time
               </p>
            </div>

            {/* Participant Share */}
            <div className="rounded-2xl border border-border-default bg-surface-tertiary p-4 space-y-2">
               <div className="flex items-center justify-between text-xs">
                  <span className="text-text-tertiary">
                     Member Contribution
                  </span>
                  <span className="font-bold" style={{ color: palette.text }}>
                     {teamStats.participantContributionPercentage}%
                  </span>
               </div>

               <div className="h-2 w-full overflow-hidden rounded-full bg-surface-nested">
                  <div
                     className="h-full rounded-full transition-all duration-500"
                     style={{
                        width: `${teamStats.participantContributionPercentage}%`,
                        backgroundColor: palette.solid,
                     }}
                  />
               </div>

               <p className="text-meta text-text-tertiary">
                  Share of {teamStats.teamName}&apos;s logged hours
               </p>
            </div>
         </div>
      </div>
   );
}
