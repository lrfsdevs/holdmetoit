"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
   Clock,
   Calendar,
   Flame,
   Trophy,
   CheckCircle2,
   Sparkles,
   Swords,
   Lock,
   Settings,
   User,
   History,
   Shield,
} from "lucide-react";
import type {
   GlobalUserProfile,
   ParticipatedChallengeItem,
} from "../domain/global-profile.types";
import type { ParticipantStatsViewModel } from "../domain/participant-stats.types";
import { UserAvatar } from "@/components/ui/user-avatar";
import { RefreshAvatarButton } from "@/features/auth/presentation/refresh-avatar-button";
import { ChallengeSnapshot } from "./challenge-snapshot";
import { EmptyState } from "@/components/state/empty-state";
import { CockpitSkeleton } from "@/components/state/cockpit-skeleton";
import { YptSettingsCard } from "@/features/ypt/presentation/ypt-settings-card";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@/components/ui/select";
import { getChallengeSnapshotAction } from "../api/global-profile.actions";
import { Button } from "@/components/ui/button";

export interface GlobalProfileViewProps {
   profile: GlobalUserProfile;
   initialChallengeSnapshot?: ParticipantStatsViewModel | null;
   selectedChallengeId?: string;
   isAuthorizedHistory?: boolean;
   isOwnProfile?: boolean;
   viewerRole?: string | null;
   initialYptId?: string | null;
}

