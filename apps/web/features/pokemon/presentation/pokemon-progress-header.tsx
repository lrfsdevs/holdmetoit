"use client";

import React from "react";
import { CollectionProgressResult } from "../domain/collection-progress";
import { Award, BookOpen, Compass, Sparkles, Trophy } from "lucide-react";

interface PokemonProgressHeaderProps {
   progress: CollectionProgressResult | null;
   isSpectator?: boolean;
}

export function PokemonProgressHeader({
   progress,
   isSpectator = false,
}: PokemonProgressHeaderProps) {
   const percentage = progress?.completionPercentage ?? 0;
   const uniqueCount = progress?.uniqueOwnedCount ?? 0;
   const totalAvailable = progress?.totalAvailableCount ?? 0;
   const totalInstances = progress?.totalInstancesCount ?? 0;

   const getTierBadge = (tier?: string) => {
      switch (tier) {
         case "CHAMPION":
            return {
               label: "Pokédex Champion",
               classes:
                  "bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-rose-500/20",
               icon: Trophy,
            };
         case "MASTER":
            return {
               label: "Master Collector",
               classes:
                  "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-amber-500/20",
               icon: Award,
            };
         case "COLLECTOR":
            return {
               label: "Avid Collector",
               classes:
                  "bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-sky-500/20",
               icon: Sparkles,
            };
         default:
            return {
               label: "Apprentice Trainer",
               classes:
                  "bg-slate-700/30 text-slate-300 border-slate-600/50 shadow-slate-500/10",
               icon: Compass,
            };
      }
   };

   const tierInfo = getTierBadge(progress?.tier);
   const TierIcon = tierInfo.icon;

   return (
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-pokedex-elevated to-pokedex-bg border border-pokedex-border p-5 sm:p-7 shadow-xl shadow-black/40">
         {/* Ambient background glow */}
         <div className="absolute -top-24 -right-24 w-80 h-80 bg-pokedex-accentPurple/15 rounded-full blur-3xl pointer-events-none" />
         <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-pokedex-accentRose/10 rounded-full blur-3xl pointer-events-none" />

         <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            {/* Left header details */}
            <div className="space-y-2">
               <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-rose-500 to-amber-500 text-white shadow-md shadow-rose-500/20">
                     <BookOpen className="h-4 w-4" />
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-pokedex-text">
                     Pokédex &amp; Collection
                  </h1>
                  {!isSpectator && (
                     <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border shadow-sm ${tierInfo.classes}`}
                     >
                        <TierIcon className="w-3 h-3" />
                        {tierInfo.label}
                     </span>
                  )}
               </div>
               <p className="text-xs sm:text-sm text-pokedex-textMuted max-w-xl">
                  Catalogue of discovered species and your personal collection.
                  Study diligently, earn coins, and work toward uncovering rare
                  and mythical companions.
               </p>
            </div>

            {/* Right metrics / Spectator banner */}
            {isSpectator ? (
               <div className="rounded-xl bg-pokedex-inset/80 border border-pokedex-border p-4 text-xs text-pokedex-textMuted max-w-sm">
                  <span className="font-semibold text-white block mb-1">
                     Spectator Mode
                  </span>
                  Sign in with Discord to track your owned Pokémon, record
                  discoveries, and monitor your Pokédex completion progress.
               </div>
            ) : (
               <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-pokedex-inset/60 border border-pokedex-border/80 rounded-xl p-4 sm:p-5">
                  {/* Progress gauge */}
                  <div className="space-y-2 w-full sm:w-48">
                     <div className="flex justify-between items-center text-xs">
                        <span className="text-pokedex-textMuted font-medium">
                           Completion
                        </span>
                        <span className="text-sm font-bold text-white">
                           {percentage}%
                        </span>
                     </div>
                     <div className="w-full h-2.5 bg-pokedex-card rounded-full overflow-hidden border border-pokedex-borderLight">
                        <div
                           className="h-full bg-gradient-to-r from-purple-500 via-rose-500 to-amber-400 rounded-full transition-all duration-700 ease-out shadow-sm shadow-rose-500/50"
                           style={{ width: `${percentage}%` }}
                        />
                     </div>
                  </div>

                  {/* Quick counters */}
                  <div className="flex items-center gap-4 border-t sm:border-t-0 sm:border-l border-pokedex-border pt-3 sm:pt-0 sm:pl-4">
                     <div>
                        <span className="block text-[11px] uppercase tracking-wider text-pokedex-textMuted">
                           Species
                        </span>
                        <span className="text-lg font-bold text-white">
                           {uniqueCount}{" "}
                           <span className="text-xs font-normal text-pokedex-textDim">
                              / {totalAvailable}
                           </span>
                        </span>
                     </div>
                     <div>
                        <span className="block text-[11px] uppercase tracking-wider text-pokedex-textMuted">
                           Total Owned
                        </span>
                        <span className="text-lg font-bold text-economy-gold">
                           {totalInstances}
                        </span>
                     </div>
                  </div>
               </div>
            )}
         </div>
      </div>
   );
}
