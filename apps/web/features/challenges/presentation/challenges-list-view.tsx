"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Users, Search, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@/components/ui/select";
import { DataPagination } from "@/components/ui/data-pagination";
import { ChallengeCardImage } from "@/features/challenges/presentation/challenge-card-image";
import type { ChallengeCatalogItem } from "@/features/challenges/data/challenge.repository";

export interface ChallengesListViewProps {
   challenges: ChallengeCatalogItem[];
   canManageChallenges?: boolean;
}

const PAGE_SIZE = 9;

/** Renders the public challenge directory with filtering and pagination. */
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
               className="inline-flex items-center gap-1.5 text-sm font-medium text-white underline underline-offset-4 hover:text-text-secondary transition-colors"
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
                  className="flex h-control-lg w-full sm:w-[253px] items-center justify-center gap-3 rounded-[20px] bg-surface-elevated hover:bg-surface-nested border border-border-strong text-white text-body font-medium transition-all shadow-sm"
               >
                  <Plus className="h-4 w-4 stroke-[2.5]" />
                  <span>Create Challenge</span>
               </Link>

               <button
                  type="button"
                  className="flex h-control-lg w-full sm:w-[253px] items-center justify-center gap-3 rounded-[20px] bg-surface-elevated hover:bg-surface-nested border border-border-strong text-white text-body font-medium transition-all shadow-sm"
               >
                  <span className="h-4 w-4 rounded-full bg-feedback-error shrink-0" />
                  <span>Change Accent Color</span>
               </button>
            </div>
         )}

         {/* 3. Events Section Header & Search/Filters */}
         <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
               <div>
                  <h2 className="inline-block text-2xl font-extrabold text-white tracking-tight border-b-2 border-white pb-1.5">
                     Events
                  </h2>
               </div>

               {/* Status Filter Tabs */}
               {challenges.length > 0 && (
                  <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-surface-primary border border-border-default overflow-x-auto max-w-full">
                     <button
                        type="button"
                        onClick={() => {
                           setStatusFilter("ALL");
                           setCurrentPage(1);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                           statusFilter === "ALL"
                              ? "bg-surface-nested text-white shadow-sm border border-border-strong"
                              : "text-text-tertiary hover:text-white"
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
                              ? "bg-feedback-success-bg text-feedback-success-text border border-feedback-success/40"
                              : "text-text-tertiary hover:text-feedback-success-text"
                        }`}
                     >
                        <span className="h-1.5 w-1.5 rounded-full bg-feedback-success" />
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
                              ? "bg-feedback-info-bg text-feedback-info-text border border-feedback-info/40"
                              : "text-text-tertiary hover:text-feedback-info-text"
                        }`}
                     >
                        <span className="h-1.5 w-1.5 rounded-full bg-feedback-info" />
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
                              ? "bg-surface-nested text-text-secondary border border-border-strong"
                              : "text-text-tertiary hover:text-text-secondary"
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
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
                     <Input
                        type="text"
                        placeholder="Search challenges by title, format, host, team..."
                        value={searchQuery}
                        onChange={(e) => {
                           setSearchQuery(e.target.value);
                           setCurrentPage(1);
                        }}
                        className="h-10 pl-9 pr-8 bg-surface-primary border-border-default text-white placeholder:text-text-tertiary text-xs rounded-xl"
                     />
                     {searchQuery && (
                        <button
                           type="button"
                           onClick={() => {
                              setSearchQuery("");
                              setCurrentPage(1);
                           }}
                           className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-white p-0.5"
                        >
                           <X className="h-3.5 w-3.5" />
                        </button>
                     )}
                  </div>

                  <div className="w-full sm:w-48 shrink-0">
                     <Select
                        value={formatFilter}
                        onValueChange={(value) => {
                           setFormatFilter(
                              value as
                                 | "ALL"
                                 | "TEAM_VS_TEAM"
                                 | "SOLOS"
                                 | "DUOS"
                                 | "SQUADS"
                           );
                           setCurrentPage(1);
                        }}
                     >
                        <SelectTrigger
                           data-testid="challenges-format-select"
                           className="h-10 rounded-xl border-border-default bg-surface-primary text-xs text-white"
                        >
                           <SelectValue placeholder="All Formats" />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="ALL">All Formats</SelectItem>
                           <SelectItem value="TEAM_VS_TEAM">
                              Team vs Team
                           </SelectItem>
                           <SelectItem value="SOLOS">Solo Battles</SelectItem>
                           <SelectItem value="DUOS">Duo Battles</SelectItem>
                           <SelectItem value="SQUADS">Squad Battles</SelectItem>
                        </SelectContent>
                     </Select>
                  </div>

                  {hasActiveFilters && (
                     <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleResetFilters}
                        className="h-10 px-3 text-xs rounded-xl border-border-strong bg-surface-elevated hover:bg-surface-nested text-text-secondary shrink-0"
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
            <div className="rounded-3xl border border-border-default bg-surface-primary p-12 text-center space-y-4">
               <p className="text-sm text-text-tertiary">
                  {canManageChallenges
                     ? "No challenges created yet."
                     : "No challenges active yet. Check back soon for upcoming events!"}
               </p>
               {canManageChallenges ? (
                  <Button
                     asChild
                     className="h-10 px-6 rounded-full bg-white text-text-inverse font-bold"
                  >
                     <Link href="/admin/challenges/new">
                        Create First Challenge
                     </Link>
                  </Button>
               ) : (
                  <Button
                     asChild
                     className="h-10 px-6 rounded-full bg-surface-nested hover:bg-surface-nested text-white text-xs font-semibold"
                  >
                     <Link href="/">Back to Home</Link>
                  </Button>
               )}
            </div>
         ) : filteredChallenges.length === 0 ? (
            <div className="rounded-3xl border border-border-default bg-surface-primary p-12 text-center space-y-3">
               <p className="text-sm font-semibold text-white">
                  No challenges match your search and filter criteria.
               </p>
               <p className="text-xs text-text-tertiary">
                  Try adjusting your search terms or clearing status and format
                  filters.
               </p>
               <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetFilters}
                  className="rounded-full border-border-strong bg-surface-nested hover:bg-surface-nested text-white text-xs"
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
                           ? "bg-feedback-success border-feedback-success text-feedback-success-text"
                           : c.status === "UPCOMING"
                             ? "bg-feedback-info border-feedback-info text-feedback-info-text"
                             : "bg-surface-nested border-border-strong text-text-secondary";

                     return (
                        <div
                           key={c.id}
                           className="rounded-2xl border border-border-default bg-surface-primary overflow-hidden shadow-lg flex flex-col justify-between hover:border-border-strong transition-all group"
                           data-testid={`challenge-card-${c.id}`}
                        >
                           {/* Banner Thumbnail */}
                           <ChallengeCardImage
                              key={c.eventBannerUrl}
                              src={c.eventBannerUrl?.trim() || null}
                              title={c.title}
                           />

                           {/* Card Content */}
                           <div className="p-5 bg-surface-elevated space-y-4 flex-1 flex flex-col justify-between">
                              <div>
                                 <h3 className="text-base font-bold text-white truncate">
                                    {c.title}
                                 </h3>

                                 {/* Metadata Badges Row */}
                                 <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <span className="flex items-center gap-1.5 text-xs text-white">
                                       <Users className="h-3.5 w-3.5 text-text-tertiary" />
                                       <span>{c._count.participants}</span>
                                    </span>

                                    <span
                                       className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-meta font-semibold ${statusStyle}`}
                                    >
                                       {statusLabel}
                                    </span>

                                    <span className="inline-flex items-center rounded-full border border-feedback-info bg-feedback-info px-2.5 py-0.5 font-sans font-medium text-meta text-feedback-info-text">
                                       {formattedDate}
                                    </span>
                                 </div>
                              </div>

                              {/* Actions Footer */}
                              <div className="pt-2 flex items-center">
                                 <Button
                                    asChild
                                    className="h-9 w-full rounded-xl bg-input-bg border border-input-bg text-white hover:bg-input-bg text-xs font-semibold"
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
