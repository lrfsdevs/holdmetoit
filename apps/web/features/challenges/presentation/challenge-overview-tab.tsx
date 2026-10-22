"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import {
   Users,
   CheckCircle,
   Shield,
   Clock,
   Search,
   X,
   RotateCcw,
   Calendar,
   Download,
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
import { DataPagination } from "@/components/ui/data-pagination";
import {
   AdminHoursOverrideModal,
   type AdminHoursOverrideParticipant,
} from "@/features/study-logs/presentation/admin-hours-override-modal";
import type {
   ChallengeScoreboardViewModel,
   ScoreboardStandingEntry,
} from "@/features/leaderboard/domain/leaderboard.types";
import { getTeamColorPalette } from "@/features/challenges/domain/team-colors";
import { PunishmentWall } from "@/features/accountability/presentation/punishment-wall";
import { ChallengeBettingCard } from "./challenge-betting-card";
import { ChallengeDescriptionContent } from "./challenge-description-content";
import { WithdrawChallengeButton } from "./withdraw-challenge-modal";

interface ChallengeOverviewTabProps {
   challenge: ChallengeScoreboardViewModel;
   isAdmin?: boolean;
   /** Server-evaluated `betting_system_v1`. */
   isBettingEnabled?: boolean;
   /** Server-evaluated `challenge_withdrawal_v1`. */
   isWithdrawalEnabled?: boolean;
}

