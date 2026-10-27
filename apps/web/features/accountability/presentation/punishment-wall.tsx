"use client";

import Image from "next/image";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Download, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";
import { toDownloadUrl } from "@/features/challenges/domain/punishment-pfp";

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
   const hasPunishment = Boolean(
      punishmentPfpUrl && punishmentPfpUrl.trim().length > 0
   );

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
         className="rounded-3xl border border-border-default bg-surface-primary p-6 sm:p-7 shadow-lg space-y-5"
         data-testid="punishment-wall"
      >
         {/* Section Header */}
         <div className="flex flex-col gap-4 pb-4 border-b border-border-default sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
               <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border shrink-0 ${
                     hasPunishment
                        ? "bg-feedback-error-bg text-feedback-error-text border-feedback-error/30"
                        : "bg-feedback-success-bg text-feedback-success-text border-feedback-success/30"
                  }`}
               >
                  {hasPunishment ? (
                     <ShieldAlert className="h-5 w-5" />
                  ) : (
                     <ShieldCheck className="h-5 w-5" />
                  )}
               </div>
               <div>
                  <h3 className="text-lg font-bold text-white">
                     {hasPunishment
                        ? "Forfeits & Accountability Wall"
                        : "Accountability & Goals Wall"}
                  </h3>
                  <p className="text-xs text-text-tertiary">
                     {hasPunishment
                        ? "Three-Condition Rule (Law L6): Meeting target hours & weekly goals protects your avatar."
                        : "Three-Condition Rule (Law L6): Deficit and weekly goal tracking active with no forfeit avatar configured."}
                  </p>
               </div>
            </div>

            {/* Direct Forfeit Asset Download Button (FEAT-PUN-03) */}
            {hasPunishment && punishmentPfpUrl && (
               <a
                  href={toDownloadUrl(punishmentPfpUrl, "forfeit-avatar.png")}
                  download="forfeit-avatar.png"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[38px] items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-border-strong bg-surface-nested hover:bg-surface-nested text-white hover:text-white transition-colors shrink-0"
               >
                  <Download className="h-3.5 w-3.5 text-feedback-error-text" />
                  <span>Download Forfeit PFP</span>
               </a>
            )}
         </div>

         {/* Grid: Forfeit Asset Preview & Flagged Members */}
         <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
            {/* Forfeit Asset Showcase Card */}
            <div className="md:col-span-5 p-4 rounded-2xl bg-surface-secondary border border-border-default flex items-center gap-4">
               {hasPunishment && punishmentPfpUrl ? (
                  <>
                     <div className="relative h-20 w-20 sm:h-22 sm:w-22 shrink-0 rounded-2xl overflow-hidden border-2 border-feedback-error/40 shadow-md bg-surface-elevated">
                        <Image
                           src={punishmentPfpUrl}
                           alt="Challenge Forfeit Avatar"
                           fill
                           className="object-cover"
                           unoptimized
                        />
                     </div>
                     <div className="space-y-1.5 min-w-0 flex-1">
                        <p className="text-xs font-bold text-white">
                           Assigned Forfeit Picture
                        </p>
                        <p className="text-meta text-text-tertiary leading-relaxed">
                           Assigned to participants with unmet target hours or
                           incomplete weekly milestone goals upon conclusion.
                        </p>
                     </div>
                  </>
               ) : (
                  <>
                     <div
                        className="relative flex h-20 w-20 sm:h-22 sm:w-22 shrink-0 items-center justify-center rounded-2xl border-2 border-feedback-success/30 bg-surface-elevated shadow-md overflow-hidden"
                        data-testid="no-punishment-placeholder"
                        aria-label="No forfeit avatar configured"
                     >
                        <div className="flex flex-col items-center justify-center gap-1">
                           <div className="relative">
                              <ShieldCheck className="h-7 w-7 text-feedback-success-text" />
                              <Sparkles className="absolute -top-1 -right-1 h-3.5 w-3.5 text-brand-1" />
                           </div>
                           <span className="text-meta font-extrabold uppercase tracking-wider text-feedback-success-text font-mono">
                              No Forfeit
                           </span>
                        </div>
                     </div>
                     <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                           <span className="inline-flex items-center px-2 py-0.5 rounded-full text-micro font-bold uppercase tracking-wider bg-feedback-success-bg text-feedback-success-text border border-feedback-success/30">
                              No Forfeit Avatar
                           </span>
                        </div>
                        <p className="text-xs font-bold text-white">
                           No Forfeit Avatar Configured
                        </p>
                        <p className="text-meta text-text-tertiary leading-relaxed">
                           No forfeit avatar is configured for this event. Focus
                           on crushing your weekly goals and climbing the
                           leaderboard!
                        </p>
                     </div>
                  </>
               )}
            </div>

            {/* Flagged Members List */}
            <div className="md:col-span-7 space-y-3">
               {flaggedMembers.length === 0 ? (
                  <div className="flex items-center gap-3.5 rounded-2xl border border-feedback-success/30 bg-feedback-success-bg/20 p-4 text-xs text-text-secondary">
                     <ShieldCheck className="h-6 w-6 text-feedback-success-text shrink-0" />
                     <div>
                        <p className="font-bold text-feedback-success-text">
                           {isCompleted
                              ? "All participants completed their commitments!"
                              : "All participants currently on pace"}
                        </p>
                        <p className="text-meta text-text-tertiary mt-0.5">
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
                              className="flex items-center justify-between rounded-xl border border-border-default bg-surface-elevated p-3 text-xs shadow-sm hover:border-border-strong transition-colors"
                           >
                              <div className="flex items-center gap-3 min-w-0">
                                 <UserAvatar
                                    src={member.image}
                                    name={member.displayName}
                                    size="sm"
                                    className="h-8 w-8 rounded-full border border-border-strong shrink-0"
                                 />
                                 <div className="min-w-0 space-y-0.5">
                                    <div className="flex items-center gap-1.5 truncate">
                                       <span className="font-semibold text-white truncate">
                                          {member.displayName}
                                       </span>
                                       <span className="text-label text-text-tertiary shrink-0">
                                          ({member.teamName})
                                       </span>
                                    </div>
                                    <p className="text-meta text-text-tertiary truncate">
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
                                             <span className="text-feedback-error-text font-medium font-sans">
                                                -{deficitClock}
                                             </span>
                                          </>
                                       )}
                                    </p>
                                 </div>
                              </div>

                              <div className="shrink-0 ml-3">
                                 <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-label font-bold ${
                                       isExcused
                                          ? "border border-accent/40 bg-accent-bg text-accent-text"
                                          : isCompleted
                                            ? "border border-feedback-error/40 bg-feedback-error-bg text-feedback-error-text"
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
