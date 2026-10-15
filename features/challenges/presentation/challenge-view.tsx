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

import type { LeaderboardViewMode } from "@/features/leaderboard/domain/leaderboard";

interface ChallengeViewProps {
   challenge: ChallengeScoreboardViewModel;
   initialTab?: ChallengeTab | string;
   isAdmin?: boolean;
   initialLeaderboardViewMode?: LeaderboardViewMode;
}

export function ChallengeView({
   challenge,
   initialTab = DEFAULT_CHALLENGE_TAB,
   isAdmin = false,
   initialLeaderboardViewMode = "individual",
}: ChallengeViewProps) {
   const [activeTab, setActiveTab] = useState<ChallengeTab>(() =>
      resolveAllowedChallengeTab(initialTab, isAdmin)
   );

   const isSummaryVisible = Boolean(challenge.resultsLockedAt);

   useEffect(() => {
      setActiveTab(resolveAllowedChallengeTab(initialTab, isAdmin));
   }, [initialTab, isAdmin]);

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
            <div className="flex items-center gap-1 sm:gap-1.5 rounded-xl border border-[#333333] bg-[#292929] p-1 sm:p-1.5 shadow-md max-w-full overflow-x-auto">
               <button
                  type="button"
                  onClick={() => handleTabChange("overview")}
                  className={`px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all ${
                     activeTab === "overview"
                        ? "bg-[#4a4a4a] text-[#ffffff] shadow"
                        : "text-[#868686] hover:text-[#ffffff] hover:bg-[#333333]"
                  }`}
               >
                  Overview
               </button>
               <button
                  type="button"
                  onClick={() => handleTabChange("leaderboard")}
                  className={`px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all ${
                     activeTab === "leaderboard"
                        ? "bg-[#4a4a4a] text-[#ffffff] shadow"
                        : "text-[#868686] hover:text-[#ffffff] hover:bg-[#333333]"
                  }`}
               >
                  Leaderboard
               </button>
               {isSummaryVisible && (
                  <button
                     type="button"
                     onClick={() => handleTabChange("summary")}
                     className={`px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all ${
                        activeTab === "summary"
                           ? "bg-[#4a4a4a] text-[#ffffff] shadow"
                           : "text-[#868686] hover:text-[#ffffff] hover:bg-[#333333]"
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
                        className={`px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all ${
                           activeTab === "manage"
                              ? "bg-[#4a4a4a] text-[#ffffff] shadow"
                              : "text-[#868686] hover:text-[#ffffff] hover:bg-[#333333]"
                        }`}
                     >
                        Manage
                     </button>
                     <button
                        type="button"
                        onClick={() => handleTabChange("audit")}
                        className={`px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all ${
                           activeTab === "audit"
                              ? "bg-[#4a4a4a] text-[#ffffff] shadow"
                              : "text-[#868686] hover:text-[#ffffff] hover:bg-[#333333]"
                        }`}
                     >
                        Audit Log
                     </button>
                  </>
               )}
            </div>
         </div>

         {activeTab === "overview" && (
            <ChallengeOverviewTab challenge={challenge} isAdmin={isAdmin} />
         )}

         {activeTab === "leaderboard" && (
            <div className="space-y-8">
               <ChallengeLeaderboardTab
                  challenge={challenge}
                  isAdmin={isAdmin}
                  initialViewMode={initialLeaderboardViewMode}
               />
            </div>
         )}

         {activeTab === "summary" && isSummaryVisible && (
            <ChallengeSummaryTab challenge={challenge} />
         )}

         {activeTab === "manage" && isAdmin && (
            <ChallengeManageTab challenge={challenge} />
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
