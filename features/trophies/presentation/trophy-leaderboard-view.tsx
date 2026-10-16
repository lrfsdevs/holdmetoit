"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
   Trophy,
   Crown,
   Medal,
   Search,
   Sparkles,
   ArrowUpDown,
   User as UserIcon,
   Flame,
   ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TrophyRoleBadge } from "./trophy-role-badge";
import type { TrophyLeaderboardEntry } from "../data/trophy.repository";

interface TrophyLeaderboardViewProps {
   initialEntries: TrophyLeaderboardEntry[];
   initialPagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
   };
   currentUserId?: string | null;
}

export function TrophyLeaderboardView({
   initialEntries = [],
   initialPagination,
   currentUserId,
}: TrophyLeaderboardViewProps) {
   const [searchQuery, setSearchQuery] = useState("");
   const [sortBy, setSortBy] = useState<"trophies" | "winRate" | "wins">(
      "trophies"
   );

   const filtered = initialEntries
      .filter((e) => {
         if (!searchQuery.trim()) return true;
         const q = searchQuery.toLowerCase();
         return (
            e.displayName.toLowerCase().includes(q) ||
            e.username.toLowerCase().includes(q)
         );
      })
      .sort((a, b) => {
         if (sortBy === "winRate") {
            return b.winRate - a.winRate;
         }
         if (sortBy === "wins") {
            return b.wins - a.wins;
         }
         return b.trophyBalance - a.trophyBalance;
      });

   const getTopRankDecor = (rank: number) => {
      if (rank === 1) {
         return (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-yellow-400/20 text-yellow-400 border border-yellow-400/40 shadow-[0_0_12px_rgba(250,204,21,0.3)]">
               <Crown className="h-4 w-4" />
            </div>
         );
      }
      if (rank === 2) {
         return (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-300/20 text-slate-300 border border-slate-300/40">
               <Medal className="h-4 w-4" />
            </div>
         );
      }
      if (rank === 3) {
         return (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-600/20 text-amber-500 border border-amber-600/40">
               <Medal className="h-4 w-4" />
            </div>
         );
      }
      return (
         <span className="font-mono text-xs font-bold text-obsidian-textDim">
            #{rank}
         </span>
      );
   };

   return (
      <div className="space-y-6 max-w-5xl mx-auto">
         {/* Hero Header */}
         <div className="rounded-3xl border border-obsidian-border bg-obsidian-card p-6 sm:p-8 shadow-xl backdrop-blur-md relative overflow-hidden">
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-yellow-500/10 blur-3xl" />
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
               <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-400 mb-3">
                     <Trophy className="h-3.5 w-3.5" />
                     <span>Clash of Clans Style League</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-white">
                     Group Trophy Leaderboard
                  </h1>
                  <p className="text-xs text-obsidian-textDim mt-1 max-w-xl">
                     Competitive standings and player ratings across HoldMeToIt.
                     Challenge victories yield +25 trophies, defeats incur -15
                     trophies.
                  </p>
               </div>

               <div className="flex items-center gap-2">
                  <Link href="/challenges">
                     <Button
                        type="button"
                        variant="gold"
                        size="sm"
                        className="rounded-xl text-xs font-bold gap-1.5"
                     >
                        <Flame className="h-3.5 w-3.5" />
                        Join Active Battles
                     </Button>
                  </Link>
               </div>
            </div>
         </div>

         {/* Filtering & Sorting Controls */}
         <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-obsidian-textDim" />
               <Input
                  type="text"
                  placeholder="Search participants by name or @username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-xl border-obsidian-border bg-obsidian-elevated pl-8 text-xs text-white placeholder:text-obsidian-textDim"
               />
            </div>

            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-obsidian-elevated border border-obsidian-borderSubtle text-xs self-start sm:self-auto">
               <span className="text-[11px] text-obsidian-textDim px-2 font-medium">
                  Sort:
               </span>
               <button
                  type="button"
                  onClick={() => setSortBy("trophies")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                     sortBy === "trophies"
                        ? "bg-economy-gold text-black shadow-sm"
                        : "text-obsidian-textMuted hover:text-white"
                  }`}
               >
                  Trophies
               </button>
               <button
                  type="button"
                  onClick={() => setSortBy("winRate")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                     sortBy === "winRate"
                        ? "bg-economy-gold text-black shadow-sm"
                        : "text-obsidian-textMuted hover:text-white"
                  }`}
               >
                  Win Rate
               </button>
               <button
                  type="button"
                  onClick={() => setSortBy("wins")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                     sortBy === "wins"
                        ? "bg-economy-gold text-black shadow-sm"
                        : "text-obsidian-textMuted hover:text-white"
                  }`}
               >
                  Total Wins
               </button>
            </div>
         </div>

         {/* Standings Table Card */}
         <div className="rounded-3xl border border-obsidian-border bg-obsidian-card p-4 sm:p-6 shadow-xl overflow-hidden">
            <div className="divide-y divide-obsidian-borderSubtle">
               {filtered.length === 0 ? (
                  <div className="py-16 text-center text-xs text-obsidian-textDim">
                     No competitive players found matching your search.
                  </div>
               ) : (
                  filtered.map((entry, idx) => {
                     const isSelf = currentUserId === entry.userId;
                     const displayRank = entry.rank;

                     return (
                        <div
                           key={entry.userId}
                           className={`py-3.5 px-3 flex items-center justify-between gap-3 text-xs rounded-2xl transition-colors ${
                              isSelf
                                 ? "bg-economy-gold/10 border border-economy-gold/30"
                                 : "hover:bg-obsidian-elevated/40"
                           }`}
                        >
                           {/* Left: Rank + Avatar + Name */}
                           <div className="flex items-center gap-3.5 min-w-0">
                              <div className="w-8 shrink-0 flex items-center justify-center">
                                 {getTopRankDecor(displayRank)}
                              </div>

                              <div className="relative h-10 w-10 rounded-2xl overflow-hidden bg-obsidian-elevated border border-obsidian-border shrink-0">
                                 {entry.image ? (
                                    <Image
                                       src={entry.image}
                                       alt={entry.displayName}
                                       fill
                                       sizes="40px"
                                       className="object-cover"
                                    />
                                 ) : (
                                    <UserIcon className="h-5 w-5 m-auto text-obsidian-textDim" />
                                 )}
                              </div>

                              <div className="min-w-0">
                                 <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-white text-sm truncate">
                                       {entry.displayName}
                                    </span>
                                    {isSelf && (
                                       <span className="text-[10px] bg-economy-gold/20 text-economy-gold border border-economy-gold/40 px-1.5 py-0.2 rounded font-bold">
                                          YOU
                                       </span>
                                    )}
                                 </div>
                                 <div className="text-[11px] text-obsidian-textDim flex items-center gap-2 mt-0.5">
                                    <span>@{entry.username}</span>
                                    <span>•</span>
                                    <span className="font-mono text-obsidian-textMuted">
                                       {entry.wins}W / {entry.losses}L (
                                       {entry.winRate}%)
                                    </span>
                                 </div>
                              </div>
                           </div>

                           {/* Right: Role Badge + Trophies */}
                           <div className="flex items-center gap-3 shrink-0">
                              <TrophyRoleBadge
                                 trophies={entry.trophyBalance}
                                 size="md"
                              />
                           </div>
                        </div>
                     );
                  })
               )}
            </div>
         </div>
      </div>
   );
}
