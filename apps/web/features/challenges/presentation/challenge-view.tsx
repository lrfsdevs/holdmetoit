"use client";

import { useEffect, useState } from "react";
import type { ChallengeScoreboardViewModel } from "@/features/leaderboard/domain/leaderboard.types";
import {
   type ChallengeTab,
   DEFAULT_CHALLENGE_TAB,
   resolveAllowedChallengeTab,
} from "@/features/challenges/domain/challenge-tabs";
import { ChallengeHeroBanner } from "./challenge-hero-banner";
import { ChallengeOverviewTab } from "./challenge-overview-tab";
import { ChallengeLeaderboardTab } from "@/features/leaderboard/presentation/challenge-leaderboard-tab";
import { ChallengeManageTab } from "./challenge-manage-tab";
import { EventAuditTab } from "@/features/audit/presentation/event-audit-tab";
import { ChallengeSummaryTab } from "@/features/wrapped/presentation/challenge-summary-tab";
import { ChallengeWrappedModal } from "@/features/wrapped/presentation/challenge-wrapped-modal";

import {
   resolveLeaderboardViewMode,
   type LeaderboardViewMode,
} from "@/features/leaderboard/domain/leaderboard";

interface ChallengeViewProps {
   challenge: ChallengeScoreboardViewModel;
   initialTab?: ChallengeTab | string;
   isAdmin?: boolean;
   initialLeaderboardViewMode?: LeaderboardViewMode;
   initialRosterSearch?: string;
   initialRosterTeamFilter?: string;
   initialRosterPage?: number;
   /** Server-evaluated `challenge_wrapped_v1`. Gates the Summary tab and the wrapped story popup. */
   isWrappedEnabled?: boolean;
   /** Server-evaluated `betting_system_v1`. Gates the overview betting card. */
   isBettingEnabled?: boolean;
   /** Server-evaluated `challenge_withdrawal_v1`. Gates the overview withdraw button. */
   isWithdrawalEnabled?: boolean;
   /** Server-evaluated `global_leaderboard_v1`. Gates trophy rank badges in standings. */
   isGlobalLeaderboardEnabled?: boolean;
}

