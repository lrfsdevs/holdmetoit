"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import {
   Trophy,
   Medal,
   Coins,
   Sparkles,
   Lock,
   CheckCircle2,
   Flame,
   Zap,
   ShieldAlert,
   Swords,
   Users,
   User,
   ArrowRight,
   Database,
   Calendar,
} from "lucide-react";
import { DiscordIcon } from "@/components/icons/discord-icon";
import { Button } from "@/components/ui/button";
import { loginWithDiscordAction } from "@/features/auth/api/auth.actions";
import { trackLogRocketEvent } from "@/core/observability/logrocket";
import {
   CockpitTasksSection,
   LOAD_SAMPLE_TASK_EVENT,
   SAMPLE_STUDY_TASKS,
} from "./cockpit-tasks-section";
import type { ChallengeScoreboardViewModel } from "@/features/leaderboard/domain/leaderboard.types";
import { DashboardWrapped } from "@/features/wrapped/presentation/dashboard-wrapped";

export interface GuestCockpitViewProps {
   displayName?: string;
   upcomingChallenge?: {
      id: string;
      title: string;
      format: "TEAM_VS_TEAM" | "DUOS" | "SOLOS";
      description?: string | null;
      startAt?: Date | string;
      endAt?: Date | string;
      eventBannerUrl?: string | null;
      punishmentPfpUrl?: string | null;
      teams?: Array<{
         id: string;
         name: string;
         color: string | null;
         iconEmoji: string | null;
      }>;
   } | null;
   wrappedChallenge?: ChallengeScoreboardViewModel | null;
   isAdmin?: boolean;
   initialCollapsedCategoryIds?: string[];
   initialIsRolloverSnoozed?: boolean;
   taskSection?: React.ReactNode;
}

/**
 * Renders the unauthenticated Guest Cockpit dashboard on `/`.
 * Displays a high-impact hero banner, simulated progress telemetry card,
 * active challenges accountability pulse, gamification ecosystem cards,
 * and an interactive local guest task sandbox.
 */
