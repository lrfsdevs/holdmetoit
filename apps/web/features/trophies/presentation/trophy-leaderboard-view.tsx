"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
   Trophy,
   Crown,
   Medal,
   Search,
   ArrowUpDown,
   User as UserIcon,
   Flame,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DataPagination } from "@/components/ui/data-pagination";
import { TrophyRoleBadge } from "./trophy-role-badge";
import {
   filterLeaderboardEntries,
   LEADERBOARD_PAGE_SIZE,
   paginateLeaderboard,
   sortLeaderboardEntries,
   type LeaderboardSortKey,
   type SortDirection,
} from "../domain/leaderboard-query";
import type { TrophyLeaderboardEntry } from "../data/trophy.repository";

interface TrophyLeaderboardViewProps {
   initialEntries: TrophyLeaderboardEntry[];
   currentUserId?: string | null;
}

export function TrophyLeaderboardView({
   initialEntries = [],
   currentUserId,
}: TrophyLeaderboardViewProps) {
   const [searchQuery, setSearchQuery] = useState("");
   const [sortBy, setSortBy] = useState<LeaderboardSortKey>("trophies");
   const [sortDir, setSortDir] = useState<SortDirection>("desc");
   const [currentPage, setCurrentPage] = useState(1);

   const filtered = useMemo(
      () => filterLeaderboardEntries(initialEntries, searchQuery),
      [initialEntries, searchQuery]
   );
   const sorted = useMemo(
      () => sortLeaderboardEntries(filtered, sortBy, sortDir),
      [filtered, sortBy, sortDir]
   );
   const paginated = useMemo(
      () => paginateLeaderboard(sorted, currentPage),
      [sorted, currentPage]
   );

   const handleSearchChange = (value: string) => {
      setSearchQuery(value);
      setCurrentPage(1);
   };

   const handleSelectSort = (key: Exclude<LeaderboardSortKey, "name">) => {
      setSortBy(key);
      setSortDir("desc");
      setCurrentPage(1);
   };

   const handleToggleNameSort = () => {
      if (sortBy !== "name") {
         setSortBy("name");
         setSortDir("asc");
      } else {
         setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      }
      setCurrentPage(1);
   };

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
         <span className="font-mono text-xs font-bold text-text-tertiary">
            #{rank}
         </span>
      );
   };

   return (
      <div className="space-y-6 max-w-5xl mx-auto">
         {/* Hero Header */}
         <div className="rounded-3xl border border-border-default bg-surface-primary p-6 sm:p-8 shadow-xl backdrop-blur-md relative overflow-hidden">
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
                  <p className="text-xs text-text-tertiary mt-1 max-w-xl">
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
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
               <Input
                  type="text"
                  placeholder="Search participants by name or @username..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="rounded-xl border-border-default bg-surface-elevated pl-8 text-xs text-white placeholder:text-text-tertiary"
               />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-surface-elevated border border-border-subtle text-xs self-start sm:self-auto">
               <span className="text-meta text-text-tertiary px-2 font-medium">
                  Sort:
               </span>
               <button
                  type="button"
                  onClick={() => handleSelectSort("trophies")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                     sortBy === "trophies"
                        ? "bg-brand-1 text-black shadow-sm"
                        : "text-text-secondary hover:text-white"
                  }`}
               >
                  Trophies
               </button>
               <button
                  type="button"
                  onClick={() => handleSelectSort("winRate")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                     sortBy === "winRate"
                        ? "bg-brand-1 text-black shadow-sm"
                        : "text-text-secondary hover:text-white"
                  }`}
               >
                  Win Rate
               </button>
               <button
                  type="button"
                  onClick={() => handleSelectSort("wins")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                     sortBy === "wins"
                        ? "bg-brand-1 text-black shadow-sm"
                        : "text-text-secondary hover:text-white"
                  }`}
               >
                  Total Wins
               </button>
               <button
                  type="button"
                  onClick={handleToggleNameSort}
                  aria-label={
                     sortBy === "name" && sortDir === "desc"
                        ? "Sort by name descending"
                        : "Sort by name ascending"
                  }
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                     sortBy === "name"
                        ? "bg-brand-1 text-black shadow-sm"
                        : "text-text-secondary hover:text-white"
                  }`}
               >
                  <ArrowUpDown className="h-3 w-3" />
                  Name {sortBy === "name" && sortDir === "desc" ? "Z–A" : "A–Z"}
               </button>
            </div>
         </div>

         {/* Standings Table Card */}
         <div className="rounded-3xl border border-border-default bg-surface-primary p-4 sm:p-6 shadow-xl overflow-hidden">
            <div className="divide-y divide-border-subtle">
               {paginated.items.length === 0 ? (
                  <div className="py-16 text-center text-xs text-text-tertiary">
                     No competitive players found matching your search.
                  </div>
               ) : (
                  paginated.items.map((entry, idx) => {
                     const isSelf = currentUserId === entry.userId;
                     const displayRank = entry.rank;

                     return (
                        <div
                           key={entry.userId}
                           className={`py-3.5 px-3 flex items-center justify-between gap-3 text-xs rounded-2xl transition-colors ${
                              isSelf
                                 ? "bg-brand-1/10 border border-brand-1/30"
                                 : "hover:bg-surface-elevated/40"
                           }`}
                        >
                           {/* Left: Rank + Avatar + Name */}
                           <div className="flex items-center gap-3.5 min-w-0">
                              <div className="w-8 shrink-0 flex items-center justify-center">
                                 {getTopRankDecor(displayRank)}
                              </div>

                              <div className="relative h-10 w-10 rounded-2xl overflow-hidden bg-surface-elevated border border-border-default shrink-0">
                                 {entry.image ? (
                                    <Image
                                       src={entry.image}
                                       alt={entry.displayName}
                                       fill
                                       sizes="40px"
                                       className="object-cover"
                                    />
                                 ) : (
                                    <UserIcon className="h-5 w-5 m-auto text-text-tertiary" />
                                 )}
                              </div>

                              <div className="min-w-0">
                                 <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-white text-sm truncate">
                                       {entry.displayName}
                                    </span>
                                    {isSelf && (
                                       <span className="text-label bg-brand-1/20 text-brand-1 border border-brand-1/40 px-1.5 py-0.2 rounded font-bold">
                                          YOU
                                       </span>
                                    )}
                                 </div>
                                 <div className="text-meta text-text-tertiary flex items-center gap-2 mt-0.5">
                                    <span>@{entry.username}</span>
                                    <span>•</span>
                                    <span className="font-mono text-text-secondary">
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

            <DataPagination
               currentPage={paginated.page}
               totalPages={paginated.totalPages}
               totalItems={paginated.totalItems}
               pageSize={LEADERBOARD_PAGE_SIZE}
               onPageChange={setCurrentPage}
               itemLabel="players"
               className="mt-4"
            />
         </div>
      </div>
   );
}