/** Renders the challenge shell and coordinates its active tab. */
export function ChallengeView({
   challenge,
   initialTab = DEFAULT_CHALLENGE_TAB,
   isAdmin = false,
   initialLeaderboardViewMode,
   initialRosterSearch = "",
   initialRosterTeamFilter = "ALL",
   initialRosterPage = 1,
   isWrappedEnabled = true,
   isBettingEnabled = true,
   isWithdrawalEnabled = false,
   isGlobalLeaderboardEnabled = false,
}: ChallengeViewProps) {
   const isSummaryVisible =
      isWrappedEnabled && Boolean(challenge.resultsLockedAt);
   const resolvedLeaderboardViewMode =
      initialLeaderboardViewMode ??
      resolveLeaderboardViewMode(null, challenge.format);

   const [activeTab, setActiveTab] = useState<ChallengeTab>(() =>
      resolveAllowedChallengeTab(initialTab, isAdmin, { isSummaryVisible })
   );

   useEffect(() => {
      setActiveTab(
         resolveAllowedChallengeTab(initialTab, isAdmin, { isSummaryVisible })
      );
   }, [initialTab, isAdmin, isSummaryVisible]);

   const handleTabChange = (tab: ChallengeTab) => {
      const allowedTab = resolveAllowedChallengeTab(tab, isAdmin, {
         isSummaryVisible,
      });
      setActiveTab(allowedTab);

      if (typeof window !== "undefined") {
         const url = new URL(window.location.href);
         if (allowedTab === DEFAULT_CHALLENGE_TAB) {
            url.searchParams.delete("tab");
         } else {
            url.searchParams.set("tab", allowedTab);
         }
         if (allowedTab !== "leaderboard") {
            url.searchParams.delete("view");
         }
         if (allowedTab !== "manage") {
            url.searchParams.delete("search");
            url.searchParams.delete("team");
            url.searchParams.delete("page");
         }
         window.history.replaceState(
            null,
            "",
            `${url.pathname}${url.search}${url.hash}`
         );
      }
   };

   return (
      <div className="space-y-8 max-w-6xl mx-auto">
         <ChallengeHeroBanner challenge={challenge} />

         <div className="flex items-center justify-center w-full overflow-hidden">
            <div className="flex items-center gap-1 sm:gap-1.5 rounded-xl border border-border-strong bg-surface-nested p-1 sm:p-1.5 shadow-md max-w-full overflow-x-auto">
               <button
                  type="button"
                  onClick={() => handleTabChange("overview")}
                  className={`px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg text-meta sm:text-xs font-semibold whitespace-nowrap transition-all ${
                     activeTab === "overview"
                        ? "bg-input-bg text-white shadow"
                        : "text-text-tertiary hover:text-white hover:bg-surface-nested"
                  }`}
               >
                  Overview
               </button>
               <button
                  type="button"
                  onClick={() => handleTabChange("leaderboard")}
                  className={`px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg text-meta sm:text-xs font-semibold whitespace-nowrap transition-all ${
                     activeTab === "leaderboard"
                        ? "bg-input-bg text-white shadow"
                        : "text-text-tertiary hover:text-white hover:bg-surface-nested"
                  }`}
               >
                  Leaderboard
               </button>
               {isSummaryVisible && (
                  <button
                     type="button"
                     onClick={() => handleTabChange("summary")}
                     className={`px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg text-meta sm:text-xs font-semibold whitespace-nowrap transition-all ${
                        activeTab === "summary"
                           ? "bg-input-bg text-white shadow"
                           : "text-text-tertiary hover:text-white hover:bg-surface-nested"
                     }`}
                  >
                     Summary
                  </button>
               )}
               {isAdmin && (
                  <>
                     <button
                        type="button"
                        onClick={() => handleTabChange("manage")}
                        className={`px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg text-meta sm:text-xs font-semibold whitespace-nowrap transition-all ${
                           activeTab === "manage"
                              ? "bg-input-bg text-white shadow"
                              : "text-text-tertiary hover:text-white hover:bg-surface-nested"
                        }`}
                     >
                        Manage
                     </button>
                     <button
                        type="button"
                        onClick={() => handleTabChange("audit")}
                        className={`px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg text-meta sm:text-xs font-semibold whitespace-nowrap transition-all ${
                           activeTab === "audit"
                              ? "bg-input-bg text-white shadow"
                              : "text-text-tertiary hover:text-white hover:bg-surface-nested"
                        }`}
                     >
                        Audit Log
                     </button>
                  </>
               )}
            </div>
         </div>

         {activeTab === "overview" && (
            <ChallengeOverviewTab
               challenge={challenge}
               isAdmin={isAdmin}
               isBettingEnabled={isBettingEnabled}
               isWithdrawalEnabled={isWithdrawalEnabled}
            />
         )}

         {activeTab === "leaderboard" && (
            <div className="space-y-8">
               <ChallengeLeaderboardTab
                  challenge={challenge}
                  isAdmin={isAdmin}
                  initialViewMode={resolvedLeaderboardViewMode}
                  isGlobalLeaderboardEnabled={isGlobalLeaderboardEnabled}
               />
            </div>
         )}

         {activeTab === "summary" && isSummaryVisible && (
            <ChallengeSummaryTab challenge={challenge} />
         )}

         {activeTab === "manage" && isAdmin && (
            <ChallengeManageTab
               challenge={challenge}
               initialRosterSearch={initialRosterSearch}
               initialRosterTeamFilter={initialRosterTeamFilter}
               initialRosterPage={initialRosterPage}
            />
         )}

         {activeTab === "audit" && isAdmin && (
            <EventAuditTab
               challengeId={challenge.id}
               challengeTitle={challenge.title}
            />
         )}

         {isSummaryVisible && challenge.currentUser.isEnrolled && (
            <ChallengeWrappedModal challenge={challenge} />
         )}
      </div>
   );
}
