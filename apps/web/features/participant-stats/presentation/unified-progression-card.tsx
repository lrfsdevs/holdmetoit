"use client";

import React from "react";
import Link from "next/link";
import {
   Trophy,
   Coins,
   Clock,
   CheckCircle2,
   AlertCircle,
   Clock3,
   ExternalLink,
   TrendingUp,
   Swords,
} from "lucide-react";
import type { ParticipantCompetitiveStats } from "../domain/participant-stats.types";
import { TrophyRoleBadge } from "@/features/trophies/presentation/trophy-role-badge";
import { TrophyProgressBar } from "@/features/trophies/presentation/trophy-progress-bar";
import { TrophyHistoryList } from "@/features/trophies/presentation/trophy-history-list";
import { CoinsIcon } from "@/features/economy/presentation/coins-icon";

interface UnifiedProgressionCardProps {
   competitive?: ParticipantCompetitiveStats | null;
   displayName: string;
   className?: string;
}

function formatStudyDuration(seconds: number): string {
   const totalHours = Math.floor(seconds / 3600);
   const remainingMinutes = Math.floor((seconds % 3600) / 60);
   return `${totalHours}h ${remainingMinutes}m`;
}

export function UnifiedProgressionCard({
   competitive,
   displayName,
   className = "",
}: UnifiedProgressionCardProps) {
   if (!competitive) return null;

   const {
      trophies,
      role,
      wins,
      losses,
      winRate,
      coins,
      totalStudySeconds,
      yptStatus,
      yptId,
      trophyHistory = [],
   } = competitive;

   return (
      <div
         className={`space-y-6 ${className}`}
         data-testid="unified-progression-card"
      >
         {/* Section Header */}
         <div className="flex items-center justify-between">
            <div>
               <h3 className="text-lg font-bold font-display text-text-primary flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-brand-1" />
                  Progression & Identity
               </h3>
               <p className="text-xs text-text-tertiary">
                  Three independent progression systems: Competitive, Study, and
                  Virtual Economy.
               </p>
            </div>
            <Link
               href="/leaderboard"
               className="text-xs text-brand-1 hover:underline flex items-center gap-1 font-medium"
            >
               <span>Trophy Leaderboard</span>
               <ExternalLink className="h-3 w-3" />
            </Link>
         </div>

         {/* 3 Pillar Cards Grid */}
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Competitive Progression */}
            <div className="rounded-2xl border border-border-default bg-surface-primary p-5 shadow-lg flex flex-col justify-between">
               <div>
                  <div className="flex items-center justify-between mb-3">
                     <span className="text-label font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Swords className="h-3 w-3" />
                        Competitive
                     </span>
                     <TrophyRoleBadge trophies={trophies} size="sm" />
                  </div>

                  <div className="text-2xl font-black font-display text-white flex items-baseline gap-1.5">
                     <span>🏆 {trophies.toLocaleString()}</span>
                     <span className="text-xs text-text-tertiary font-normal">
                        Trophies
                     </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-border-subtle text-center">
                     <div>
                        <div className="text-xs font-bold text-emerald-400">
                           {wins}
                        </div>
                        <div className="text-label uppercase text-text-secondary tracking-wider">
                           Wins
                        </div>
                     </div>
                     <div>
                        <div className="text-xs font-bold text-rose-400">
                           {losses}
                        </div>
                        <div className="text-label uppercase text-text-secondary tracking-wider">
                           Losses
                        </div>
                     </div>
                     <div>
                        <div className="text-xs font-bold text-sky-400">
                           {winRate}%
                        </div>
                        <div className="text-label uppercase text-text-secondary tracking-wider">
                           Win Rate
                        </div>
                     </div>
                  </div>
               </div>

               <p className="text-meta text-text-secondary mt-4 pt-3 border-t border-border-subtle">
                  Earned & lost exclusively through challenge victories and
                  defeats.
               </p>
            </div>

            {/* 2. Study Progression */}
            <div className="rounded-2xl border border-border-default bg-surface-primary p-5 shadow-lg flex flex-col justify-between">
               <div>
                  <div className="flex items-center justify-between mb-3">
                     <span className="text-label font-bold uppercase tracking-wider text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Study
                     </span>
                     {yptStatus === "VERIFIED" ? (
                        <span className="inline-flex items-center gap-1 text-meta font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                           <CheckCircle2 className="h-3 w-3" />✓ Verified
                        </span>
                     ) : yptStatus === "PENDING" ? (
                        <span className="inline-flex items-center gap-1 text-meta font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                           <Clock3 className="h-3 w-3" />
                           Pending
                        </span>
                     ) : (
                        <span className="inline-flex items-center gap-1 text-meta font-semibold text-text-secondary bg-surface-elevated px-2 py-0.5 rounded-full">
                           <AlertCircle className="h-3 w-3" />
                           Not Linked
                        </span>
                     )}
                  </div>

                  <div className="text-2xl font-black font-display text-white">
                     {formatStudyDuration(totalStudySeconds)}
                  </div>
                  <div className="text-xs text-text-tertiary mt-0.5">
                     Total Verified Study Time
                  </div>

                  {yptId && (
                     <div className="mt-4 pt-3 border-t border-border-subtle text-xs text-text-secondary flex items-center justify-between">
                        <span>YPT ID</span>
                        <span className="font-mono text-text-primary font-semibold">
                           {yptId}
                        </span>
                     </div>
                  )}
               </div>

               <p className="text-meta text-text-secondary mt-4 pt-3 border-t border-border-subtle">
                  Automatically synchronized from the companion bot. Manual
                  inputs disabled.
               </p>
            </div>

            {/* 3. Virtual Economy */}
            <div className="rounded-2xl border border-border-default bg-surface-primary p-5 shadow-lg flex flex-col justify-between">
               <div>
                  <div className="flex items-center justify-between mb-3">
                     <span className="text-label font-bold uppercase tracking-wider text-brand-1 bg-brand-1/10 border border-brand-1/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Coins className="h-3 w-3" />
                        Economy
                     </span>
                     <Link
                        href="/wallet"
                        className="text-meta text-brand-1 hover:underline flex items-center gap-1"
                     >
                        <span>Wallet</span>
                        <ExternalLink className="h-3 w-3" />
                     </Link>
                  </div>

                  <div className="text-2xl font-black font-display text-white flex items-center gap-2">
                     <CoinsIcon className="h-6 w-6 text-brand-1" />
                     <span>{coins.toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-text-tertiary mt-0.5">
                     Available Coin Balance
                  </div>
               </div>

               <p className="text-meta text-text-secondary mt-4 pt-3 border-t border-border-subtle">
                  Earned from study sync and challenges. Non-convertible to
                  trophies.
               </p>
            </div>
         </div>

         {/* Trophy Progression Bar */}
         <TrophyProgressBar trophies={trophies} />

         {/* Trophy History Ledger */}
         <div className="space-y-3">
            <h4 className="text-sm font-bold font-display text-text-primary flex items-center gap-1.5">
               <Trophy className="h-4 w-4 text-amber-400" />
               Recent Trophy Ledger Entries
            </h4>
            <TrophyHistoryList
               transactions={trophyHistory.map((t) => ({
                  id: t.id,
                  amount: t.amount,
                  balanceAfter: t.balanceAfter,
                  type: t.type,
                  description: t.description || "Challenge match result",
                  createdAt: t.createdAt,
               }))}
            />
         </div>
      </div>
   );
}
