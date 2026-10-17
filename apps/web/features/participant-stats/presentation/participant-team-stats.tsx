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
      <div className="rounded-3xl border border-[#262626] bg-[#141414] p-5 sm:p-7 shadow-xl space-y-4">
         <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
            <div className="flex items-center gap-2">
               <Shield className="h-5 w-5" style={{ color: palette.solid }} />
               <h2 className="text-base sm:text-lg font-bold text-[#f4f3f6]">
                  Team Standing & Contribution
               </h2>
            </div>
            <span
               className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border"
               style={getTeamBadgeStyle(teamStats.teamColor)}
            >
               <span>{teamStats.teamIcon || "🛡️"}</span>
               <span>{teamStats.teamName}</span>
               <span className="text-[11px] opacity-75 font-normal">
                  (House #{teamStats.teamRank})
               </span>
            </span>
         </div>

         <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Team Rank */}
            <div className="rounded-2xl border border-[#262626] bg-[#1a1a1a] p-4 space-y-1">
               <span className="text-xs text-[#868686] flex items-center gap-1.5">
                  <Award className="h-3.5 w-3.5 text-[#eab308]" />
                  House Standing
               </span>
               <p className="text-xl font-extrabold text-[#f4f3f6]">
                  Rank #{teamStats.participantTeamRank}
               </p>
               <p className="text-[11px] text-[#868686]">
                  of {teamStats.companionCount} house{" "}
                  {teamStats.companionCount === 1 ? "member" : "members"}
               </p>
            </div>

            {/* Team Total Hours */}
            <div className="rounded-2xl border border-[#262626] bg-[#1a1a1a] p-4 space-y-1">
               <span className="text-xs text-[#868686] flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-[#3b82f6]" />
                  House Cumulative
               </span>
               <p className="text-xl font-extrabold font-sans font-sans-tabular text-[#f4f3f6]">
                  {teamStats.teamTotalLoggedClock}
               </p>
               <p className="text-[11px] text-[#868686]">Combined study time</p>
            </div>

            {/* Participant Share */}
            <div className="rounded-2xl border border-[#262626] bg-[#1a1a1a] p-4 space-y-2">
               <div className="flex items-center justify-between text-xs">
                  <span className="text-[#868686]">Member Contribution</span>
                  <span className="font-bold" style={{ color: palette.text }}>
                     {teamStats.participantContributionPercentage}%
                  </span>
               </div>

               <div className="h-2 w-full overflow-hidden rounded-full bg-[#262626]">
                  <div
                     className="h-full rounded-full transition-all duration-500"
                     style={{
                        width: `${teamStats.participantContributionPercentage}%`,
                        backgroundColor: palette.solid,
                     }}
                  />
               </div>

               <p className="text-[11px] text-[#868686]">
                  Share of {teamStats.teamName}&apos;s logged hours
               </p>
            </div>
         </div>
      </div>
   );
}
