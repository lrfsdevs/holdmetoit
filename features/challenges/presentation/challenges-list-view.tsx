"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Users, Search, ChevronDown, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataPagination } from "@/components/ui/data-pagination";
import { ChallengeCardImage } from "@/features/challenges/presentation/challenge-card-image";
import type { ChallengeCatalogItem } from "@/features/challenges/data/challenge.repository";

export interface ChallengesListViewProps {
   challenges: ChallengeCatalogItem[];
   canManageChallenges?: boolean;
}

const PAGE_SIZE = 9;

export function ChallengesListView({
   challenges,
   canManageChallenges = false,
}: ChallengesListViewProps) {
   const [searchQuery, setSearchQuery] = useState("");
   const [statusFilter, setStatusFilter] = useState<
      "ALL" | "ACTIVE" | "UPCOMING" | "COMPLETED"
   >("ALL");
   const [formatFilter, setFormatFilter] = useState<
      "ALL" | "TEAM_VS_TEAM" | "SOLOS" | "DUOS" | "SQUADS"
   >("ALL");
   const [currentPage, setCurrentPage] = useState(1);

   const activeChallenges = challenges.filter((c) => !c.isDeleted);
   const countAll = activeChallenges.length;
   const countActive = activeChallenges.filter(
      (c) => c.status === "ACTIVE"
   ).length;
   const countUpcoming = activeChallenges.filter(
      (c) => c.status === "UPCOMING"
   ).length;
   const countCompleted = activeChallenges.filter(
      (c) => c.status === "COMPLETED"
   ).length;

   const filteredChallenges = activeChallenges.filter((c) => {
      // 1. Status Filter
      if (statusFilter !== "ALL" && c.status !== statusFilter) {
         return false;
      }

      // 2. Format Filter
      if (formatFilter !== "ALL" && c.format !== formatFilter) {
         return false;
      }

      // 3. Search Query
      const q = searchQuery.toLowerCase().trim();
      if (q) {
         const titleMatch = c.title.toLowerCase().includes(q);
         const formatMatch = c.format
            .toLowerCase()
            .replace(/_/g, " ")
            .includes(q);
         const hostMatch =
            (c.host?.displayName &&
               c.host.displayName.toLowerCase().includes(q)) ||
            (c.host?.username && c.host.username.toLowerCase().includes(q));
         const teamMatch = c.teams
            ?.filter((t) => !t.isDeleted)
            .some((t) => t.name.toLowerCase().includes(q));
         if (!titleMatch && !formatMatch && !hostMatch && !teamMatch) {
            return false;
         }
      }

      return true;
   });

   const hasActiveFilters =
      searchQuery.trim() !== "" ||
      statusFilter !== "ALL" ||
      formatFilter !== "ALL";

   const handleResetFilters = () => {
      setSearchQuery("");
      setStatusFilter("ALL");
      setFormatFilter("ALL");
      setCurrentPage(1);
   };

   const totalPages = Math.ceil(filteredChallenges.length / PAGE_SIZE) || 1;
   const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

   const paginatedChallenges = filteredChallenges.slice(
      (validCurrentPage - 1) * PAGE_SIZE,
      validCurrentPage * PAGE_SIZE
   );

   return (
      <div className="space-y-8 max-w-6xl mx-auto">
         {/* 1. Back Navigation */}
         <div>
            <Link
               href="/"
               className="inline-flex items-center gap-1.5 text-sm font-medium text-white underline underline-offset-4 hover:text-[#d1d1d1] transition-colors"
            >
               <span>← Back</span>
            </Link>
         </div>

         {/* 2. Action Controls (Visible ONLY to Admins/Mods when not in preview mode) */}
         {canManageChallenges && (
            <div
               className="flex flex-wrap items-center gap-6 sm:gap-8"
               data-testid="admin-challenge-actions"
            >
               <Link
                  href="/admin/challenges/new"
                  className="flex h-[74px] w-full sm:w-[253px] items-center justify-center gap-3 rounded-[20px] bg-[#1d1d1d] hover:bg-[#262626] border border-[#2e2e2e] text-white text-[15px] font-medium transition-all shadow-sm"
               >
                  <Plus className="h-4 w-4 stroke-[2.5]" />
                  <span>Create Challenge</span>
               </Link>

               <button
                  type="button"
                  className="flex h-[74px] w-full sm:w-[253px] items-center justify-center gap-3 rounded-[20px] bg-[#1d1d1d] hover:bg-[#262626] border border-[#2e2e2e] text-white text-[15px] font-medium transition-all shadow-sm"
               >
                  <span className="h-4 w-4 rounded-full bg-[#ff0000] shrink-0" />
                  <span>Change Accent Color</span>
               </button>
            </div>
         )}

         {/* 3. Events Section Header & Search/Filters */}
         <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
               <div>
                  <h2 className="inline-block text-2xl font-extrabold text-[#ffffff] tracking-tight border-b-2 border-white pb-1.5">
                     Events
                  </h2>
               </div>

               {/* Status Filter Tabs */}
               {challenges.length > 0 && (
                  <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#141414] border border-[#262626] overflow-x-auto max-w-full">
                     <button
                        type="button"
                        onClick={() => {
                           setStatusFilter("ALL");
                           setCurrentPage(1);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                           statusFilter === "ALL"
                              ? "bg-[#292929] text-white shadow-sm border border-[#383838]"
                              : "text-[#868686] hover:text-white"
                        }`}
                     >
                        All ({countAll})
                     </button>
                     <button
                        type="button"
                        onClick={() => {
                           setStatusFilter("ACTIVE");
                           setCurrentPage(1);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                           statusFilter === "ACTIVE"
                              ? "bg-[#144520] text-[#85ff93] border border-[#22c55e]/40"
                              : "text-[#868686] hover:text-[#85ff93]"
                        }`}
                     >
                        <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
                        Active ({countActive})
                     </button>
                     <button
                        type="button"
                        onClick={() => {
                           setStatusFilter("UPCOMING");
                           setCurrentPage(1);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                           statusFilter === "UPCOMING"
                              ? "bg-[#102d40] text-[#85d6ff] border border-[#3b82f6]/40"
                              : "text-[#868686] hover:text-[#85d6ff]"
                        }`}
                     >
                        <span className="h-1.5 w-1.5 rounded-full bg-[#3b82f6]" />
                        Upcoming ({countUpcoming})
                     </button>
                     <button
                        type="button"
                        onClick={() => {
                           setStatusFilter("COMPLETED");
                           setCurrentPage(1);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                           statusFilter === "COMPLETED"
                              ? "bg-[#292929] text-[#bcbcbc] border border-[#434343]"
                              : "text-[#868686] hover:text-[#bcbcbc]"
                        }`}
                     >
                        Completed ({countCompleted})
                     </button>
                  </div>
               )}
            </div>

            {/* Search and Format Filter Bar */}
            {challenges.length > 0 && (
               <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="relative flex-1">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#868686]" />
                     <Input
                        type="text"
                        placeholder="Search challenges by title, format, host, team..."
                        value={searchQuery}
                        onChange={(e) => {
                           setSearchQuery(e.target.value);
                           setCurrentPage(1);
                        }}
                        className="h-10 pl-9 pr-8 bg-[#141414] border-[#292929] text-white placeholder:text-[#868686] text-xs rounded-xl"
                     />
                     {searchQuery && (
                        <button
                           type="button"
                           onClick={() => {
                              setSearchQuery("");
                              setCurrentPage(1);
                           }}
                           className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#868686] hover:text-white p-0.5"
                        >
                           <X className="h-3.5 w-3.5" />
                        </button>
                     )}
                  </div>

                  <div className="relative w-full sm:w-48 shrink-0">
                     <select
                        value={formatFilter}
                        onChange={(e) => {
                           setFormatFilter(
                              e.target.value as
                                 | "ALL"
                                 | "TEAM_VS_TEAM"
                                 | "SOLOS"
                                 | "DUOS"
                                 | "SQUADS"
                           );
                           setCurrentPage(1);
                        }}
                        className="h-10 w-full rounded-xl border border-[#292929] bg-[#141414] px-3 pr-8 text-xs text-[#ffffff] focus:border-[#ffffff]/60 focus:outline-none appearance-none cursor-pointer"
                     >
                        <option value="ALL">All Formats</option>
                        <option value="TEAM_VS_TEAM">Team vs Team</option>
                        <option value="SOLOS">Solo Battles</option>
                        <option value="DUOS">Duo Battles</option>
                        <option value="SQUADS">Squad Battles</option>
                     </select>
                     <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#868686] pointer-events-none" />
                  </div>

                  {hasActiveFilters && (
                     <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleResetFilters}
                        className="h-10 px-3 text-xs rounded-xl border-[#383838] bg-[#1c1c1c] hover:bg-[#292929] text-[#d1d1d1] shrink-0"
                     >
                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                        Reset
                     </Button>
                  )}
               </div>
            )}
         </div>

         {/* 4. 3-Column Card Grid */}
         {challenges.length === 0 ? (
            <div className="rounded-3xl border border-[#262626] bg-[#141414] p-12 text-center space-y-4">
               <p className="text-sm text-[#868686]">
                  {canManageChallenges
                     ? "No challenges created yet."
                     : "No challenges active yet. Check back soon for upcoming events!"}
               </p>
               {canManageChallenges ? (
                  <Button
                     asChild
                     className="h-10 px-6 rounded-full bg-[#ffffff] text-[#0d0d0d] font-bold"
                  >
                     <Link href="/admin/challenges/new">
                        Create First Challenge
                     </Link>
                  </Button>
               ) : (
                  <Button
                     asChild
                     className="h-10 px-6 rounded-full bg-[#262626] hover:bg-[#333333] text-white text-xs font-semibold"
                  >
                     <Link href="/">Back to Home</Link>
                  </Button>
               )}
            </div>
         ) : filteredChallenges.length === 0 ? (
            <div className="rounded-3xl border border-[#262626] bg-[#141414] p-12 text-center space-y-3">
               <p className="text-sm font-semibold text-white">
                  No challenges match your search and filter criteria.
               </p>
               <p className="text-xs text-[#868686]">
                  Try adjusting your search terms or clearing status and format
                  filters.
               </p>
               <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetFilters}
                  className="rounded-full border-[#383838] bg-[#242424] hover:bg-[#333333] text-white text-xs"
               >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Reset all filters
               </Button>
            </div>
         ) : (
            <div className="space-y-6">
               <div
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                  data-testid="challenges-grid"
               >
                  {paginatedChallenges.map((c) => {
                     const formattedDate = new Date(
                        c.startAt
                     ).toLocaleDateString("en-US", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        timeZone: "UTC",
                     });

                     const statusLabel =
                        c.status === "ACTIVE"
                           ? "Ongoing"
                           : c.status === "UPCOMING"
                             ? "Upcoming"
                             : "Completed";

                     const statusStyle =
                        c.status === "ACTIVE"
                           ? "bg-[#3a6a35] border-[#468c46] text-[#85ff93]"
                           : c.status === "UPCOMING"
                             ? "bg-[#35596a] border-[#46748c] text-[#85d6ff]"
                             : "bg-[#292929] border-[#434343] text-[#bcbcbc]";

                     return (
                        <div
                           key={c.id}
                           className="rounded-2xl border border-[#262626] bg-[#141414] overflow-hidden shadow-lg flex flex-col justify-between hover:border-[#383838] transition-all group"
                           data-testid={`challenge-card-${c.id}`}
                        >
                           {/* Banner Thumbnail */}
                           <ChallengeCardImage
                              key={c.eventBannerUrl}
                              src={c.eventBannerUrl?.trim() || null}
                              title={c.title}
                           />

                           {/* Card Content */}
                           <div className="p-5 bg-[#1d1d1d] space-y-4 flex-1 flex flex-col justify-between">
                              <div>
                                 <h3 className="text-base font-bold text-[#ffffff] truncate">
                                    {c.title}
                                 </h3>

                                 {/* Metadata Badges Row */}
                                 <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <span className="flex items-center gap-1.5 text-xs text-[#ffffff]">
                                       <Users className="h-3.5 w-3.5 text-[#868686]" />
                                       <span>{c._count.participants}</span>
                                    </span>

                                    <span
                                       className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusStyle}`}
                                    >
                                       {statusLabel}
                                    </span>

                                    <span className="inline-flex items-center rounded-full border border-[#46748c] bg-[#35596a] px-2.5 py-0.5 font-sans font-medium text-[11px] text-[#85d6ff]">
                                       {formattedDate}
                                    </span>
                                 </div>
                              </div>

                              {/* Actions Footer */}
                              <div className="pt-2 flex items-center">
                                 <Button
                                    asChild
                                    className="h-9 w-full rounded-xl bg-[#3d3d3d] border border-[#545454] text-[#ffffff] hover:bg-[#4a4a4a] text-xs font-semibold"
                                 >
                                    <Link href={`/challenge/${c.id}`}>
                                       View Challenge
                                    </Link>
                                 </Button>
                              </div>
                           </div>
                        </div>
                     );
                  })}
               </div>

               {/* Pagination Controls */}
               <DataPagination
                  currentPage={validCurrentPage}
                  totalPages={totalPages}
                  totalItems={filteredChallenges.length}
                  pageSize={PAGE_SIZE}
                  itemLabel="challenges"
                  onPageChange={setCurrentPage}
               />
            </div>
         )}
      </div>
   );
}
