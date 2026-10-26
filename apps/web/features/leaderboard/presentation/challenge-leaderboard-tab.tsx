"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { UserAvatar } from "@/components/ui/user-avatar";
import Link from "next/link";
import {
   Search,
   Clock,
   Crown,
   Pencil,
   Users,
   Trophy,
   X,
   RotateCcw,
   Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@/components/ui/select";
import type {
   ChallengeScoreboardViewModel,
   ScoreboardStandingEntry,
} from "../domain/leaderboard.types";
import {
   AdminHoursOverrideModal,
   type AdminHoursOverrideParticipant,
} from "@/features/study-logs/presentation/admin-hours-override-modal";
import {
   AdminTargetOverrideModal,
   type AdminTargetOverrideParticipant,
} from "@/features/challenges/presentation/admin-target-override-modal";
import { EditDuoTeamModal } from "@/features/challenges/presentation/edit-duo-team-modal";
import { DataPagination } from "@/components/ui/data-pagination";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@/components/ui/table";
import {
   getTeamColorPalette,
   getTeamBadgeStyle,
} from "@/features/challenges/domain/team-colors";
import { TrophyRoleBadge } from "@/features/trophies/presentation/trophy-role-badge";
import {
   rankByTodaySeconds,
   resolveLeaderboardViewMode,
   supportsTeamView,
   type LeaderboardViewMode,
} from "../domain/leaderboard";

export type { LeaderboardViewMode };

function getYptStatusBadge(status?: string | null): {
   label: "Studying" | "Offline";
   className: string;
} | null {
   if (!status) return null;
   const s = status.toLowerCase();
   const isStudying = s.includes("studying");
   return isStudying
      ? {
           label: "Studying",
           className:
              "bg-feedback-success-bg border-feedback-success-bg text-feedback-success-text",
        }
      : {
           label: "Offline",
           className:
              "bg-surface-tertiary border-border-strong text-text-tertiary",
        };
}

function YptStatusPill({ status }: { status?: string | null }) {
   const badge = getYptStatusBadge(status);
   if (!badge) return null;
   return (
      <span
         className={`inline-flex items-center px-2 py-0.5 rounded-full text-label font-semibold border shrink-0 ${badge.className}`}
      >
         {badge.label}
      </span>
   );
}

interface ChallengeLeaderboardTabProps {
   challenge: ChallengeScoreboardViewModel;
   isAdmin?: boolean;
   initialViewMode?: LeaderboardViewMode;
}

/** Renders challenge standings, team totals, and leaderboard view modes. */
export function ChallengeLeaderboardTab({
   challenge,
   isAdmin = false,
   initialViewMode,
}: ChallengeLeaderboardTabProps) {
   const [searchQuery, setSearchQuery] = useState("");
   const [selectedTeamId, setSelectedTeamId] = useState("ALL");
   const [statusFilter, setStatusFilter] = useState<
      "ALL" | "on-track" | "catch-up"
   >("ALL");
   const teamViewEnabled = supportsTeamView(challenge.format);
   const defaultViewMode = resolveLeaderboardViewMode(null, challenge.format);
   const resolvedInitialViewMode = initialViewMode ?? defaultViewMode;
   const [requestedViewMode, setViewMode] = useState<LeaderboardViewMode>(
      resolvedInitialViewMode
   );
   const viewMode: LeaderboardViewMode =
      requestedViewMode === "team" && !teamViewEnabled
         ? "individual"
         : requestedViewMode;

   useEffect(() => {
      if (resolvedInitialViewMode) {
         setViewMode(resolvedInitialViewMode);
      }
   }, [resolvedInitialViewMode]);

   useEffect(() => {
      const syncViewFromUrl = () => {
         if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const viewParam = params.get("view");
            if (
               viewParam === "today" ||
               viewParam === "team" ||
               viewParam === "individual"
            ) {
               setViewMode(viewParam);
            } else {
               setViewMode(defaultViewMode);
            }
         }
      };

      syncViewFromUrl();
      window.addEventListener("popstate", syncViewFromUrl);
      return () => window.removeEventListener("popstate", syncViewFromUrl);
   }, [defaultViewMode]);

   const handleViewModeChange = (mode: LeaderboardViewMode) => {
      setViewMode(mode);
      setCurrentPage(1);

      if (typeof window !== "undefined") {
         const url = new URL(window.location.href);
         if (mode === defaultViewMode) {
            url.searchParams.delete("view");
         } else {
            url.searchParams.set("view", mode);
         }
         window.history.replaceState(
            null,
            "",
            `${url.pathname}${url.search}${url.hash}`
         );
      }
   };

   const getParticipantProfileUrl = (participantId: string) => {
      const query = viewMode !== defaultViewMode ? `?view=${viewMode}` : "";
      return `/challenge/${challenge.id}/participant/${participantId}${query}`;
   };

   const [currentPage, setCurrentPage] = useState(1);
   const pageSize = 10;
   const [overrideParticipant, setOverrideParticipant] =
      useState<AdminHoursOverrideParticipant | null>(null);
   const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);

   // Admin Target Override State (FEAT-DECL-04)
   const [targetOverrideParticipant, setTargetOverrideParticipant] =
      useState<AdminTargetOverrideParticipant | null>(null);
   const [isTargetOverrideModalOpen, setIsTargetOverrideModalOpen] =
      useState(false);

   const handleOpenOverride = (entry: ScoreboardStandingEntry) => {
      setOverrideParticipant({
         participantId: entry.participantId,
         userId: entry.userId,
         displayName: entry.displayName,
         username: entry.username,
         image: entry.image,
         teamName: entry.teamName,
         teamColor: entry.teamColor,
         dailyLogs: entry.dailyLogs,
      });
      setIsOverrideModalOpen(true);
   };

   const handleOpenTargetOverride = (entry: ScoreboardStandingEntry) => {
      setTargetOverrideParticipant({
         participantId: entry.participantId,
         userId: entry.userId,
         displayName: entry.displayName,
         username: entry.username,
         image: entry.image,
         teamName: entry.teamName,
         teamColor: entry.teamColor,
         targetSeconds: entry.targetSeconds,
         targetClock: entry.targetClock,
      });
      setIsTargetOverrideModalOpen(true);
   };

   const { matchHeader, teams, standings, currentUser } = challenge;

   const [isEditOpen, setIsEditOpen] = useState(false);
   const showHeadToHead = challenge.format !== "DUOS";

   const teamA = matchHeader.teamA ?? teams[0];
   const teamB = matchHeader.teamB ?? teams[1];

   const paletteA = getTeamColorPalette(teamA?.color, 0);
   const paletteB = getTeamColorPalette(teamB?.color, 1);

   const filteredStandings = standings.filter((entry) => {
      // 1. Search Query
      const q = searchQuery.toLowerCase().trim();
      if (q) {
         const matches =
            entry.displayName.toLowerCase().includes(q) ||
            (entry.username && entry.username.toLowerCase().includes(q)) ||
            entry.teamName.toLowerCase().includes(q);
         if (!matches) return false;
      }

      // 2. Team Filter
      if (selectedTeamId !== "ALL") {
         if (
            entry.teamId !== selectedTeamId &&
            entry.teamName !== selectedTeamId
         ) {
            return false;
         }
      }

      // 3. Status / Pace Filter
      if (statusFilter === "on-track") {
         if (entry.paceStatus !== "on-track" && entry.paceStatus !== "serene") {
            return false;
         }
      } else if (statusFilter === "catch-up") {
         if (
            entry.paceStatus !== "catch-up" &&
            entry.paceStatus !== "punished"
         ) {
            return false;
         }
      }

      return true;
   });

   const hasActiveFilters =
      searchQuery.trim() !== "" ||
      selectedTeamId !== "ALL" ||
      statusFilter !== "ALL";

   const handleResetFilters = () => {
      setSearchQuery("");
      setSelectedTeamId("ALL");
      setStatusFilter("ALL");
      setCurrentPage(1);
   };

   const displayStandings =
      viewMode === "today"
         ? rankByTodaySeconds(filteredStandings)
         : filteredStandings;

   const totalPages = Math.ceil(displayStandings.length / pageSize);
   const safePage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages));
   const paginatedStandings = displayStandings.slice(
      (safePage - 1) * pageSize,
      safePage * pageSize
   );

   const totalSecondsCombined =
      (teamA?.totalLoggedSeconds ?? 0) + (teamB?.totalLoggedSeconds ?? 0);
   const totalHoursCombined = Math.round(totalSecondsCombined / 3600);

   const ratioA = matchHeader.ratioPercentageA ?? 0;
   const ratioB = matchHeader.ratioPercentageB ?? 0;

   // Average per person
   const avgHoursA =
      teamA && teamA.companionCount > 0
         ? Math.round(teamA.totalLoggedSeconds / 3600 / teamA.companionCount)
         : 0;
   const avgHoursB =
      teamB && teamB.companionCount > 0
         ? Math.round(teamB.totalLoggedSeconds / 3600 / teamB.companionCount)
         : 0;

   // Top 3 Podium
   const top1 = standings[0];
   const top2 = standings[1];
   const top3 = standings[2];
   const top1Palette = getTeamColorPalette(top1?.teamColor, 0);

   return (
      <div className="space-y-8">
         {/* 1. Head-to-Head Battle Progress Matchup (Leaderboard 142:2183) */}
         {showHeadToHead && teamA && teamB ? (
            <div className="rounded-3xl border border-border-default bg-surface-primary p-5 sm:p-7 shadow-lg space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center">
                  {/* Team A Card */}
                  <div
                     className="md:col-span-5 rounded-2xl border p-4 sm:p-5 space-y-3 transition-colors"
                     style={{
                        backgroundColor: paletteA.surface,
                        borderColor: paletteA.border,
                     }}
                  >
                     <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                           <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 truncate">
                              {teamA.iconEmoji && (
                                 <span className="shrink-0">
                                    {teamA.iconEmoji}
                                 </span>
                              )}
                              <span className="truncate">{teamA.name}</span>
                           </h3>
                           <p className="text-xs text-text-secondary mt-0.5">
                              {teamA.companionCount} Participants
                           </p>
                        </div>
                        <span className="text-meta sm:text-xs text-text-tertiary shrink-0 text-right whitespace-nowrap pl-2 pt-0.5">
                           Weekly Target: {teamA.targetHours}h
                        </span>
                     </div>

                     <div>
                        <div className="flex items-baseline justify-between gap-2">
                           <span className="text-xl sm:text-2xl font-extrabold text-white font-sans font-sans-tabular">
                              {teamA.totalLoggedClock}
                           </span>
                           <span className="text-meta sm:text-xs text-text-secondary shrink-0 text-right whitespace-nowrap pl-2">
                              ~{avgHoursA} hrs / Person
                           </span>
                        </div>
                        <p className="text-meta text-text-tertiary mt-0.5">
                           Total hours logged
                        </p>
                     </div>

                     {/* Progress bar */}
                     <div className="h-2 w-full overflow-hidden rounded-full bg-surface-elevated">
                        <div
                           className="h-full rounded-full transition-all duration-500"
                           style={{
                              width: `${teamA.completionPercentage}%`,
                              backgroundColor: paletteA.solid,
                           }}
                        />
                     </div>
                  </div>

                  {/* Circular VS Badge */}
                  <div className="md:col-span-1 flex items-center justify-center">
                     <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full border border-border-strong bg-surface-nested flex items-center justify-center font-bold text-xs sm:text-sm text-white shadow-md">
                        VS
                     </div>
                  </div>

                  {/* Team B Card */}
                  <div
                     className="md:col-span-5 rounded-2xl border p-4 sm:p-5 space-y-3 transition-colors"
                     style={{
                        backgroundColor: paletteB.surface,
                        borderColor: paletteB.border,
                     }}
                  >
                     <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                           <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 truncate">
                              {teamB.iconEmoji && (
                                 <span className="shrink-0">
                                    {teamB.iconEmoji}
                                 </span>
                              )}
                              <span className="truncate">{teamB.name}</span>
                           </h3>
                           <p className="text-xs text-text-secondary mt-0.5">
                              {teamB.companionCount} Participants
                           </p>
                        </div>
                        <span className="text-meta sm:text-xs text-text-tertiary shrink-0 text-right whitespace-nowrap pl-2 pt-0.5">
                           Weekly Target: {teamB.targetHours}h
                        </span>
                     </div>

                     <div>
                        <div className="flex items-baseline justify-between gap-2">
                           <span className="text-xl sm:text-2xl font-extrabold text-white font-sans font-sans-tabular">
                              {teamB.totalLoggedClock}
                           </span>
                           <span className="text-meta sm:text-xs text-text-secondary shrink-0 text-right whitespace-nowrap pl-2">
                              ~{avgHoursB} hrs / Person
                           </span>
                        </div>
                        <p className="text-meta text-text-tertiary mt-0.5">
                           Total hours logged
                        </p>
                     </div>

                     {/* Progress bar */}
                     <div className="h-2 w-full overflow-hidden rounded-full bg-surface-elevated">
                        <div
                           className="h-full rounded-full transition-all duration-500"
                           style={{
                              width: `${teamB.completionPercentage}%`,
                              backgroundColor: paletteB.solid,
                           }}
                        />
                     </div>
                  </div>
               </div>

               {/* Tug-of-War Split Share Bar */}
               <div className="pt-2 space-y-2 border-t border-border-default">
                  <div className="flex items-center justify-between text-meta sm:text-xs font-semibold text-white gap-1">
                     <span
                        className="whitespace-nowrap shrink-0"
                        style={{ color: paletteA.text }}
                     >
                        Share: {ratioA}%
                     </span>
                     <span className="text-meta sm:text-xs text-text-secondary font-normal text-center whitespace-nowrap px-1">
                        <span className="sm:hidden">
                           Total: {totalHoursCombined}h
                        </span>
                        <span className="hidden sm:inline">
                           Total Challenge Log: {totalHoursCombined} hours
                        </span>
                     </span>
                     <span
                        className="whitespace-nowrap shrink-0"
                        style={{ color: paletteB.text }}
                     >
                        Share: {ratioB}%
                     </span>
                  </div>

                  <div className="h-3 w-full overflow-hidden rounded-full bg-surface-elevated flex">
                     <div
                        className="h-full transition-all duration-500"
                        style={{
                           width: `${ratioA}%`,
                           backgroundColor: paletteA.solid,
                        }}
                     />
                     <div
                        className="h-full transition-all duration-500"
                        style={{
                           width: `${ratioB}%`,
                           backgroundColor: paletteB.solid,
                        }}
                     />
                  </div>
               </div>
            </div>
         ) : null}

         {/* 2. Top 3 Highlight / Podium Cards */}
         <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Rank 2 */}
            <div className="rounded-2xl border border-border-default bg-surface-primary p-4 flex items-center gap-3.5">
               <div className="h-10 w-10 rounded-xl bg-surface-nested border border-border-strong flex items-center justify-center font-bold text-sm text-text-secondary">
                  2
               </div>
               <div className="min-w-0 flex-1">
                  <p className="text-xs text-text-tertiary">Runner-up</p>
                  {top2 ? (
                     <Link
                        href={getParticipantProfileUrl(top2.participantId)}
                        className="text-sm font-bold text-white hover:underline truncate block"
                     >
                        {top2.displayName}
                     </Link>
                  ) : (
                     <p className="text-sm font-bold text-white truncate">
                        Awaiting...
                     </p>
                  )}
                  <p className="text-xs font-sans font-sans-tabular text-text-secondary mt-0.5">
                     {top2 ? top2.totalLoggedClock : "00:00:00"}
                  </p>
               </div>
            </div>

            {/* Rank 1 (MVP) */}
            <div
               className="rounded-2xl border p-4 flex items-center gap-3.5 shadow-md"
               style={{
                  backgroundColor: top1
                     ? top1Palette.surface
                     : "rgba(255, 255, 255, 0.05)",
                  borderColor: top1 ? top1Palette.border : "#383838",
               }}
            >
               <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm text-text-inverse"
                  style={{
                     backgroundColor: top1 ? top1Palette.solid : "#f4f3f6",
                  }}
               >
                  <Crown className="h-5 w-5 fill-current" />
               </div>
               <div className="min-w-0 flex-1">
                  <p
                     className="text-xs font-semibold flex items-center gap-1"
                     style={{ color: top1 ? top1Palette.text : "#d1d1d1" }}
                  >
                     Top Contributor · Rank 1
                  </p>
                  {top1 ? (
                     <Link
                        href={getParticipantProfileUrl(top1.participantId)}
                        className="text-sm font-bold text-white hover:underline truncate block"
                     >
                        {top1.displayName}
                     </Link>
                  ) : (
                     <p className="text-sm font-bold text-white truncate">
                        Awaiting...
                     </p>
                  )}
                  <p
                     className="text-xs font-sans font-sans-tabular mt-0.5"
                     style={{ color: top1 ? top1Palette.text : "#d1d1d1" }}
                  >
                     {top1 ? top1.totalLoggedClock : "00:00:00"}
                  </p>
               </div>
            </div>

            {/* Rank 3 */}
            <div className="rounded-2xl border border-border-default bg-surface-primary p-4 flex items-center gap-3.5">
               <div className="h-10 w-10 rounded-xl bg-surface-nested border border-border-strong flex items-center justify-center font-bold text-sm text-brand-1">
                  3
               </div>
               <div className="min-w-0 flex-1">
                  <p className="text-xs text-text-tertiary">Rank 3</p>
                  {top3 ? (
                     <Link
                        href={getParticipantProfileUrl(top3.participantId)}
                        className="text-sm font-bold text-white hover:text-feedback-success hover:underline truncate block"
                     >
                        {top3.displayName}
                     </Link>
                  ) : (
                     <p className="text-sm font-bold text-white truncate">
                        Awaiting...
                     </p>
                  )}
                  <p className="text-xs font-sans font-sans-tabular text-text-secondary mt-0.5">
                     {top3 ? top3.totalLoggedClock : "00:00:00"}
                  </p>
               </div>
            </div>
         </div>

         {/* 3. Standings Table & Search Bar (Leaderboard Column 61:1571 & Search Bar 61:1543) */}
         <div className="rounded-3xl border border-border-default bg-surface-primary p-5 sm:p-7 shadow-lg space-y-5">
            <div className="flex flex-col gap-3.5 pb-3 border-b border-border-default">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                     <h3 className="text-xl font-bold text-white">
                        Leaderboard Standings
                     </h3>
                     <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-surface-elevated border border-border-default text-text-tertiary">
                        {filteredStandings.length}{" "}
                        {filteredStandings.length === 1
                           ? "scholar"
                           : "scholars"}
                     </span>
                  </div>

                  {/* View Mode Toggle: Overall vs Today's LB vs View by Team */}
                  <div className="inline-flex items-center rounded-xl bg-surface-elevated border border-border-default p-1 self-start sm:self-auto gap-1">
                     <button
                        type="button"
                        onClick={() => handleViewModeChange("individual")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                           viewMode === "individual"
                              ? "bg-surface-nested text-white shadow-sm border border-border-strong"
                              : "text-text-tertiary hover:text-white"
                        }`}
                     >
                        <Trophy className="h-3.5 w-3.5" />
                        <span>Overall Rank</span>
                     </button>
                     <button
                        type="button"
                        onClick={() => handleViewModeChange("today")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                           viewMode === "today"
                              ? "bg-surface-nested text-white shadow-sm border border-border-strong"
                              : "text-text-tertiary hover:text-white"
                        }`}
                     >
                        <Clock className="h-3.5 w-3.5" />
                        <span>Today&apos;s LB</span>
                     </button>
                     {teamViewEnabled && (
                        <button
                           type="button"
                           onClick={() => handleViewModeChange("team")}
                           className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                              viewMode === "team"
                                 ? "bg-surface-nested text-white shadow-sm border border-border-strong"
                                 : "text-text-tertiary hover:text-white"
                           }`}
                        >
                           <Users className="h-3.5 w-3.5" />
                           <span>View by Team</span>
                        </button>
                     )}
                  </div>
               </div>

               {/* Search & Filter Controls */}
               <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  {/* Search bar */}
                  <div className="sm:col-span-5 relative">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
                     <Input
                        type="text"
                        placeholder="Search scholar by name, @handle..."
                        value={searchQuery}
                        onChange={(e) => {
                           setSearchQuery(e.target.value);
                           setCurrentPage(1);
                        }}
                        className="h-9 pl-9 pr-8 bg-surface-elevated border-border-strong text-white placeholder-text-tertiary text-xs rounded-xl"
                     />
                     {searchQuery && (
                        <button
                           type="button"
                           onClick={() => {
                              setSearchQuery("");
                              setCurrentPage(1);
                           }}
                           className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-white p-0.5"
                           title="Clear search"
                        >
                           <X className="h-3.5 w-3.5" />
                        </button>
                     )}
                  </div>

                  {/* Team Filter Dropdown */}
                  <div className="sm:col-span-4 relative">
                     <Select
                        value={selectedTeamId}
                        onValueChange={(value) => {
                           setSelectedTeamId(value);
                           setCurrentPage(1);
                        }}
                     >
                        <SelectTrigger
                           data-testid="leaderboard-team-select"
                           className="h-9 rounded-xl border-border-strong bg-surface-elevated text-xs text-white"
                        >
                           <SelectValue
                              placeholder={`All Teams (${standings.length})`}
                           />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="ALL">
                              All Teams ({standings.length})
                           </SelectItem>
                           {teams.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                 {t.iconEmoji ? `${t.iconEmoji} ` : ""}
                                 {t.name} ({t.companionCount})
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </div>

                  {/* Pace / Status Filter Dropdown */}
                  <div className="sm:col-span-3 relative">
                     <Select
                        value={statusFilter}
                        onValueChange={(value) => {
                           setStatusFilter(
                              value as "ALL" | "on-track" | "catch-up"
                           );
                           setCurrentPage(1);
                        }}
                     >
                        <SelectTrigger
                           data-testid="leaderboard-pace-select"
                           className="h-9 rounded-xl border-border-strong bg-surface-elevated text-xs text-white"
                        >
                           <SelectValue placeholder="All Pace Statuses" />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="ALL">
                              All Pace Statuses
                           </SelectItem>
                           <SelectItem value="on-track">
                              On Track / Ahead
                           </SelectItem>
                           <SelectItem value="catch-up">
                              Catch-Up / Behind
                           </SelectItem>
                        </SelectContent>
                     </Select>
                  </div>
               </div>

               {/* Active Filters Pill Bar (if any filter active) */}
               {hasActiveFilters && (
                  <div className="flex items-center justify-between gap-2 text-xs pt-1 flex-wrap">
                     <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-text-tertiary">
                           Active filters:
                        </span>
                        {searchQuery && (
                           <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-nested border border-border-strong text-white text-meta">
                              &quot;{searchQuery}&quot;
                              <button
                                 type="button"
                                 onClick={() => setSearchQuery("")}
                                 className="hover:text-feedback-error"
                              >
                                 <X className="h-3 w-3" />
                              </button>
                           </span>
                        )}
                        {selectedTeamId !== "ALL" && (
                           <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-nested border border-border-strong text-white text-meta">
                              Team:{" "}
                              {teams.find((t) => t.id === selectedTeamId)
                                 ?.name || selectedTeamId}
                              <button
                                 type="button"
                                 onClick={() => setSelectedTeamId("ALL")}
                                 className="hover:text-feedback-error"
                              >
                                 <X className="h-3 w-3" />
                              </button>
                           </span>
                        )}
                        {statusFilter !== "ALL" && (
                           <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-nested border border-border-strong text-white text-meta">
                              {statusFilter === "on-track"
                                 ? "On Track"
                                 : "Catch-Up"}
                              <button
                                 type="button"
                                 onClick={() => setStatusFilter("ALL")}
                                 className="hover:text-feedback-error"
                              >
                                 <X className="h-3 w-3" />
                              </button>
                           </span>
                        )}
                     </div>
                     <button
                        type="button"
                        onClick={handleResetFilters}
                        className="text-meta font-semibold text-text-tertiary hover:text-white underline underline-offset-2 shrink-0"
                     >
                        Clear all filters
                     </button>
                  </div>
               )}
            </div>

            {filteredStandings.length === 0 ? (
               <div className="rounded-2xl border border-border-default bg-surface-elevated p-8 text-center space-y-3">
                  <p className="text-sm font-semibold text-white">
                     No scholars match your search or filter criteria.
                  </p>
                  <p className="text-xs text-text-tertiary">
                     No scholars match your search. Try adjusting your search
                     query or selecting another team.
                  </p>
                  {hasActiveFilters && (
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
                  )}
               </div>
            ) : viewMode === "team" ? (
               /* View by Team Section (Side-by-Side on Desktop/Tablet Landscape) */
               (() => {
                  const teamsToRender =
                     selectedTeamId === "ALL"
                        ? teams
                        : teams.filter(
                             (t) =>
                                t.id === selectedTeamId ||
                                t.name === selectedTeamId
                          );

                  return (
                     <div
                        className={`grid grid-cols-1 ${
                           teamsToRender.length > 1 ? "lg:grid-cols-2" : ""
                        } gap-6 items-start`}
                     >
                        {teamsToRender.map((t) => {
                           const teamScholars = filteredStandings.filter(
                              (e) => e.teamId === t.id || e.teamName === t.name
                           );
                           const isTeamA = teamA && t.name === teamA.name;
                           const badgeTint = isTeamA
                              ? "bg-feedback-success-bg border-feedback-success/40 text-feedback-success-text"
                              : "bg-feedback-info-bg border-feedback-info/40 text-feedback-info-text";

                           return (
                              <div
                                 key={t.id}
                                 className="rounded-2xl border border-border-default bg-surface-secondary p-4 sm:p-5 space-y-4 shadow-sm"
                              >
                                 {/* Team Header Summary Card */}
                                 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border-default">
                                    <div className="flex items-center gap-3 min-w-0">
                                       <span className="text-2xl shrink-0">
                                          {t.iconEmoji || "🛡️"}
                                       </span>
                                       <div className="min-w-0">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                             <h4 className="text-base font-bold text-white truncate">
                                                {t.name}
                                             </h4>
                                             {t.id === currentUser.teamId &&
                                                currentUser.canEditDuoTeam && (
                                                   <button
                                                      type="button"
                                                      onClick={() =>
                                                         setIsEditOpen(true)
                                                      }
                                                      data-testid={`edit-duo-team-${t.id}`}
                                                      aria-label="Edit your duo name and emoji"
                                                      title="Edit your duo name and emoji"
                                                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-border-strong bg-surface-elevated text-text-tertiary transition-colors hover:border-feedback-success/40 hover:text-white"
                                                   >
                                                      <Pencil className="h-3.5 w-3.5" />
                                                   </button>
                                                )}
                                             <span
                                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-label font-semibold border shrink-0 ${badgeTint}`}
                                             >
                                                {teamScholars.length} /{" "}
                                                {t.companionCount} scholars
                                             </span>
                                             {t.isLeader && (
                                                <span className="px-2 py-0.5 rounded-full text-label font-bold bg-feedback-success/20 text-feedback-success-text border border-feedback-success/30 shrink-0">
                                                   Leading House
                                                </span>
                                             )}
                                          </div>
                                          <p className="text-xs text-text-tertiary mt-0.5 truncate">
                                             Weekly Target: {t.targetHours}h •
                                             Completed: {t.completionPercentage}
                                             %
                                          </p>
                                       </div>
                                    </div>

                                    <div className="flex items-center gap-3 text-xs font-sans font-sans-tabular shrink-0">
                                       <div>
                                          <span className="text-text-tertiary">
                                             Total:{" "}
                                          </span>
                                          <span className="font-bold text-white">
                                             {t.totalLoggedClock}
                                          </span>
                                       </div>
                                       <div className="w-20 sm:w-28 h-2 rounded-full bg-surface-elevated overflow-hidden border border-border-strong">
                                          <div
                                             className="h-full bg-feedback-success transition-all duration-500"
                                             style={{
                                                width: `${Math.min(100, t.completionPercentage)}%`,
                                             }}
                                          />
                                       </div>
                                    </div>
                                 </div>

                                 {/* Team Scholars List */}
                                 {teamScholars.length === 0 ? (
                                    <p className="text-center py-4 text-xs text-text-tertiary">
                                       No scholars in {t.name} match the active
                                       filters.
                                    </p>
                                 ) : (
                                    <div className="space-y-2.5">
                                       {teamScholars.map((entry, idx) => (
                                          <div
                                             key={entry.participantId}
                                             className="rounded-xl border border-border-default bg-surface-primary p-3 flex items-center justify-between gap-2.5 hover:border-border-strong transition-colors"
                                          >
                                             {/* Intra-team Rank & Overall Rank */}
                                             <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="flex flex-col items-center justify-center w-7 shrink-0 text-center">
                                                   <span className="text-xs font-bold text-white font-sans">
                                                      #{idx + 1}
                                                   </span>
                                                   <span className="text-caption text-text-tertiary">
                                                      (#{entry.rank})
                                                   </span>
                                                </div>

                                                {/* Avatar */}
                                                <Link
                                                   href={getParticipantProfileUrl(
                                                      entry.participantId
                                                   )}
                                                   className="h-8 w-8 rounded-full bg-surface-nested border border-border-strong overflow-hidden flex items-center justify-center shrink-0 text-xs hover:border-feedback-success transition-colors"
                                                >
                                                   <UserAvatar
                                                      src={entry.image}
                                                      name={entry.displayName}
                                                      userId={entry.userId}
                                                      size="sm"
                                                      className="h-full w-full border-0"
                                                   />
                                                </Link>

                                                {/* Name & Pace */}
                                                <div className="min-w-0">
                                                   <div className="flex items-center gap-1.5 flex-wrap">
                                                      <Link
                                                         href={getParticipantProfileUrl(
                                                            entry.participantId
                                                         )}
                                                         className="text-xs font-bold text-white hover:text-feedback-success hover:underline truncate max-w-[110px] sm:max-w-[150px] lg:max-w-[130px] xl:max-w-[180px] block"
                                                      >
                                                         {entry.displayName}
                                                      </Link>
                                                      {typeof entry.trophies ===
                                                         "number" && (
                                                         <TrophyRoleBadge
                                                            trophies={
                                                               entry.trophies
                                                            }
                                                            size="sm"
                                                         />
                                                      )}
                                                      <YptStatusPill
                                                         status={entry.status}
                                                      />
                                                      {entry.paceLabel && (
                                                         <span
                                                            className={`px-1.5 py-0.2 rounded text-caption font-semibold shrink-0 ${
                                                               entry.paceStatus ===
                                                                  "on-track" ||
                                                               entry.paceStatus ===
                                                                  "serene"
                                                                  ? "bg-feedback-success-bg text-feedback-success-text"
                                                                  : "bg-feedback-error-bg text-feedback-error-text"
                                                            }`}
                                                         >
                                                            {entry.paceLabel}
                                                         </span>
                                                      )}
                                                   </div>
                                                   <p className="text-label text-text-tertiary truncate">
                                                      @
                                                      {entry.username ||
                                                         "scholar"}
                                                   </p>
                                                </div>
                                             </div>

                                             {/* Clock & Admin edit */}
                                             <div className="shrink-0 text-right font-sans font-sans-tabular flex items-center gap-2">
                                                <div>
                                                   <p className="text-xs font-bold text-white">
                                                      {entry.totalLoggedClock}
                                                      <span className="text-label font-normal text-text-tertiary">
                                                         /{entry.targetClock}
                                                      </span>
                                                   </p>
                                                   <p className="text-meta font-semibold text-feedback-success">
                                                      +{entry.todayLoggedClock}
                                                   </p>
                                                </div>
                                                {isAdmin && (
                                                   <div className="flex items-center gap-1 shrink-0">
                                                      <button
                                                         type="button"
                                                         onClick={() =>
                                                            handleOpenOverride(
                                                               entry
                                                            )
                                                         }
                                                         className="px-2 py-1 rounded-lg bg-surface-nested hover:bg-surface-nested text-text-secondary hover:text-white border border-border-strong transition-colors flex items-center gap-1 text-label font-semibold"
                                                         title="Admin: Edit Study Hours"
                                                      >
                                                         <Clock className="h-3 w-3 text-feedback-info" />
                                                         <span>Edit hr</span>
                                                      </button>
                                                      <button
                                                         type="button"
                                                         onClick={() =>
                                                            handleOpenTargetOverride(
                                                               entry
                                                            )
                                                         }
                                                         className="px-2 py-1 rounded-lg bg-surface-nested hover:bg-surface-nested text-text-secondary hover:text-white border border-border-strong transition-colors flex items-center gap-1 text-label font-semibold"
                                                         title="Admin: Edit Weekly Target Hours"
                                                      >
                                                         <Target className="h-3 w-3 text-accent" />
                                                         <span>
                                                            Edit target
                                                         </span>
                                                      </button>
                                                   </div>
                                                )}
                                             </div>
                                          </div>
                                       ))}
                                    </div>
                                 )}
                              </div>
                           );
                        })}
                     </div>
                  );
               })()
            ) : (
               <>
                  {/* Mobile Leaderboard View (sm:hidden) matching wireframe */}
                  <div className="sm:hidden space-y-3">
                     {/* Header Card: rank | Participant | total hours */}
                     <div className="rounded-2xl border border-border-default bg-surface-tertiary px-3.5 py-2.5 flex items-center justify-between text-meta font-bold text-text-tertiary uppercase tracking-wider">
                        <div className="flex items-center gap-3">
                           <span className="w-6 text-center">Rank</span>
                           <span>Participant</span>
                        </div>
                        <span className="text-right">
                           {viewMode === "today"
                              ? "Today's Hours"
                              : "Total Hours"}
                        </span>
                     </div>

                     {/* Participant Cards */}
                     <div className="space-y-2.5">
                        {paginatedStandings.map((entry) => {
                           const currentRank =
                              "todayRank" in entry && viewMode === "today"
                                 ? (entry as { todayRank: number }).todayRank
                                 : entry.rank;
                           const entryPalette = getTeamColorPalette(
                              entry.teamColor,
                              currentRank
                           );
                           return (
                              <div
                                 key={entry.participantId}
                                 className={`rounded-2xl border border-border-default p-3 flex items-center gap-3 transition-colors `}
                              >
                                 {/* Rank */}
                                 <div className="w-6 text-center shrink-0">
                                    <span className="font-bold text-sm text-white font-sans">
                                       {currentRank}
                                    </span>
                                 </div>

                                 {/* Avatar */}
                                 <Link
                                    href={getParticipantProfileUrl(
                                       entry.participantId
                                    )}
                                    className="h-9 w-9 rounded-full bg-surface-nested border border-border-strong overflow-hidden flex items-center justify-center shrink-0 text-xs hover:border-feedback-success transition-colors"
                                 >
                                    <UserAvatar
                                       src={entry.image}
                                       name={entry.displayName}
                                       userId={entry.userId}
                                       size="sm"
                                       className="h-full w-full border-0"
                                    />
                                 </Link>

                                 {/* Participant Details: Name + Team Badge, @username */}
                                 <div className="min-w-0 flex-1 space-y-0.5">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                       <Link
                                          href={getParticipantProfileUrl(
                                             entry.participantId
                                          )}
                                          className="text-xs font-bold text-white hover:text-feedback-success hover:underline truncate max-w-[110px] xs:max-w-[140px] block"
                                       >
                                          {entry.displayName}
                                       </Link>
                                       {typeof entry.trophies === "number" && (
                                          <TrophyRoleBadge
                                             trophies={entry.trophies}
                                             size="sm"
                                          />
                                       )}
                                       <YptStatusPill status={entry.status} />
                                       <span
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label font-semibold border shrink-0"
                                          style={{
                                             backgroundColor:
                                                entryPalette.badgeBg,
                                             borderColor:
                                                entryPalette.badgeBorder,
                                             color: entryPalette.text,
                                          }}
                                       >
                                          {entry.teamIcon && (
                                             <span>{entry.teamIcon}</span>
                                          )}
                                          <span>{entry.teamName}</span>
                                       </span>
                                    </div>
                                    <p className="text-meta text-text-tertiary truncate">
                                       @{entry.username || "scholar"}
                                    </p>
                                 </div>

                                 {/* Total hours and +Today's hours */}
                                 <div className="shrink-0 text-right font-sans font-sans-tabular space-y-0.5 flex items-center gap-2">
                                    {viewMode === "today" ? (
                                       <div>
                                          <p className="text-xs font-bold text-white">
                                             {entry.todayLoggedClock}
                                          </p>
                                       </div>
                                    ) : (
                                       <div>
                                          <p className="text-xs font-bold text-white">
                                             {entry.totalLoggedClock}
                                             <span className="text-label font-normal text-text-tertiary">
                                                /{entry.targetClock}
                                             </span>
                                          </p>
                                          <p className="text-meta font-semibold text-feedback-success">
                                             +{entry.todayLoggedClock}
                                          </p>
                                       </div>
                                    )}
                                    {isAdmin && (
                                       <div className="flex items-center gap-1 shrink-0">
                                          <button
                                             type="button"
                                             onClick={() =>
                                                handleOpenOverride(entry)
                                             }
                                             className="px-2 py-1 rounded-lg bg-surface-nested hover:bg-surface-nested text-text-secondary hover:text-white border border-border-strong transition-colors flex items-center gap-1 text-label font-semibold"
                                             title="Admin: Edit Study Hours"
                                          >
                                             <Clock className="h-3 w-3 text-feedback-info" />
                                             <span>Edit hr</span>
                                          </button>
                                          <button
                                             type="button"
                                             onClick={() =>
                                                handleOpenTargetOverride(entry)
                                             }
                                             className="px-2 py-1 rounded-lg bg-surface-nested hover:bg-surface-nested text-text-secondary hover:text-white border border-border-strong transition-colors flex items-center gap-1 text-label font-semibold"
                                             title="Admin: Edit Weekly Target Hours"
                                          >
                                             <Target className="h-3 w-3 text-accent" />
                                             <span>Edit target</span>
                                          </button>
                                       </div>
                                    )}
                                 </div>
                              </div>
                           );
                        })}
                     </div>
                  </div>

                  {/* Desktop Table View (hidden sm:block) */}
                  <div className="hidden sm:block overflow-x-auto">
                     <Table className="w-full text-left text-xs">
                        <TableHeader>
                           <TableRow className="border-b border-border-default text-meta font-medium text-text-tertiary uppercase tracking-wider">
                              <TableHead className="px-3 py-3 w-12 text-center">
                                 Rank
                              </TableHead>
                              <TableHead className="px-4 py-3">Name</TableHead>
                              <TableHead className="px-4 py-3">Team</TableHead>
                              <TableHead
                                 className={`px-4 py-3 ${
                                    viewMode === "today" ? "text-right" : ""
                                 }`}
                              >
                                 Today&apos;s hours
                              </TableHead>
                              {viewMode !== "today" && (
                                 <TableHead className="px-4 py-3 text-right">
                                    Total hours
                                 </TableHead>
                              )}
                           </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-border-subtle">
                           {paginatedStandings.map((entry) => {
                              const currentRank =
                                 "todayRank" in entry && viewMode === "today"
                                    ? (entry as { todayRank: number }).todayRank
                                    : entry.rank;
                              const entryPalette = getTeamColorPalette(
                                 entry.teamColor,
                                 currentRank
                              );

                              return (
                                 <TableRow
                                    key={entry.participantId}
                                    className="transition-colors group hover:bg-white/[0.04]"
                                    style={{
                                       backgroundColor: entryPalette.rowTint,
                                    }}
                                 >
                                    {/* Rank */}
                                    <TableCell className="px-3 py-3 text-center">
                                       <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-surface-elevated text-xs font-bold text-white border border-border-strong">
                                          {currentRank}
                                       </span>
                                    </TableCell>

                                    {/* Name & Avatar */}
                                    <TableCell className="px-4 py-3 font-medium text-white">
                                       <div className="flex items-center gap-2.5">
                                          <Link
                                             href={getParticipantProfileUrl(
                                                entry.participantId
                                             )}
                                             className="h-7 w-7 rounded-full bg-surface-nested border border-border-strong overflow-hidden flex items-center justify-center text-xs shrink-0 hover:border-feedback-success transition-colors"
                                          >
                                             <UserAvatar
                                                src={entry.image}
                                                name={entry.displayName}
                                                userId={entry.userId}
                                                size="sm"
                                                className="h-full w-full border-0"
                                             />
                                          </Link>
                                          <div>
                                             <div className="flex items-center gap-1.5 flex-wrap">
                                                <Link
                                                   href={getParticipantProfileUrl(
                                                      entry.participantId
                                                   )}
                                                   className="font-semibold text-sm text-white hover:text-feedback-success hover:underline truncate block"
                                                >
                                                   {entry.displayName}
                                                </Link>
                                                {typeof entry.trophies ===
                                                   "number" && (
                                                   <TrophyRoleBadge
                                                      trophies={entry.trophies}
                                                      size="sm"
                                                   />
                                                )}
                                                <YptStatusPill
                                                   status={entry.status}
                                                />
                                             </div>
                                             {entry.username && (
                                                <p className="text-label text-text-tertiary">
                                                   @{entry.username}
                                                </p>
                                             )}
                                          </div>
                                       </div>
                                    </TableCell>

                                    {/* Team */}
                                    <TableCell className="px-4 py-3">
                                       <span
                                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-meta font-medium border"
                                          style={{
                                             backgroundColor:
                                                entryPalette.badgeBg,
                                             borderColor:
                                                entryPalette.badgeBorder,
                                             color: entryPalette.text,
                                          }}
                                       >
                                          {entry.teamIcon && (
                                             <span>{entry.teamIcon}</span>
                                          )}
                                          <span>{entry.teamName}</span>
                                       </span>
                                    </TableCell>

                                    {/* Today's Hours */}
                                    <TableCell
                                       className={`px-4 py-3 font-sans font-sans-tabular ${
                                          viewMode === "today"
                                             ? "text-right text-sm font-bold text-white"
                                             : "text-xs text-text-secondary"
                                       }`}
                                    >
                                       {viewMode === "today" ? (
                                          <div className="inline-flex items-center gap-2 justify-end">
                                             <div className="inline-flex items-center gap-1.5">
                                                <Clock className="h-3.5 w-3.5 text-text-tertiary" />
                                                <span>
                                                   {entry.todayLoggedClock}
                                                </span>
                                             </div>
                                             {isAdmin && (
                                                <button
                                                   type="button"
                                                   onClick={() =>
                                                      handleOpenOverride(entry)
                                                   }
                                                   className="px-2.5 py-1 rounded-lg bg-surface-elevated hover:bg-surface-nested text-text-secondary hover:text-white border border-border-strong transition-colors flex items-center gap-1.5 text-xs font-semibold shrink-0"
                                                   title="Admin: Edit Participant Study Hours"
                                                >
                                                   <Clock className="h-3.5 w-3.5 text-feedback-info" />
                                                   <span>Edit hr</span>
                                                </button>
                                             )}
                                          </div>
                                       ) : (
                                          <span className="flex items-center gap-1.5">
                                             <Clock className="h-3.5 w-3.5 text-text-tertiary" />
                                             <span>
                                                {entry.todayLoggedClock}
                                             </span>
                                          </span>
                                       )}
                                    </TableCell>

                                    {/* Total Hours */}
                                    {viewMode !== "today" && (
                                       <TableCell className="px-4 py-3 text-right font-sans font-sans-tabular text-sm font-bold text-white">
                                          <div className="inline-flex items-center gap-2 justify-end">
                                             <div className="inline-flex items-center gap-1.5">
                                                <Clock className="h-3.5 w-3.5 text-feedback-success" />
                                                <span>
                                                   {entry.totalLoggedClock}
                                                </span>
                                                <span className="text-xs text-text-tertiary font-normal">
                                                   / {entry.targetClock}
                                                </span>
                                             </div>
                                             {isAdmin && (
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                   <button
                                                      type="button"
                                                      onClick={() =>
                                                         handleOpenOverride(
                                                            entry
                                                         )
                                                      }
                                                      className="px-2.5 py-1 rounded-lg bg-surface-elevated hover:bg-surface-nested text-text-secondary hover:text-white border border-border-strong transition-colors flex items-center gap-1.5 text-xs font-semibold"
                                                      title="Admin: Edit Participant Study Hours"
                                                   >
                                                      <Clock className="h-3.5 w-3.5 text-feedback-info" />
                                                      <span>Edit hr</span>
                                                   </button>
                                                   <button
                                                      type="button"
                                                      onClick={() =>
                                                         handleOpenTargetOverride(
                                                            entry
                                                         )
                                                      }
                                                      className="px-2.5 py-1 rounded-lg bg-surface-elevated hover:bg-surface-nested text-text-secondary hover:text-white border border-border-strong transition-colors flex items-center gap-1.5 text-xs font-semibold"
                                                      title="Admin: Edit Weekly Target Hours"
                                                   >
                                                      <Target className="h-3.5 w-3.5 text-accent" />
                                                      <span>Edit target</span>
                                                   </button>
                                                </div>
                                             )}
                                          </div>
                                       </TableCell>
                                    )}
                                 </TableRow>
                              );
                           })}
                        </TableBody>
                     </Table>
                  </div>

                  {/* Pagination Controls */}
                  <DataPagination
                     currentPage={safePage}
                     totalPages={totalPages}
                     totalItems={displayStandings.length}
                     pageSize={pageSize}
                     onPageChange={setCurrentPage}
                     itemLabel="scholars"
                  />
               </>
            )}
         </div>

         {/* Admin Hours Override Modal (FEAT-LOG-04) */}
         {isAdmin && (
            <>
               <AdminHoursOverrideModal
                  isOpen={isOverrideModalOpen}
                  onClose={() => setIsOverrideModalOpen(false)}
                  challengeId={challenge.id}
                  challengeStartDate={challenge.startAt}
                  totalChallengeDays={challenge.totalDays || 7}
                  participant={overrideParticipant}
                  initialDayNumber={challenge.currentDayNumber || 1}
                  onOpenTargetOverride={() => {
                     if (overrideParticipant) {
                        const found = challenge.standings.find(
                           (s) =>
                              s.participantId ===
                              overrideParticipant.participantId
                        );
                        if (found) {
                           handleOpenTargetOverride(found);
                        }
                     }
                  }}
               />

               <AdminTargetOverrideModal
                  isOpen={isTargetOverrideModalOpen}
                  onClose={() => {
                     setIsTargetOverrideModalOpen(false);
                     setTargetOverrideParticipant(null);
                  }}
                  challengeId={challenge.id}
                  participant={targetOverrideParticipant}
               />
            </>
         )}

         {currentUser.teamId &&
            currentUser.teamName &&
            currentUser.canEditDuoTeam && (
               <EditDuoTeamModal
                  challengeId={challenge.id}
                  currentName={currentUser.teamName}
                  currentEmoji={currentUser.teamIcon ?? ""}
                  isOpen={isEditOpen}
                  onOpenChange={setIsEditOpen}
               />
            )}
      </div>
   );
}
