"use client";

import React from "react";
import { getRankForTrophies } from "../domain/trophy-rank";
import { TrophyRoleBadge } from "./trophy-role-badge";
import { ArrowUpRight, Sparkles } from "lucide-react";

interface TrophyProgressBarProps {
   trophies: number;
   className?: string;
   showTitle?: boolean;
}

export function TrophyProgressBar({
   trophies,
   className = "",
   showTitle = true,
}: TrophyProgressBarProps) {
   const rankCalc = getRankForTrophies(trophies);
   const {
      role,
      progressPercentage,
      trophiesToNext,
      nextRole,
      nextThreshold,
      isMaxRank,
      minTrophies,
   } = rankCalc;

   return (
      <div
         className={`rounded-2xl border border-obsidian-border bg-obsidian-card p-5 shadow-lg backdrop-blur-md ${className}`}
         data-testid="trophy-progress-card"
      >
         {showTitle && (
            <div className="flex items-center justify-between pb-3 border-b border-obsidian-borderSubtle mb-4">
               <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-obsidian-textDim flex items-center gap-1.5">
                     <Sparkles className="h-3.5 w-3.5 text-economy-gold" />
                     Competitive Progression
                  </h4>
                  <p className="text-sm font-bold text-obsidian-text mt-0.5">
                     Rank & Trophy Milestones
                  </p>
               </div>
               <TrophyRoleBadge trophies={trophies} size="md" />
            </div>
         )}

         {/* Metric Numbers */}
         <div className="flex items-end justify-between mb-2">
            <div>
               <div className="text-2xl font-black font-display tracking-tight text-white flex items-center gap-2">
                  <span>🏆 {trophies.toLocaleString()}</span>
                  <span className="text-xs font-semibold text-obsidian-textMuted uppercase tracking-wider px-2 py-0.5 rounded-md bg-obsidian-elevated border border-obsidian-borderSubtle">
                     {role}
                  </span>
               </div>
            </div>

            <div className="text-right">
               {isMaxRank ? (
                  <span className="text-xs font-bold text-yellow-400">
                     Max Rank Reached
                  </span>
               ) : (
                  <span className="text-xs text-obsidian-textDim font-medium">
                     <strong className="text-obsidian-text font-bold">
                        {trophies.toLocaleString()}
                     </strong>{" "}
                     / {nextThreshold?.toLocaleString()}
                  </span>
               )}
            </div>
         </div>

         {/* Progress Bar Track */}
         <div
            className="relative h-3 w-full overflow-hidden rounded-full bg-obsidian-elevated border border-obsidian-borderSubtle shadow-inner"
            role="progressbar"
            aria-valuenow={progressPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progress to ${nextRole ?? "Max Rank"}: ${progressPercentage}%`}
         >
            <div
               className="h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 shadow-[0_0_12px_rgba(234,179,8,0.4)]"
               style={{ width: `${Math.max(4, progressPercentage)}%` }}
            />
         </div>

         {/* Footer caption */}
         <div className="mt-2.5 flex items-center justify-between text-xs text-obsidian-textDim">
            <span>Tier floor: {minTrophies.toLocaleString()}</span>
            {nextRole && (
               <span className="flex items-center gap-1 text-obsidian-textMuted font-medium">
                  <span>
                     <strong className="text-white font-semibold">
                        {trophiesToNext.toLocaleString()}
                     </strong>{" "}
                     trophies to {nextRole}
                  </span>
                  <ArrowUpRight className="h-3 w-3 text-economy-gold" />
               </span>
            )}
         </div>
      </div>
   );
}