export function GuestCockpitView({
   displayName = "Guest",
   upcomingChallenge,
   wrappedChallenge,
   isAdmin = false,
   initialCollapsedCategoryIds,
   initialIsRolloverSnoozed,
   taskSection,
}: GuestCockpitViewProps) {
   const handleSignIn = loginWithDiscordAction.bind(null, "/");

   const dispatchSampleTask = (title: string) => {
      if (typeof window !== "undefined") {
         window.dispatchEvent(
            new CustomEvent(LOAD_SAMPLE_TASK_EVENT, { detail: { title } })
         );
      }
   };

   const formattedDate = new Date().toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
   });

   return (
      <div
         data-testid="guest-cockpit-view"
         className="space-y-8 max-w-4xl mx-auto px-4 py-8 sm:py-12"
      >
         {/* Top Guest Greeting & Date Indicator */}
         <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border-subtle pb-4">
            <div>
               <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Welcome {displayName}
               </h2>
               <p className="text-xs font-medium text-text-tertiary mt-0.5 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{formattedDate} (UTC)</span>
                  <span className="text-border-strong">·</span>
                  <span className="text-brand-1-light font-semibold">
                     Guest Cockpit
                  </span>
               </p>
            </div>
            <div className="self-start sm:self-auto">
               <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-secondary text-text-secondary border border-border-default">
                  <span className="h-2 w-2 rounded-full bg-feedback-success animate-pulse motion-reduce:animate-none" />
                  Spectator Mode Active
               </span>
            </div>
         </div>

         {/* 1. Cockpit Hero Banner Card */}
         <section
            aria-label="Welcome and Platform Overview"
            className="relative overflow-hidden rounded-3xl border border-border-default bg-surface-primary shadow-2xl transition-all"
         >
            {/* Background Image & Visual Overlays */}
            <div className="absolute inset-0 z-0">
               <Image
                  src="/assets/challenge_hero_battle.jpg"
                  alt="HoldMeToIt Competitive Study Battles"
                  fill
                  priority
                  unoptimized
                  sizes="(max-width: 1200px) 100vw, 1200px"
                  className="object-cover object-center opacity-30 select-none pointer-events-none"
               />
               <div className="absolute inset-0 bg-gradient-to-t from-surface-primary via-surface-primary/80 to-transparent" />
               <div className="absolute inset-0 bg-gradient-to-r from-surface-primary/95 via-surface-primary/70 to-transparent" />
            </div>

            {/* Foreground Content */}
            <div className="relative z-10 p-6 sm:p-10 max-w-3xl space-y-6">
               <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-brand-1/15 text-brand-1-light border border-brand-1/30 backdrop-blur-sm">
                  <Flame className="h-3.5 w-3.5 text-brand-1-light" />
                  <span>Competitive Study Accountability</span>
               </div>

               <div className="space-y-3">
                  <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
                     Level Up Your Focus with Gamified Study Battles
                  </h1>
                  <p className="text-sm sm:text-base text-text-secondary leading-relaxed max-w-2xl">
                     Turn your study sessions into high-stakes arena battles.
                     Compete in Solo, Duo, and Squad challenges, auto-sync
                     Yeolpumta (YPT) hours, manage tasks with our Discord Tasker
                     Bot, and stay accountable with dynamic catch-up pacing.
                  </p>
               </div>

               <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                  {/* Primary CTA: Discord Sign In */}
                  <form
                     action={handleSignIn}
                     className="w-full sm:w-auto"
                     onSubmit={() =>
                        trackLogRocketEvent("GuestCockpitDiscordSignIn")
                     }
                  >
                     <Button
                        type="submit"
                        size="lg"
                        className="w-full sm:w-auto h-11 px-6 rounded-xl font-bold bg-feedback-info hover:bg-feedback-info/90 text-white shadow-lg flex items-center justify-center gap-2.5 transition-all"
                     >
                        <DiscordIcon className="h-5 w-5 shrink-0" />
                        <span>Sign in with Discord</span>
                     </Button>
                  </form>

                  {/* Secondary CTAs */}
                  <Link href="/challenges" className="w-full sm:w-auto">
                     <Button
                        variant="outline"
                        size="lg"
                        className="w-full sm:w-auto h-11 px-5 rounded-xl font-semibold border-border-default bg-surface-nested hover:bg-surface-elevated text-text-primary gap-2"
                     >
                        <Trophy className="h-4 w-4 text-brand-1-light shrink-0" />
                        <span>Browse Challenges</span>
                     </Button>
                  </Link>

                  <Link href="/leaderboard" className="w-full sm:w-auto">
                     <Button
                        variant="ghost"
                        size="lg"
                        className="w-full sm:w-auto h-11 px-4 rounded-xl font-semibold text-text-secondary hover:text-white hover:bg-surface-nested gap-2"
                     >
                        <Medal className="h-4 w-4 text-feedback-success shrink-0" />
                        <span>Trophy Leaderboard</span>
                     </Button>
                  </Link>
               </div>
            </div>
         </section>

         {/* 2. Interactive Cockpit Preview Row (2-Column Bento Layout) */}
         <section
            aria-label="Cockpit Telemetry and Active Challenges"
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
         >
            {/* Card Left: Simulated Study Progress & YPT Telemetry Card */}
            <div className="rounded-2xl border border-border-default bg-surface-primary p-5 sm:p-6 shadow-md flex flex-col justify-between space-y-4">
               <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                     <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                           Weekly Commitment Progress
                        </span>
                        <span className="rounded-full bg-surface-nested px-2 py-0.5 text-micro font-medium text-text-tertiary border border-border-strong uppercase">
                           Preview Mode
                        </span>
                     </div>
                     <div className="rounded-xl border border-feedback-success/40 bg-feedback-success-bg px-2.5 py-1 text-meta sm:text-xs text-feedback-success-text font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Pace on Target</span>
                     </div>
                  </div>

                  <div className="flex items-baseline justify-between gap-2 mt-1">
                     <p className="text-2xl sm:text-3xl font-extrabold text-white">
                        <span className="font-sans font-sans-tabular">
                           24:30:00
                        </span>
                        <span className="text-sm font-normal text-text-tertiary">
                           {" "}
                           / 35:00:00
                        </span>
                     </p>
                     <span className="text-sm font-bold text-white font-sans font-sans-tabular">
                        70%
                     </span>
                  </div>

                  <div className="h-2.5 w-full rounded-full bg-surface-nested overflow-hidden mt-3">
                     <div className="h-full rounded-full bg-feedback-success w-[70%]" />
                  </div>

                  {/* Telemetry Matrix */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4 mt-4 border-t border-border-subtle">
                     <div className="rounded-xl bg-surface-secondary p-2.5 border border-border-subtle">
                        <span className="text-meta text-text-tertiary block">
                           Daily Target
                        </span>
                        <span className="text-sm font-bold text-white font-sans font-sans-tabular">
                           05:00:00
                        </span>
                     </div>
                     <div className="rounded-xl bg-surface-secondary p-2.5 border border-border-subtle">
                        <span className="text-meta text-text-tertiary block">
                           Study Streak
                        </span>
                        <span className="text-sm font-bold text-brand-1-light">
                           🔥 5 Days
                        </span>
                     </div>
                     <div className="rounded-xl bg-surface-secondary p-2.5 border border-border-subtle">
                        <span className="text-meta text-text-tertiary block">
                           Leave Allowance
                        </span>
                        <span className="text-sm font-bold text-white">
                           🌴 1/2 Left
                        </span>
                     </div>
                     <div className="rounded-xl bg-feedback-info-bg/70 p-2.5 border border-feedback-info/30 flex flex-col justify-center">
                        <span className="text-micro text-feedback-info-text font-bold uppercase tracking-wider block">
                           Telemetry
                        </span>
                        <span className="text-xs font-extrabold text-white flex items-center gap-1">
                           <Zap className="h-3 w-3 text-feedback-info shrink-0" />
                           YPT Ready
                        </span>
                     </div>
                  </div>
               </div>

               <div className="flex items-center gap-2 pt-3 border-t border-border-subtle text-xs text-text-tertiary">
                  <Lock className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                  <span>
                     Sign in to log daily study hours, sync Yeolpumta (YPT), and
                     protect your streak.
                  </span>
               </div>
            </div>

            {/* Card Right: Active Challenges & Accountability Pulse Card */}
            <div className="rounded-2xl border border-border-default bg-surface-primary p-5 sm:p-6 shadow-md flex flex-col justify-between space-y-4">
               <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                     <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                        Active Arena &amp; Accountability Pulse
                     </span>
                     <span className="rounded-full bg-feedback-success-bg text-feedback-success-text border border-feedback-success/40 px-2 py-0.5 text-micro font-bold uppercase">
                        {upcomingChallenge ? "Live Event" : "Arena Open"}
                     </span>
                  </div>

                  {upcomingChallenge ? (
                     <div className="space-y-3">
                        <div>
                           <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                              {upcomingChallenge.title}
                           </h3>
                           <div className="flex items-center gap-2 mt-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-micro font-semibold bg-surface-nested text-text-secondary border border-border-strong uppercase">
                                 {upcomingChallenge.format === "SOLOS" ? (
                                    <>
                                       <User className="h-3 w-3" /> Solo Battle
                                    </>
                                 ) : upcomingChallenge.format === "DUOS" ? (
                                    <>
                                       <Users className="h-3 w-3" /> Duo Battle
                                    </>
                                 ) : (
                                    <>
                                       <Swords className="h-3 w-3" /> Team vs
                                       Team
                                    </>
                                 )}
                              </span>
                              <span className="text-xs text-text-tertiary">
                                 35h Target Commitment
                              </span>
                           </div>
                        </div>

                        {/* Teams preview if available */}
                        {upcomingChallenge.teams &&
                           upcomingChallenge.teams.length > 0 && (
                              <div className="flex flex-wrap items-center gap-2 pt-1">
                                 {upcomingChallenge.teams
                                    .slice(0, 2)
                                    .map((t, idx) => (
                                       <span
                                          key={t.id || idx}
                                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-surface-secondary border border-border-default text-text-secondary"
                                       >
                                          <span>{t.iconEmoji || "⚔️"}</span>
                                          <span className="text-white font-semibold">
                                             {t.name}
                                          </span>
                                       </span>
                                    ))}
                                 {upcomingChallenge.teams.length > 2 && (
                                    <span className="text-xs text-text-tertiary font-medium">
                                       +{upcomingChallenge.teams.length - 2}{" "}
                                       more
                                    </span>
                                 )}
                              </div>
                           )}
                     </div>
                  ) : (
                     <div className="space-y-2">
                        <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                           Join Competitive Weekly Battles
                        </h3>
                        <p className="text-xs text-text-secondary leading-relaxed">
                           Participate in{" "}
                           <strong className="text-white">Solo</strong>,{" "}
                           <strong className="text-white">Duo</strong>, or{" "}
                           <strong className="text-white">Squad</strong> study
                           challenges. Commit to target hours, complete
                           challenge-linked weekly goals, and lead your team to
                           victory.
                        </p>
                     </div>
                  )}

                  {/* Three-Condition Accountability Law Callout */}
                  <div className="mt-4 rounded-xl border border-feedback-error/30 bg-feedback-error-bg/50 p-3 space-y-1">
                     <div className="flex items-center gap-2 text-feedback-error-text text-xs font-bold">
                        <ShieldAlert className="h-4 w-4 shrink-0" />
                        <span>The Three-Condition Accountability Law</span>
                     </div>
                     <p className="text-meta text-text-secondary leading-relaxed">
                        At event conclusion, you are saved only if: (1) weekly
                        goals are completed, (2) target hours are met, and (3)
                        your team wins. If any condition fails, you wear the
                        Punishment PFP!
                     </p>
                  </div>
               </div>

               <div className="pt-3 border-t border-border-subtle">
                  <Link
                     href="/challenges"
                     className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-link hover:underline transition-all"
                  >
                     <span>Explore Active Challenges &amp; Matchups</span>
                     <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
               </div>
            </div>
         </section>

         {/* 3. Gamification & Ecosystem Strip (3 Compact Feature Cards) */}
         <section
            aria-label="Platform Gamification Ecosystem"
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
         >
            {/* Card 1: Economy & Wagers */}
            <div className="rounded-2xl border border-border-default bg-surface-primary p-5 shadow-sm flex flex-col justify-between space-y-3 hover:border-border-strong transition-all">
               <div className="space-y-2">
                  <div className="h-10 w-10 rounded-xl bg-brand-1/15 border border-brand-1/30 flex items-center justify-center text-brand-1-light">
                     <Coins className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                     Economy &amp; Wagers
                  </h3>
                  <p className="text-xs text-text-secondary leading-relaxed">
                     Earn study coins for every verified hour logged. Place
                     wagers on battle matchups to test your study convictions
                     and grow your coin stash.
                  </p>
               </div>
               <Link
                  href="/wallet"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-1-light hover:underline pt-2"
               >
                  <span>View Wallet &amp; Rules</span>
                  <ArrowRight className="h-3 w-3" />
               </Link>
            </div>

            {/* Card 2: Pokémon Gacha & Pokédex */}
            <div className="rounded-2xl border border-border-default bg-surface-primary p-5 shadow-sm flex flex-col justify-between space-y-3 hover:border-border-strong transition-all">
               <div className="space-y-2">
                  <div className="h-10 w-10 rounded-xl bg-accent-bg border border-accent flex items-center justify-center text-accent-text">
                     <Sparkles className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                     Pokémon Gacha &amp; Pokédex
                  </h3>
                  <p className="text-xs text-text-secondary leading-relaxed">
                     Spend earned study coins on gacha banners with a built-in
                     pity engine to summon rare Pokémon companions and complete
                     your Pokédex.
                  </p>
               </div>
               <Link
                  href="/pokemon"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-accent-text hover:underline pt-2"
               >
                  <span>Explore Pokédex</span>
                  <ArrowRight className="h-3 w-3" />
               </Link>
            </div>

            {/* Card 3: Trophy Ranks & Wrapped */}
            <div className="rounded-2xl border border-border-default bg-surface-primary p-5 shadow-sm flex flex-col justify-between space-y-3 hover:border-border-strong transition-all">
               <div className="space-y-2">
                  <div className="h-10 w-10 rounded-xl bg-feedback-success-bg border border-feedback-success/30 flex items-center justify-center text-feedback-success">
                     <Trophy className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                     Trophy Ranks &amp; Wrapped
                  </h3>
                  <p className="text-xs text-text-secondary leading-relaxed">
                     Climb seasonal Trophy tiers based on battle performance,
                     dodge punishment forfeits, and unlock shareable
                     end-of-event Wrapped recap stories.
                  </p>
               </div>
               <Link
                  href="/leaderboard"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-feedback-success hover:underline pt-2"
               >
                  <span>Check Trophy Ranks</span>
                  <ArrowRight className="h-3 w-3" />
               </Link>
            </div>
         </section>

         {/* 4. Reframed "Guest Sandbox" Task Manager */}
         <section
            aria-label="Interactive Guest Task Manager"
            className="space-y-4"
         >
            {/* Guest Sandbox Callout Banner */}
            <div className="rounded-2xl border border-border-default bg-surface-primary p-5 shadow-sm space-y-3">
               <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2">
                     <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-1/15 text-brand-1-light border border-brand-1/30">
                        <Database className="h-3.5 w-3.5" />
                        <span>Local Guest Sandbox</span>
                     </span>
                     <span className="text-xs text-text-tertiary hidden sm:inline">
                        Browser-local storage · Offline-first
                     </span>
                  </div>
                  <p className="text-meta text-text-tertiary">
                     Syncs to cloud &amp; Discord Tasker Bot (
                     <code className="text-white font-mono">/task</code>) upon
                     login
                  </p>
               </div>

               <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                  Tasks and categories you organize below are stored securely in
                  your browser (
                  <strong className="text-white">IndexedDB</strong>
                  ). You can add, reorder, and complete tasks immediately. When
                  you sign in with Discord, your tasks will automatically sync
                  to your cloud account.
               </p>

               {/* Starter Chips */}
               <div className="pt-2 border-t border-border-subtle flex flex-col sm:flex-row sm:items-center gap-2">
                  <span className="text-xs font-semibold text-text-tertiary shrink-0">
                     💡 Quick Start Sample Tasks:
                  </span>
                  <div className="flex flex-wrap gap-2">
                     {SAMPLE_STUDY_TASKS.map((sample) => (
                        <button
                           key={sample}
                           type="button"
                           onClick={() => dispatchSampleTask(sample)}
                           className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-surface-nested hover:bg-surface-elevated text-xs font-medium text-text-primary border border-border-default hover:border-brand-1/40 transition-colors"
                        >
                           <span className="text-brand-1-light font-bold">
                              +
                           </span>
                           <span>{sample}</span>
                        </button>
                     ))}
                  </div>
               </div>
            </div>

            {/* Render Task Section */}
            {taskSection ?? (
               <CockpitTasksSection
                  isLoggedIn={false}
                  userId={null}
                  userTasks={null}
                  isAdmin={isAdmin}
                  initialCollapsedCategoryIds={initialCollapsedCategoryIds}
                  initialIsRolloverSnoozed={initialIsRolloverSnoozed}
               />
            )}
         </section>

         {/* Optional Wrapped Challenge Modal/Story if active */}
         {wrappedChallenge && <DashboardWrapped challenge={wrappedChallenge} />}
      </div>
   );
}