/** Renders challenge overview details and participant actions. */
export function ChallengeOverviewTab({
   challenge,
   isAdmin = false,
   isBettingEnabled = true,
   isWithdrawalEnabled = false,
}: ChallengeOverviewTabProps) {
   const [searchQuery, setSearchQuery] = useState("");
   const [selectedTeamId, setSelectedTeamId] = useState("ALL");
   const [participantPage, setParticipantPage] = useState(1);
   const participantPageSize = 8;
   const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
   const [overrideParticipant, setOverrideParticipant] =
      useState<AdminHoursOverrideParticipant | null>(null);

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
         totalLoggedSeconds: entry.totalLoggedSeconds,
      });
      setIsOverrideModalOpen(true);
   };
   const { standings, teams } = challenge;
   const activeTeams = useMemo(
      () => teams?.filter((t) => !t.isDeleted) || [],
      [teams]
   );

   const filteredParticipants = standings.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      if (q) {
         const matches =
            p.displayName.toLowerCase().includes(q) ||
            (p.username && p.username.toLowerCase().includes(q)) ||
            p.teamName.toLowerCase().includes(q);
         if (!matches) return false;
      }

      if (selectedTeamId !== "ALL") {
         if (p.teamId !== selectedTeamId && p.teamName !== selectedTeamId) {
            return false;
         }
      }

      return true;
   });

   const hasActiveFilters =
      searchQuery.trim() !== "" || selectedTeamId !== "ALL";

   const handleResetFilters = () => {
      setSearchQuery("");
      setSelectedTeamId("ALL");
      setParticipantPage(1);
   };

   const totalParticipantPages =
      Math.ceil(filteredParticipants.length / participantPageSize) || 1;
   const safeParticipantPage = Math.min(
      Math.max(1, participantPage),
      Math.max(1, totalParticipantPages)
   );
   const displayedParticipants = filteredParticipants.slice(
      (safeParticipantPage - 1) * participantPageSize,
      safeParticipantPage * participantPageSize
   );

   const teamA = activeTeams[0];

   return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
         {/* 1. Left Column: Welcome, About & Timetable, How it Works, Punishment PFP Disclosure */}
         <div className="lg:col-span-7 space-y-6">
            {/* Welcome & About Card */}
            <div className="rounded-3xl border border-border-default bg-surface-primary p-6 sm:p-7 shadow-lg space-y-4">
               <div className="space-y-2">
                  <h2 className="text-2xl font-extrabold text-white tracking-tight">
                     Welcome to the {challenge.title}!
                  </h2>
                  <ChallengeDescriptionContent source={challenge.description} />
               </div>

               <hr className="border-border-default" />

               {/* Timetable (UTC) */}
               <div className="space-y-2.5 pt-1">
                  <h4 className="text-xs uppercase font-bold tracking-wider text-text-tertiary flex items-center gap-1.5">
                     <Calendar className="h-3.5 w-3.5 text-text-tertiary" />
                     <span>Timetable (UTC)</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                     <div className="rounded-xl bg-surface-elevated p-3 border border-border-default">
                        <p className="text-text-tertiary text-meta">
                           Kickoff Date
                        </p>
                        <p className="font-sans font-medium text-white mt-1">
                           {new Date(challenge.startAt)
                              .toUTCString()
                              .replace("GMT", "UTC")}
                        </p>
                     </div>
                     <div className="rounded-xl bg-surface-elevated p-3 border border-border-default">
                        <p className="text-text-tertiary text-meta">
                           Conclusion Date
                        </p>
                        <p className="font-sans font-medium text-white mt-1">
                           {new Date(challenge.endAt)
                              .toUTCString()
                              .replace("GMT", "UTC")}
                        </p>
                     </div>
                  </div>
               </div>
            </div>

            {/* Tournament Economy & Betting Card (Phase 2) */}
            {isBettingEnabled && <ChallengeBettingCard challenge={challenge} />}

            {/* 2. Forfeits & Accountability Wall (FEAT-PUN-02 / FEAT-PUN-03) */}
            <PunishmentWall challenge={challenge} />
         </div>

         {/* 2. Right Column: Participants List (Challenge/Default 64:1806) */}
         <div className="lg:col-span-5 space-y-4">
            <div className="rounded-3xl border border-border-default bg-surface-primary p-5 sm:p-6 shadow-lg space-y-4">
               <div className="flex items-center justify-between pb-2 border-b border-border-default">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                     <Users className="h-4 w-4 text-text-tertiary" />
                     Participants
                  </h3>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-surface-elevated border border-border-default text-text-tertiary">
                     {filteredParticipants.length} of {standings.length}
                  </span>
               </div>

               {/* Search & Team Filter (View by Team) */}
               {standings.length > 0 && (
                  <div className="space-y-2">
                     <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
                        <Input
                           type="text"
                           placeholder="Search participants..."
                           value={searchQuery}
                           onChange={(e) => {
                              setSearchQuery(e.target.value);
                              setParticipantPage(1);
                           }}
                           className="h-8 pl-8 pr-7 bg-surface-elevated border-border-strong text-white text-xs placeholder:text-text-tertiary rounded-xl"
                        />
                        {searchQuery && (
                           <button
                              type="button"
                              onClick={() => {
                                 setSearchQuery("");
                                 setParticipantPage(1);
                              }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-white p-0.5"
                           >
                              <X className="h-3 w-3" />
                           </button>
                        )}
                     </div>

                     {activeTeams.length > 0 && (
                        <div className="relative">
                           <Select
                              value={selectedTeamId}
                              onValueChange={(val) => {
                                 setSelectedTeamId(val);
                                 setParticipantPage(1);
                              }}
                           >
                              <SelectTrigger
                                 data-testid="overview-team-select"
                                 className="h-8 w-full rounded-xl border-border-strong bg-surface-elevated text-xs text-white"
                              >
                                 <SelectValue placeholder="All Teams" />
                              </SelectTrigger>
                              <SelectContent>
                                 <SelectItem value="ALL">
                                    All Teams ({standings.length})
                                 </SelectItem>
                                 {activeTeams.map((t) => (
                                    <SelectItem key={t.id} value={t.id}>
                                       {t.iconEmoji ? `${t.iconEmoji} ` : ""}
                                       {t.name} ({t.companionCount})
                                    </SelectItem>
                                 ))}
                              </SelectContent>
                           </Select>
                        </div>
                     )}

                     {hasActiveFilters && (
                        <div className="flex items-center justify-between text-meta text-text-tertiary pt-0.5">
                           <span>Filtering active</span>
                           <button
                              type="button"
                              onClick={handleResetFilters}
                              className="hover:text-white underline underline-offset-2"
                           >
                              Clear filters
                           </button>
                        </div>
                     )}
                  </div>
               )}

               {standings.length === 0 ? (
                  <p className="text-xs text-text-tertiary text-center py-6 border border-dashed border-border-default rounded-xl">
                     No participants enrolled yet.
                  </p>
               ) : filteredParticipants.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-border-default rounded-xl space-y-2">
                     <p className="text-xs text-text-tertiary">
                        No participants match your search or team filter.
                     </p>
                     <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleResetFilters}
                        className="h-7 px-3 text-meta rounded-lg border-border-strong bg-surface-nested hover:bg-surface-nested text-white"
                     >
                        Reset filters
                     </Button>
                  </div>
               ) : (
                  <div className="space-y-2.5">
                     {displayedParticipants.map((p) => {
                        const pPalette = getTeamColorPalette(p.teamColor);
                        return (
                           <div
                              key={p.participantId}
                              className="flex items-center justify-between p-2.5 rounded-xl bg-surface-elevated border border-border-default hover:border-border-strong transition-colors"
                           >
                              <div className="flex items-center gap-3 min-w-0">
                                 <Link
                                    href={`/challenge/${challenge.id}/participant/${p.participantId}`}
                                    className="h-8 w-8 rounded-full bg-surface-nested border overflow-hidden flex items-center justify-center text-xs font-bold text-white shrink-0 transition-colors"
                                    style={{
                                       borderColor: pPalette.borderMuted,
                                    }}
                                 >
                                    {p.image ? (
                                       <Image
                                          src={p.image}
                                          alt={p.displayName}
                                          width={32}
                                          height={32}
                                          className="object-cover"
                                       />
                                    ) : (
                                       <span>
                                          {p.displayName
                                             .charAt(0)
                                             .toUpperCase()}
                                       </span>
                                    )}
                                 </Link>
                                 <div className="min-w-0">
                                    <Link
                                       href={`/challenge/${challenge.id}/participant/${p.participantId}`}
                                       className="text-sm font-semibold text-white hover:underline truncate block"
                                    >
                                       {p.displayName}
                                    </Link>
                                    <span
                                       className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label font-semibold border shrink-0 mt-0.5"
                                       style={{
                                          backgroundColor: pPalette.badgeBg,
                                          borderColor: pPalette.badgeBorder,
                                          color: pPalette.text,
                                       }}
                                    >
                                       {p.teamIcon && <span>{p.teamIcon}</span>}
                                       <span>{p.teamName}</span>
                                    </span>
                                 </div>
                              </div>

                              <div className="flex items-center gap-2.5 shrink-0">
                                 <div className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-feedback-success" />
                                    <span className="text-meta font-medium text-text-secondary">
                                       Active
                                    </span>
                                 </div>
                                 {isAdmin && (
                                    <Button
                                       type="button"
                                       variant="outline"
                                       size="sm"
                                       onClick={() => handleOpenOverride(p)}
                                       className="h-7 px-2.5 rounded-lg border-border-strong bg-surface-nested hover:bg-surface-nested text-white text-meta font-semibold gap-1 shrink-0"
                                       title={`Admin: Edit hours for ${p.displayName}`}
                                    >
                                       <Clock className="h-3 w-3 text-feedback-info" />
                                       <span>Edit hr</span>
                                    </Button>
                                 )}
                              </div>
                           </div>
                        );
                     })}
                  </div>
               )}

               <DataPagination
                  currentPage={safeParticipantPage}
                  totalPages={totalParticipantPages}
                  totalItems={filteredParticipants.length}
                  pageSize={participantPageSize}
                  onPageChange={setParticipantPage}
                  itemLabel="participants"
                  compact={true}
               />
            </div>

            {isWithdrawalEnabled &&
               challenge.currentUser.isEnrolled &&
               challenge.status !== "COMPLETED" &&
               !challenge.resultsLockedAt && (
                  <WithdrawChallengeButton
                     challengeId={challenge.id}
                     challengeTitle={challenge.title}
                  />
               )}
         </div>

         {/* Admin Hours Override Modal (FEAT-LOG-04) */}
         {isAdmin && (
            <AdminHoursOverrideModal
               isOpen={isOverrideModalOpen}
               onClose={() => setIsOverrideModalOpen(false)}
               challengeId={challenge.id}
               challengeStartDate={challenge.startAt}
               totalChallengeDays={challenge.totalDays || 7}
               participant={overrideParticipant}
               initialDayNumber={challenge.currentDayNumber || 1}
            />
         )}
      </div>
   );
}
