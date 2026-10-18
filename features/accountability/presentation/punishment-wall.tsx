"use client";

import Image from "next/image";
import { Download, Shield, ShieldAlert, ShieldCheck } from "lucide-react";

import { formatSecondsToClock } from "@/features/study-logs/domain/duration";
import type {
   ChallengeScoreboardViewModel,
   ScoreboardStandingEntry,
} from "@/features/leaderboard/domain/leaderboard.types";

export interface PunishmentWallProps {
   challenge: ChallengeScoreboardViewModel;
}

/**
 * Public Accountability & Deficit Roster Component (FEAT-PUN-02 / FEAT-PUN-03).
 *
 * Displays the event forfeit avatar alongside:
 * - Live deficit catch-up scholars during an active event.
 * - Final punished / excused scholar records once results are locked.
 */
export function PunishmentWall({ challenge }: PunishmentWallProps) {
   const { punishmentPfpUrl, standings, status } = challenge;
   const isCompleted = status === "COMPLETED";

   // 1. Determine flagged members based on challenge lifecycle
   let flaggedMembers: ScoreboardStandingEntry[] = [];
   if (isCompleted) {
      // Completed: show scholars flagged with punished or excused status
      flaggedMembers = standings.filter(
         (s) =>
            s.paceStatus === "punished" ||
            s.paceStatus === "excused" ||
            s.status === "PUNISHED" ||
            s.status === "EXCUSED"
      );
   } else {
      // Upcoming or Active: show scholars in deficit / catch-up
      flaggedMembers = standings
         .filter((s) => s.deficitSeconds > 0 || s.paceStatus === "catch-up")
         .sort((a, b) => b.deficitSeconds - a.deficitSeconds);
   }

   return (
      <div
         className="rounded-3xl border border-[#262626] bg-[#141414] p-6 sm:p-7 shadow-lg space-y-5"
         data-testid="punishment-wall"
      >
         {/* Section Header */}
         <div className="flex flex-col gap-4 pb-4 border-b border-[#262626] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
               <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#401010] text-[#ff5757] border border-[#ef4444]/30 shrink-0">
                  <ShieldAlert className="h-5 w-5" />
               </div>
               <div>
                  <h3 className="text-lg font-bold text-[#ffffff]">
                     Forfeits & Accountability Wall
                  </h3>
                  <p className="text-xs text-[#868686]">
                     Three-Condition Rule (Law L6): Meeting target hours &
                     weekly goals protects your avatar.
                  </p>
               </div>
            </div>

            {/* Direct Forfeit Asset Download Button (FEAT-PUN-03) */}
            {punishmentPfpUrl && (
               <a
                  href={punishmentPfpUrl}
                  download="forfeit-avatar.png"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[38px] items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-[#383838] bg-[#242424] hover:bg-[#333333] text-white hover:text-white transition-colors shrink-0"
               >
                  <Download className="h-3.5 w-3.5 text-[#ff5757]" />
                  <span>Download Forfeit PFP</span>
               </a>
            )}
         </div>

         {/* Grid: Forfeit Asset Preview & Flagged Members */}
         <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
            {/* Forfeit Asset Showcase Card */}
            <div className="md:col-span-5 p-4 rounded-2xl bg-[#181818] border border-[#262626] flex items-center gap-4">
               {punishmentPfpUrl ? (
                  <>
                     <div className="relative h-20 w-20 sm:h-22 sm:w-22 shrink-0 rounded-2xl overflow-hidden border-2 border-[#ef4444]/40 shadow-md bg-[#1c1c1c]">
                        <Image
                           src={punishmentPfpUrl}
                           alt="Challenge Forfeit Avatar"
                           fill
                           className="object-cover"
                           unoptimized
                        />
                     </div>
                     <div className="space-y-1.5 min-w-0 flex-1">
                        <p className="text-xs font-bold text-[#ffffff]">
                           Assigned Forfeit Picture
                        </p>
                        <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                           Assigned to participants with unmet target hours or
                           incomplete weekly milestone goals upon conclusion.
                        </p>
                     </div>
                  </>
               ) : (
                  <div className="flex items-center gap-3 py-1">
                     <div className="h-10 w-10 rounded-xl bg-[#1c1c1c] border border-[#292929] flex items-center justify-center shrink-0">
                        <Shield className="h-5 w-5 text-[#868686]" />
                     </div>
                     <div>
                        <p className="text-xs font-semibold text-[#ffffff]">
                           No Custom Forfeit Avatar Set
                        </p>
                        <p className="text-[11px] text-[#868686]">
                           Accountability rules still apply. Hosts can upload an
                           avatar via the Challenge Manage tab.
                        </p>
                     </div>
                  </div>
               )}
            </div>

            {/* Flagged Members List */}
            <div className="md:col-span-7 space-y-3">
               {flaggedMembers.length === 0 ? (
                  <div className="flex items-center gap-3.5 rounded-2xl border border-[#22c55e]/30 bg-[#144520]/20 p-4 text-xs text-[#d1d1d1]">
                     <ShieldCheck className="h-6 w-6 text-[#85ff93] shrink-0" />
                     <div>
                        <p className="font-bold text-[#85ff93]">
                           {isCompleted
                              ? "All participants completed their commitments!"
                              : "All participants currently on pace"}
                        </p>
                        <p className="text-[11px] text-[#a1a1aa] mt-0.5">
                           {isCompleted
                              ? "Every scholar satisfied their weekly goals and target hours. Zero forfeit avatars assigned."
                              : "All scholars are currently maintaining required pace with zero deficits. Keep up the momentum!"}
                        </p>
                     </div>
                  </div>
               ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                     {flaggedMembers.map((member) => {
                        const isExcused =
                           member.paceStatus === "excused" ||
                           member.status === "EXCUSED";
                        const deficitClock =
                           member.deficitSeconds > 0
                              ? formatSecondsToClock(member.deficitSeconds)
                              : "00:00:00";

                        return (
                           <div
                              key={member.participantId}
                              className="flex items-center justify-between rounded-xl border border-[#292929] bg-[#1c1c1c] p-3 text-xs shadow-sm hover:border-[#383838] transition-colors"
                           >
                              <div className="flex items-center gap-3 min-w-0">
                                 {member.image ? (
                                    <Image
                                       src={member.image}
                                       alt={member.displayName}
                                       width={32}
                                       height={32}
                                       className="h-8 w-8 rounded-full border border-[#333333] shrink-0 object-cover"
                                       unoptimized
                                    />
                                 ) : (
                                    <div className="h-8 w-8 rounded-full bg-[#262626] border border-[#383838] flex items-center justify-center font-bold text-xs text-[#d1d1d1] shrink-0">
                                       {member.displayName
                                          .charAt(0)
                                          .toUpperCase()}
                                    </div>
                                 )}
                                 <div className="min-w-0 space-y-0.5">
                                    <div className="flex items-center gap-1.5 truncate">
                                       <span className="font-semibold text-[#ffffff] truncate">
                                          {member.displayName}
                                       </span>
                                       <span className="text-[10px] text-[#868686] shrink-0">
                                          ({member.teamName})
                                       </span>
                                    </div>
                                    <p className="text-[11px] text-[#868686] truncate">
                                       {member.weeklyTasksTotalCount > 0 ? (
                                          <span>
                                             Goals:{" "}
                                             {member.weeklyTasksCompletedCount}/
                                             {member.weeklyTasksTotalCount}
                                          </span>
                                       ) : (
                                          <span>Goals complete</span>
                                       )}
                                       {member.deficitSeconds > 0 && (
                                          <>
                                             {" • "}
                                             <span className="text-[#ff5757] font-medium font-sans">
                                                -{deficitClock}
                                             </span>
                                          </>
                                       )}
                                    </p>
                                 </div>
                              </div>

                              <div className="shrink-0 ml-3">
                                 <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                       isExcused
                                          ? "border border-[#8b5cf6]/40 bg-[#230e40] text-[#a29dae]"
                                          : isCompleted
                                            ? "border border-[#ef4444]/40 bg-[#401010] text-[#ff5757]"
                                            : "border border-amber-500/40 bg-amber-500/10 text-amber-400"
                                    }`}
                                 >
                                    {isExcused
                                       ? "Excused"
                                       : isCompleted
                                         ? "Punished"
                                         : "Catch-Up"}
                                 </span>
                              </div>
                           </div>
                        );
                     })}
                  </div>
               )}
            </div>
         </div>
      </div>
   );
}
