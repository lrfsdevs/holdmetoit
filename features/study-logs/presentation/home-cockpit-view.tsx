"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Calendar } from "lucide-react";
import { hasAdminPrivileges } from "@/features/auth/domain/auth-roles";
import { DailyHoursModal } from "./daily-hours-modal";
import { EnrollmentModal as JoinChallengeModal } from "@/features/challenges/presentation/enrollment-modal";
import {
   CockpitBannerCard,
   CockpitProgressCard,
   CockpitTasksSection,
} from "./cockpit";
import type { CockpitViewModel } from "@/features/study-logs/data/cockpit-data";
import type { UserCategorizedTasks } from "@/features/tasks/domain/task.types";

export interface HomeCockpitViewProps {
   displayName?: string;
   challengeId?: string;
   todayLoggedSeconds?: number;
   todayLoggedClock?: string;
   user?: {
      id?: string;
      name?: string | null;
      displayName?: string | null;
      username?: string | null;
      image?: string | null;
      role?: string | null;
   } | null;
   cockpit?: CockpitViewModel | null;
   upcomingChallenge?: {
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
   userTasks?: UserCategorizedTasks | null;
   isAdmin?: boolean;
   profileUrl?: string;
}

export function HomeCockpitView({
   displayName = "Unauthenticated",
   challengeId = "seed-honey-bees-vs-lavender-butterflies",
   todayLoggedSeconds = 0,
   todayLoggedClock = "00:00:00",
   user,
   cockpit,
   upcomingChallenge,
   userTasks,
   isAdmin,
   profileUrl,
}: HomeCockpitViewProps) {
   const effectiveIsAdmin = isAdmin ?? hasAdminPrivileges(user?.role);
   const [isHoursModalOpen, setIsHoursModalOpen] = useState(false);
   const [hoursModalDayNumber, setHoursModalDayNumber] = useState<
      number | undefined
   >(undefined);
   const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);

   const openHoursModal = (dayNumber?: number) => {
      setHoursModalDayNumber(dayNumber);
      setIsHoursModalOpen(true);
   };

   const activeChallengeId = cockpit?.challengeId ?? challengeId;
   const effectiveDisplayName =
      cockpit?.participant.displayName ||
      cockpit?.participant.username ||
      displayName;

   const isLoggedIn = Boolean(
      (user && (user.id || user.name || user.username)) ||
      cockpit?.participant.userId
   );

   const activeProfileUrl =
      profileUrl ??
      (cockpit?.challengeId && cockpit?.participant?.id
         ? `/challenge/${cockpit.challengeId}/participant/${cockpit.participant.id}`
         : "/profile");

   const effectiveTodaySeconds = cockpit
      ? cockpit.todayLoggedSeconds
      : todayLoggedSeconds;
   const effectiveTargetSeconds = cockpit?.targetSeconds ?? 0;
   const effectiveTargetClock = cockpit?.targetClock ?? "00:00:00";
   const effectiveTotalLoggedClock = cockpit?.totalLoggedClock ?? "00:00:00";

   const effectiveUserTasks = userTasks ?? cockpit?.userTasks;

   const formattedDate = new Date().toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
   });

   const { existingLogsMap, existingLeavesMap } = useMemo(() => {
      const logsMap: Record<string, number> = {};
      const leavesMap: Record<string, boolean> = {};
      cockpit?.logs.forEach((log) => {
         logsMap[log.logDate] = log.durationSeconds;
         if (log.isLeave) {
            leavesMap[log.logDate] = true;
         }
      });
      return { existingLogsMap: logsMap, existingLeavesMap: leavesMap };
   }, [cockpit?.logs]);

   return (
      <div className="space-y-8 max-w-4xl mx-auto px-4 py-8 sm:py-12">
         <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
               <h1 className="text-3xl sm:text-4xl font-extrabold text-[#ffffff] tracking-tight">
                  Welcome{" "}
                  {isLoggedIn ? (
                     <Link
                        href={activeProfileUrl}
                        className="hover:underline hover:text-[#22c55e] transition-colors"
                        title={`View profile for ${effectiveDisplayName}`}
                     >
                        {effectiveDisplayName}
                     </Link>
                  ) : (
                     effectiveDisplayName
                  )}
               </h1>
               <p className="text-sm font-medium text-[#868686] mt-1 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{formattedDate} (UTC)</span>
               </p>
            </div>
         </div>

         {/* Dynamic Cockpit Banner Card (Variants 1–7) */}
         {isLoggedIn && (
            <CockpitBannerCard
               cockpit={cockpit ?? null}
               upcomingChallenge={upcomingChallenge ?? null}
               effectiveTodaySeconds={effectiveTodaySeconds}
               activeChallengeId={activeChallengeId}
               onOpenHoursModal={openHoursModal}
               onOpenEnrollModal={() => setIsEnrollModalOpen(true)}
            />
         )}

         {/* Weekly Commitment Progress Card */}
         {isLoggedIn && cockpit && (
            <CockpitProgressCard
               cockpit={cockpit}
               effectiveTotalLoggedClock={effectiveTotalLoggedClock}
               effectiveTargetClock={effectiveTargetClock}
               effectiveTargetSeconds={effectiveTargetSeconds}
            />
         )}

         {/* Categorized Task Checklist (Daily & Weekly Todos) */}
         <CockpitTasksSection
            isLoggedIn={isLoggedIn}
            userId={user?.id || cockpit?.participant.userId || null}
            userTasks={effectiveUserTasks}
            challengeStartDate={cockpit?.challengeStartDate}
            todayDate={cockpit?.todayDate}
            todayDayNumber={cockpit?.todayDayNumber}
            onOpenHoursModal={openHoursModal}
            isAdmin={effectiveIsAdmin}
         />

         <DailyHoursModal
            key={`${hoursModalDayNumber ?? "today"}-${isHoursModalOpen}`}
            challengeId={activeChallengeId}
            isOpen={isHoursModalOpen}
            onClose={() => setIsHoursModalOpen(false)}
            todayDate={
               cockpit?.todayDate || new Date().toISOString().slice(0, 10)
            }
            todayDayNumber={cockpit?.todayDayNumber ?? 1}
            yesterdayDate={cockpit?.yesterdayDate}
            yesterdayDayNumber={cockpit?.yesterdayDayNumber}
            isYesterdayMissed={cockpit?.isYesterdayMissed ?? false}
            todayLoggedSeconds={effectiveTodaySeconds}
            todayIsLeave={cockpit?.todayIsLeave}
            yesterdayLoggedSeconds={cockpit?.yesterdayLoggedSeconds ?? 0}
            yesterdayIsLeave={cockpit?.yesterdayIsLeave}
            existingLogs={existingLogsMap}
            existingLeaves={existingLeavesMap}
            initialDayNumber={hoursModalDayNumber}
            challengeStartDate={cockpit?.challengeStartDate}
            isAdmin={effectiveIsAdmin}
         />

         {isLoggedIn && (upcomingChallenge || cockpit) && (
            <JoinChallengeModal
               challengeId={upcomingChallenge?.id ?? activeChallengeId}
               challengeTitle={
                  upcomingChallenge?.title ??
                  cockpit?.challengeTitle ??
                  "Challenge"
               }
               format={upcomingChallenge?.format ?? cockpit?.challengeFormat}
               teams={upcomingChallenge?.teams}
               isOpen={isEnrollModalOpen}
               onOpenChange={setIsEnrollModalOpen}
               showTrigger={false}
            />
         )}
      </div>
   );
}