export function GlobalProfileView({
   profile,
   initialChallengeSnapshot = null,
   selectedChallengeId,
   isAuthorizedHistory = true,
   isOwnProfile = false,
   initialYptId,
}: GlobalProfileViewProps) {
   const router = useRouter();
   const searchParams = useSearchParams();

   const { user, careerStats, challengeHistory } = profile;

   // Active tab state
   const [activeTab, setActiveTab] = useState<
      "overview" | "history" | "settings"
   >(() => {
      const tabParam = searchParams?.get("tab");
      if (tabParam === "history") return "history";
      if (tabParam === "settings" && isOwnProfile) return "settings";
      return "overview";
   });

   // Challenge selection and snapshot state
   const defaultChallengeId =
      selectedChallengeId || challengeHistory[0]?.challengeId || "";

   const [currentChallengeId, setCurrentChallengeId] =
      useState<string>(defaultChallengeId);
   const [currentSnapshot, setCurrentSnapshot] =
      useState<ParticipantStatsViewModel | null>(initialChallengeSnapshot);
   const [isPending, startTransition] = useTransition();
   const [snapshotError, setSnapshotError] = useState<string | null>(null);

   const handleChallengeChange = (newChallengeId: string) => {
      setCurrentChallengeId(newChallengeId);
      setSnapshotError(null);

      // Update URL query param cleanly
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("challengeId", newChallengeId);
      params.set("tab", "history");
      router.replace(`?${params.toString()}`, { scroll: false });

      // Fetch snapshot via server action
      startTransition(async () => {
         const res = await getChallengeSnapshotAction(user.id, newChallengeId);
         if (res.success && res.data) {
            setCurrentSnapshot(res.data);
         } else {
            setSnapshotError(
               res.message || "Failed to load challenge snapshot."
            );
         }
      });
   };

   // Formatted join date
   const joinDateFormatted = new Date(user.joinedAt).toLocaleDateString(
      "en-US",
      {
         month: "short",
         year: "numeric",
         timeZone: "UTC",
      }
   );

   return (
      <div
         className="space-y-8 max-w-6xl mx-auto pb-16 px-4 sm:px-6"
         data-testid="global-profile-view"
      >
         {/* 1. Profile Header Card */}
         <div className="rounded-3xl border border-border-default bg-surface-primary p-6 sm:p-8 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
               <div className="flex items-center gap-4 sm:gap-5 min-w-0">
                  <div className="relative shrink-0">
                     <UserAvatar
                        src={user.image}
                        name={user.displayName}
                        userId={user.id}
                        size="xl"
                        className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl border-2 border-border-strong shadow-md text-xl"
                     />
                  </div>

                  <div className="min-w-0 space-y-1">
                     <div className="flex items-center gap-2.5 flex-wrap">
                        <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight truncate">
                           {user.displayName}
                        </h1>

                        {/* Trophy Rank Badge */}
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border border-brand-1/40 bg-brand-1/15 text-brand-1 shadow-sm">
                           <Trophy className="h-3.5 w-3.5 fill-current" />
                           <span>{careerStats.trophyRank}</span>
                           <span className="opacity-75 font-normal">
                              ({careerStats.trophyTotal} trophies)
                           </span>
                        </span>
                     </div>

                     {user.username && (
                        <p className="text-xs text-text-tertiary">
                           @{user.username}
                        </p>
                     )}

                     <p className="text-xs text-text-tertiary flex items-center gap-1.5 pt-0.5">
                        <Calendar className="h-3.5 w-3.5 text-text-tertiary" />
                        <span>Member since {joinDateFormatted}</span>
                     </p>
                  </div>
               </div>

               {/* Right Actions: Quick Refresh Avatar for Profile Owner */}
               {isOwnProfile && (
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-border-default">
                     <RefreshAvatarButton
                        userId={user.id}
                        size="sm"
                        className="rounded-xl border-border-strong bg-surface-nested hover:bg-surface-elevated text-xs font-semibold text-text-secondary hover:text-white"
                     />
                  </div>
               )}
            </div>
         </div>

         {/* 2. Navigation Tabs */}
         <div className="flex items-center gap-2 border-b border-border-default pb-2">
            <button
               type="button"
               onClick={() => setActiveTab("overview")}
               className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  activeTab === "overview"
                     ? "bg-surface-elevated text-white border border-border-strong shadow-md"
                     : "text-text-tertiary hover:text-text-secondary hover:bg-surface-nested/50"
               }`}
               data-testid="tab-overview"
            >
               <User className="h-4 w-4" />
               <span>Overview</span>
            </button>

            <button
               type="button"
               onClick={() => setActiveTab("history")}
               className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  activeTab === "history"
                     ? "bg-surface-elevated text-white border border-border-strong shadow-md"
                     : "text-text-tertiary hover:text-text-secondary hover:bg-surface-nested/50"
               }`}
               data-testid="tab-history"
            >
               <History className="h-4 w-4" />
               <span>Challenge History</span>
               {challengeHistory.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-label font-bold bg-surface-primary text-text-secondary">
                     {challengeHistory.length}
                  </span>
               )}
            </button>

            {isOwnProfile && (
               <button
                  type="button"
                  onClick={() => setActiveTab("settings")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                     activeTab === "settings"
                        ? "bg-surface-elevated text-white border border-border-strong shadow-md"
                        : "text-text-tertiary hover:text-text-secondary hover:bg-surface-nested/50"
                  }`}
                  data-testid="tab-settings"
               >
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
               </button>
            )}
         </div>

         {/* 3. TAB CONTENT */}

         {/* TAB 1: OVERVIEW */}
         {activeTab === "overview" && (
            <div className="space-y-8" data-testid="overview-content">
               {/* Global Career Overview Cards */}
               <div className="space-y-3">
                  <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                     <Shield className="h-4 w-4 text-feedback-info" />
                     <span>Lifetime Career Statistics</span>
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                     {/* Lifetime Study Time */}
                     <div className="rounded-2xl border border-border-default bg-surface-primary p-5 space-y-1.5 shadow-md">
                        <span className="text-xs text-text-tertiary flex items-center gap-1.5">
                           <Clock className="h-3.5 w-3.5 text-feedback-info" />
                           Lifetime Study Time
                        </span>
                        <p className="text-xl sm:text-2xl font-extrabold font-sans font-sans-tabular text-white">
                           {careerStats.lifetimeStudyClock}
                        </p>
                        <p className="text-xs text-text-tertiary">
                           {careerStats.lifetimeStudyHuman} logged across all
                           events
                        </p>
                     </div>

                     {/* Active Study Days */}
                     <div className="rounded-2xl border border-border-default bg-surface-primary p-5 space-y-1.5 shadow-md">
                        <span className="text-xs text-text-tertiary flex items-center gap-1.5">
                           <Calendar className="h-3.5 w-3.5 text-feedback-success" />
                           Active Study Days
                        </span>
                        <p className="text-xl sm:text-2xl font-extrabold font-sans font-sans-tabular text-white">
                           {careerStats.totalActiveStudyDays} Days
                        </p>
                        <p className="text-xs text-text-tertiary">
                           Calendar days with dedicated study activity
                        </p>
                     </div>

                     {/* Daily Streaks */}
                     <div className="rounded-2xl border border-border-default bg-surface-primary p-5 space-y-1.5 shadow-md">
                        <span className="text-xs text-text-tertiary flex items-center gap-1.5">
                           <Flame className="h-3.5 w-3.5 text-brand-1" />
                           Study Streak
                        </span>
                        <p className="text-xl sm:text-2xl font-extrabold font-sans font-sans-tabular text-brand-1">
                           {careerStats.currentStreak} Days
                        </p>
                        <p className="text-xs text-text-tertiary">
                           Personal longest: {careerStats.longestStreak}{" "}
                           consecutive days
                        </p>
                     </div>

                     {/* Challenges Entered & Completed */}
                     <div className="rounded-2xl border border-border-default bg-surface-primary p-5 space-y-1.5 shadow-md">
                        <span className="text-xs text-text-tertiary flex items-center gap-1.5">
                           <Swords className="h-3.5 w-3.5 text-accent-text" />
                           Challenges Participated
                        </span>
                        <p className="text-xl sm:text-2xl font-extrabold font-sans font-sans-tabular text-white">
                           {careerStats.totalChallengesEntered} Entered
                        </p>
                        <p className="text-xs text-text-tertiary">
                           {careerStats.challengesCompleted} challenges
                           completed to victory
                        </p>
                     </div>

                     {/* Completed Tasks */}
                     <div className="rounded-2xl border border-border-default bg-surface-primary p-5 space-y-1.5 shadow-md">
                        <span className="text-xs text-text-tertiary flex items-center gap-1.5">
                           <CheckCircle2 className="h-3.5 w-3.5 text-feedback-success" />
                           Tasks Completed
                        </span>
                        <p className="text-xl sm:text-2xl font-extrabold font-sans font-sans-tabular text-white">
                           {careerStats.totalTasksCompleted}
                        </p>
                        <p className="text-xs text-text-tertiary">
                           Daily & weekly commitments finished
                        </p>
                     </div>

                     {/* Pokédex Collection */}
                     <div className="rounded-2xl border border-border-default bg-surface-primary p-5 space-y-1.5 shadow-md">
                        <span className="text-xs text-text-tertiary flex items-center gap-1.5">
                           <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
                           Pokédex Collection
                        </span>
                        <p className="text-xl sm:text-2xl font-extrabold font-sans font-sans-tabular text-white">
                           {careerStats.pokedexCount} Pokémon
                        </p>
                        <p className="text-xs text-text-tertiary">
                           Collected through daily study rewards
                        </p>
                     </div>
                  </div>
               </div>

               {/* Recent Challenge Spotlight / Call to Action */}
               {challengeHistory.length > 0 ? (
                  <div className="rounded-3xl border border-border-default bg-surface-primary p-6 space-y-4">
                     <div className="flex items-center justify-between">
                        <h3 className="text-sm sm:text-base font-bold text-white">
                           Latest Challenge Participation
                        </h3>
                        <Button
                           variant="outline"
                           size="sm"
                           onClick={() => setActiveTab("history")}
                           className="text-xs rounded-xl"
                        >
                           Browse Full History
                        </Button>
                     </div>

                     <div className="rounded-2xl border border-border-strong bg-surface-elevated p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                           <p className="font-bold text-white text-base">
                              {challengeHistory[0].title}
                           </p>
                           <p className="text-xs text-text-tertiary mt-0.5">
                              {challengeHistory[0].loggedHours}h logged of{" "}
                              {challengeHistory[0].targetHours}h target ·{" "}
                              {challengeHistory[0].status}
                           </p>
                        </div>
                        <Button
                           asChild
                           size="sm"
                           className="rounded-xl shrink-0"
                        >
                           <Link
                              href={`/challenge/${challengeHistory[0].challengeId}/participant/${challengeHistory[0].participantId}`}
                           >
                              Open Challenge Cockpit
                           </Link>
                        </Button>
                     </div>
                  </div>
               ) : (
                  <div className="rounded-3xl border border-border-default bg-surface-primary p-8 text-center space-y-3">
                     <p className="text-sm font-semibold text-white">
                        No Study Challenges Yet
                     </p>
                     <p className="text-xs text-text-tertiary max-w-md mx-auto">
                        This scholar hasn&apos;t enrolled in any study
                        challenges yet. Explore active community challenges to
                        start competing!
                     </p>
                     <Button asChild className="rounded-full">
                        <Link href="/challenges">Explore Challenges</Link>
                     </Button>
                  </div>
               )}
            </div>
         )}

         {/* TAB 2: CHALLENGE HISTORY */}
         {activeTab === "history" && (
            <div className="space-y-6" data-testid="history-content">
               {/* Privacy Boundary Check */}
               {!isAuthorizedHistory ? (
                  <EmptyState
                     title="Private Challenge History"
                     description="Detailed challenge performance, targets, and day-by-day study history are only visible to accepted friends and administrators."
                  />
               ) : challengeHistory.length === 0 ? (
                  <EmptyState
                     title="No Challenges Joined Yet"
                     description="This scholar has not participated in any HoldMeToIt study challenges yet."
                     action={
                        isOwnProfile ? (
                           <Button asChild className="rounded-full">
                              <Link href="/challenges">Explore Challenges</Link>
                           </Button>
                        ) : undefined
                     }
                  />
               ) : (
                  <div className="space-y-6">
                     {/* Selector Bar */}
                     <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-border-default bg-surface-primary">
                        <div className="min-w-0">
                           <label
                              htmlFor="challenge-select"
                              className="text-xs font-semibold text-text-tertiary block"
                           >
                              Select Challenge Event
                           </label>
                           <p className="text-xs text-text-secondary mt-0.5">
                              Browse performance snapshot for any event
                           </p>
                        </div>

                        <div className="w-full sm:w-80 shrink-0">
                           <Select
                              value={currentChallengeId}
                              onValueChange={handleChallengeChange}
                           >
                              <SelectTrigger
                                 id="challenge-select"
                                 className="h-10 rounded-xl bg-surface-elevated border-border-strong text-white text-xs font-semibold"
                                 data-testid="challenge-history-select"
                              >
                                 <SelectValue placeholder="Choose challenge..." />
                              </SelectTrigger>
                              <SelectContent className="bg-surface-primary border-border-default text-white">
                                 {challengeHistory.map((item) => (
                                    <SelectItem
                                       key={item.challengeId}
                                       value={item.challengeId}
                                       className="text-xs hover:bg-surface-elevated cursor-pointer"
                                    >
                                       {item.title} ({item.status})
                                    </SelectItem>
                                 ))}
                              </SelectContent>
                           </Select>
                        </div>
                     </div>

                     {/* Snapshot State Rendering */}
                     {isPending ? (
                        <CockpitSkeleton />
                     ) : snapshotError ? (
                        <div className="rounded-2xl border border-feedback-error/30 bg-feedback-error-bg/30 p-6 text-center text-xs text-feedback-error-text">
                           {snapshotError}
                        </div>
                     ) : currentSnapshot ? (
                        <ChallengeSnapshot
                           stats={currentSnapshot}
                           showChallengeHeader={true}
                           showCockpitLink={true}
                        />
                     ) : (
                        <div className="rounded-2xl border border-border-default bg-surface-primary p-8 text-center text-xs text-text-tertiary">
                           Select a challenge above to inspect the performance
                           snapshot.
                        </div>
                     )}
                  </div>
               )}
            </div>
         )}

         {/* TAB 3: SETTINGS (Own Profile Only) */}
         {activeTab === "settings" && isOwnProfile && (
            <div className="space-y-6" data-testid="settings-content">
               {/* YPT Integration Card */}
               <YptSettingsCard
                  initialYptId={initialYptId ?? user.yptId ?? null}
               />
            </div>
         )}
      </div>
   );
}
