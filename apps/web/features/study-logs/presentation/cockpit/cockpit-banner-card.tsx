"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
   determineBannerVariant,
   formatOrdinalRank,
   formatStudiedTodayHours,
} from "@/features/study-logs/domain/cockpit-banner";
import type { CockpitViewModel } from "@/features/study-logs/data/cockpit-data";

export interface CockpitBannerCardProps {
   cockpit: CockpitViewModel | null;
   upcomingChallenge: {
      id: string;
      title: string;
      format: "TEAM_VS_TEAM" | "DUOS" | "SOLOS";
      teams?: Array<{
         id: string;
         name: string;
         color: string | null;
         iconEmoji: string | null;
      }>;
   } | null;
   effectiveTodaySeconds: number;
   activeChallengeId: string;
   onOpenHoursModal: (dayNumber?: number) => void;
   onOpenEnrollModal: () => void;
}

/** Renders the contextual participant cockpit banner. */
export function CockpitBannerCard({
   cockpit,
   upcomingChallenge,
   effectiveTodaySeconds,
   activeChallengeId,
   onOpenHoursModal,
   onOpenEnrollModal,
}: CockpitBannerCardProps) {
   const isEnrolledInChallenge = Boolean(cockpit);
   const hasChallenge = Boolean(cockpit || upcomingChallenge);
   const activeChallengeStatus =
      cockpit?.challengeStatus ?? (upcomingChallenge ? "UPCOMING" : null);
   const activeChallengeFormat =
      cockpit?.challengeFormat ?? upcomingChallenge?.format ?? null;
   const todayDayNumber = cockpit?.todayDayNumber ?? 1;
   const yesterdayDayNumber = cockpit?.yesterdayDayNumber;
   const targetChallengeId = upcomingChallenge?.id ?? activeChallengeId;

   const bannerVariant = determineBannerVariant({
      isEnrolled: isEnrolledInChallenge,
      hasChallenge,
      challengeStatus: activeChallengeStatus,
      challengeFormat: activeChallengeFormat,
      todayLoggedSeconds: effectiveTodaySeconds,
      todayIsLeave: cockpit?.todayIsLeave,
      isYesterdayMissed: cockpit?.isYesterdayMissed ?? false,
      isResultsLocked: cockpit?.isResultsLocked ?? false,
   });

   if (bannerVariant === "NONE") {
      return null;
   }

   if (bannerVariant === "ON_LEAVE_TODAY") {
      return (
         <div className="rounded-2xl border border-brand-2/40 bg-brand-1/15 p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
            <div>
               <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <span>🌴</span>
                  <span>You are on leave today</span>
               </h3>
               <p className="text-xs sm:text-sm text-text-secondary mt-1">
                  Take a well-deserved rest, or update your study hours whenever
                  you are ready.
               </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 shrink-0 w-full sm:w-auto">
               <Button
                  type="button"
                  onClick={() => onOpenHoursModal(todayDayNumber)}
                  className="w-full sm:w-auto h-10 px-5 rounded-full bg-white text-black hover:bg-white/90 text-xs sm:text-sm font-bold transition-colors shadow-sm"
               >
                  Update Today Hours
               </Button>
            </div>
         </div>
      );
   }

   if (bannerVariant === "STUDIED_TODAY") {
      return (
         <div className="rounded-2xl border border-feedback-success-bg/40 bg-feedback-success-bg p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
            <div>
               <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Wow, you studied{" "}
                  {formatStudiedTodayHours(effectiveTodaySeconds)} today
               </h3>
               <p className="text-xs sm:text-sm text-text-secondary mt-1">
                  Work hard, stay consistent, and keep your team on top
               </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 shrink-0 w-full sm:w-auto">
               <Button
                  asChild
                  variant="outline"
                  className="w-full sm:w-auto h-10 px-5 rounded-full border border-white text-white bg-transparent hover:bg-white/10 text-xs sm:text-sm font-semibold transition-colors"
               >
                  <Link
                     href={`/challenge/${activeChallengeId}?tab=leaderboard`}
                  >
                     View Leaderboard
                  </Link>
               </Button>
               <Button
                  type="button"
                  onClick={() => onOpenHoursModal(todayDayNumber)}
                  className="w-full sm:w-auto h-10 px-5 rounded-full bg-white text-black hover:bg-white/90 text-xs sm:text-sm font-bold transition-colors shadow-sm"
               >
                  Log Today&apos;s Hours
               </Button>
            </div>
         </div>
      );
   }

   if (bannerVariant === "NOT_LOGGED_TODAY") {
      return (
         <div className="rounded-2xl border border-feedback-error-bg/40 bg-feedback-error-bg p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
            <div>
               <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  You haven&apos;t logged today&apos;s hours
               </h3>
               <p className="text-xs sm:text-sm text-text-secondary mt-1">
                  Work hard, stay consistent, and keep your team on top
               </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 shrink-0 w-full sm:w-auto">
               <Button
                  asChild
                  variant="outline"
                  className="w-full sm:w-auto h-10 px-5 rounded-full border border-white text-white bg-transparent hover:bg-white/10 text-xs sm:text-sm font-semibold transition-colors"
               >
                  <Link
                     href={`/challenge/${activeChallengeId}?tab=leaderboard`}
                  >
                     View Leaderboard
                  </Link>
               </Button>
               <Button
                  type="button"
                  onClick={() => onOpenHoursModal(todayDayNumber)}
                  className="w-full sm:w-auto h-10 px-5 rounded-full bg-white text-black hover:bg-white/90 text-xs sm:text-sm font-bold transition-colors shadow-sm"
               >
                  Log Today&apos;s Hours
               </Button>
            </div>
         </div>
      );
   }

   if (bannerVariant === "FORGOT_YESTERDAY") {
      return (
         <div className="rounded-2xl border border-feedback-error/40 bg-feedback-error-bg p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
            <div>
               <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Don&apos;t forget yesterday&apos;s hard work!
               </h3>
               <p className="text-xs sm:text-sm text-text-secondary mt-1">
                  Log it as leave and get right back into the challenge today
               </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 shrink-0 w-full sm:w-auto">
               <Button
                  type="button"
                  onClick={() => onOpenHoursModal(yesterdayDayNumber)}
                  className="w-full sm:w-auto h-10 px-5 rounded-full bg-white text-black hover:bg-white/90 text-xs sm:text-sm font-bold transition-colors shadow-sm"
               >
                  Log Yesterday Hours
               </Button>
            </div>
         </div>
      );
   }

   if (bannerVariant === "CHALLENGE_COMPLETED") {
      return (
         <div className="rounded-2xl border border-feedback-info/40 bg-feedback-info-bg p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
            <div>
               <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Congrats, your team secured{" "}
                  {formatOrdinalRank(cockpit?.teamRank ?? 1)} in this challenge
               </h3>
               <p className="text-xs sm:text-sm text-text-secondary mt-1">
                  Work hard, stay consistent, and come stronger next time
               </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 shrink-0 w-full sm:w-auto">
               <Button
                  asChild
                  className="w-full sm:w-auto h-10 px-5 rounded-full bg-white text-black hover:bg-white/90 text-xs sm:text-sm font-bold transition-colors shadow-sm"
               >
                  <Link
                     href={`/challenge/${activeChallengeId}?tab=leaderboard`}
                  >
                     View Leaderboard
                  </Link>
               </Button>
            </div>
         </div>
      );
   }

   if (bannerVariant === "ENROLL_SOLO") {
      return (
         <div className="rounded-2xl border border-accent-bg/40 bg-accent-bg p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
            <div>
               <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Enroll in solo battle this week
               </h3>
               <p className="text-xs sm:text-sm text-text-secondary mt-1">
                  Work hard, stay consistent, and keep your team on top
               </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 shrink-0 w-full sm:w-auto">
               <Button
                  asChild
                  variant="outline"
                  className="w-full sm:w-auto h-10 px-5 rounded-full border border-white text-white bg-transparent hover:bg-white/10 text-xs sm:text-sm font-semibold transition-colors"
               >
                  <Link href={`/challenge/${targetChallengeId}`}>View</Link>
               </Button>
               <Button
                  type="button"
                  onClick={onOpenEnrollModal}
                  className="w-full sm:w-auto h-10 px-5 rounded-full bg-white text-black hover:bg-white/90 text-xs sm:text-sm font-bold transition-colors shadow-sm"
               >
                  Enroll
               </Button>
            </div>
         </div>
      );
   }

   if (bannerVariant === "ENROLL_GROUP") {
      return (
         <div className="rounded-2xl border border-accent-bg/40 bg-accent-bg p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
            <div>
               <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Enroll in group battle this week
               </h3>
               <p className="text-xs sm:text-sm text-text-secondary mt-1">
                  Work hard, stay consistent, and keep your team on top
               </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 shrink-0 w-full sm:w-auto">
               <Button
                  asChild
                  variant="outline"
                  className="w-full sm:w-auto h-10 px-5 rounded-full border border-white text-white bg-transparent hover:bg-white/10 text-xs sm:text-sm font-semibold transition-colors"
               >
                  <Link href={`/challenge/${targetChallengeId}`}>View</Link>
               </Button>
               <Button
                  type="button"
                  onClick={onOpenEnrollModal}
                  className="w-full sm:w-auto h-10 px-5 rounded-full bg-white text-black hover:bg-white/90 text-xs sm:text-sm font-bold transition-colors shadow-sm"
               >
                  Enroll
               </Button>
            </div>
         </div>
      );
   }

   if (bannerVariant === "ENROLL_DUO") {
      return (
         <div className="rounded-2xl border border-accent-bg/40 bg-accent-bg p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
            <div>
               <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Enroll in duo battle this week
               </h3>
               <p className="text-xs sm:text-sm text-text-secondary mt-1">
                  Work hard, stay consistent, and keep your team on top
               </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 shrink-0 w-full sm:w-auto">
               <Button
                  asChild
                  variant="outline"
                  className="w-full sm:w-auto h-10 px-5 rounded-full border border-white text-white bg-transparent hover:bg-white/10 text-xs sm:text-sm font-semibold transition-colors"
               >
                  <Link href={`/challenge/${targetChallengeId}`}>View</Link>
               </Button>
               <Button
                  type="button"
                  onClick={onOpenEnrollModal}
                  className="w-full sm:w-auto h-10 px-5 rounded-full bg-white text-black hover:bg-white/90 text-xs sm:text-sm font-bold transition-colors shadow-sm"
               >
                  Enroll
               </Button>
            </div>
         </div>
      );
   }

   // ENROLLED_UPCOMING
   return (
      <div className="rounded-2xl border border-accent-bg/40 bg-accent-bg p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
         <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
               {activeChallengeFormat === "SOLOS"
                  ? "You are enrolled in solo battle this week"
                  : activeChallengeFormat === "DUOS"
                    ? "You are enrolled in duo battle this week"
                    : "You are enrolled in group battle this week"}
            </h3>
            <p className="text-xs sm:text-sm text-text-secondary mt-1">
               Work hard, stay consistent, and keep your team on top
            </p>
         </div>

         <div className="flex items-center gap-3 shrink-0">
            <Button
               asChild
               variant="outline"
               className="h-10 px-5 rounded-full border border-white text-white bg-transparent hover:bg-white/10 text-xs sm:text-sm font-semibold transition-colors"
            >
               <Link href={`/challenge/${activeChallengeId}`}>View</Link>
            </Button>
            <Button
               disabled
               className="h-10 px-5 rounded-full bg-white/80 text-black text-xs sm:text-sm font-bold opacity-90 cursor-default"
            >
               Enrolled ✓
            </Button>
         </div>
      </div>
   );
}
