"use client";

import { useState } from "react";
import {
   Volume2,
   VolumeX,
   Sparkles,
   Palette,
   Bell,
   Play,
   Check,
   Sliders,
} from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
   Card,
   CardContent,
   CardHeader,
   CardTitle,
   CardDescription,
} from "@/components/ui/card";
import { useUserPreferences } from "./use-user-preferences";
import { playCompletionAudio } from "./audio-service";
import { WrappedMascotPreferenceCard } from "@/features/wrapped/presentation/wrapped-mascot-preference-card";

export function PreferencesView() {
   const { preferences, updatePreferences, isHydrated } = useUserPreferences();
   const [isPlayingPreview, setIsPlayingPreview] = useState(false);

   const isSfxEnabled = preferences.sound.todoCompletionSfx;

   const handleToggleSfx = (checked: boolean) => {
      updatePreferences((prev) => ({
         ...prev,
         sound: {
            ...prev.sound,
            todoCompletionSfx: checked,
         },
      }));
   };

   const handlePreviewSound = async () => {
      if (isPlayingPreview) return;
      setIsPlayingPreview(true);
      await playCompletionAudio({ preview: true });
      setTimeout(() => {
         setIsPlayingPreview(false);
      }, 1200);
   };

   return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
         {/* Page Header */}
         <div className="space-y-2 border-b border-border-subtle pb-6">
            <div className="flex items-center gap-2.5">
               <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-elevated border border-border-default text-text-primary shadow-sm">
                  <Sliders className="h-5 w-5 text-brand-1" />
               </div>
               <div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary font-display">
                     Preferences
                  </h1>
                  <p className="text-xs sm:text-sm text-text-secondary">
                     Configure study celebrations, interface styling, and sound
                     feedback.
                  </p>
               </div>
            </div>
         </div>

         {/* Section 1: Audio & Celebratory Sound Effects */}
         <Card className="border border-border-default bg-surface-card shadow-sm">
            <CardHeader className="pb-4">
               <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                     <div className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-nested text-text-primary border border-border-subtle">
                        {isSfxEnabled ? (
                           <Volume2 className="h-4 w-4 text-feedback-success" />
                        ) : (
                           <VolumeX className="h-4 w-4 text-text-tertiary" />
                        )}
                     </div>
                     <div>
                        <CardTitle className="text-base sm:text-lg font-semibold text-text-primary flex items-center gap-2">
                           Audio Feedback
                           <Badge
                              variant="outline"
                              className={`text-label uppercase font-bold tracking-wider px-2 py-0.5 ${
                                 isSfxEnabled
                                    ? "border-feedback-success/40 bg-feedback-success-bg text-feedback-success-text"
                                    : "border-border-default bg-surface-nested text-text-tertiary"
                              }`}
                           >
                              {isSfxEnabled ? "Enabled" : "Muted by Default"}
                           </Badge>
                        </CardTitle>
                        <CardDescription className="text-xs sm:text-sm text-text-secondary mt-0.5">
                           Auditory sensory rewards for completing study tasks
                           and goals.
                        </CardDescription>
                     </div>
                  </div>
               </div>
            </CardHeader>

            <CardContent className="space-y-6 pt-2">
               {/* Setting Item: Task Completion Sound Effect */}
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border-subtle bg-surface-nested/70 p-4 transition-colors">
                  <div className="space-y-1 pr-2">
                     <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-brand-1 shrink-0" />
                        <span className="text-sm font-medium text-text-primary">
                           Task Completion Sound (&quot;Yippee!&quot;)
                        </span>
                     </div>
                     <p className="text-xs text-text-secondary leading-relaxed">
                        Play an energetic celebratory audio chime whenever a
                        Daily or Weekly task is marked as done.
                     </p>
                     <p className="text-meta text-text-tertiary pt-0.5">
                        Opt-in only. Strictly silent until explicitly enabled to
                        respect quiet study environments.
                     </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                     <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handlePreviewSound}
                        data-testid="preview-sound-button"
                        className="h-8 px-3 text-xs gap-1.5 border-border-default hover:bg-surface-elevated hover:text-white transition-colors"
                     >
                        <Play
                           className={`h-3 w-3 ${isPlayingPreview ? "animate-pulse text-brand-1" : ""}`}
                        />
                        <span>
                           {isPlayingPreview ? "Playing..." : "Preview"}
                        </span>
                     </Button>

                     <div className="flex items-center gap-2 pl-2 border-l border-border-subtle">
                        <Switch
                           id="todo-sfx-switch"
                           data-testid="todo-sfx-switch"
                           checked={isHydrated ? isSfxEnabled : false}
                           onCheckedChange={handleToggleSfx}
                           aria-label="Toggle task completion sound effect"
                        />
                     </div>
                  </div>
               </div>
            </CardContent>
         </Card>

         {/* Section 2: Visual Themes (Coming Soon) */}
         <Card className="border border-border-default bg-surface-card shadow-sm">
            <CardHeader className="pb-4">
               <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                     <div className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-nested text-text-primary border border-border-subtle">
                        <Palette className="h-4 w-4 text-brand-1" />
                     </div>
                     <div>
                        <CardTitle className="text-base sm:text-lg font-semibold text-text-primary flex items-center gap-2">
                           Themes & Aesthetics
                           <Badge
                              variant="outline"
                              className="text-label uppercase font-bold tracking-wider px-2 py-0.5 border-brand-1/40 bg-brand-1/10 text-brand-1"
                           >
                              Coming Soon
                           </Badge>
                        </CardTitle>
                        <CardDescription className="text-xs sm:text-sm text-text-secondary mt-0.5">
                           Custom accent palettes and workspace color themes.
                           Obsidian Dark is currently active.
                        </CardDescription>
                     </div>
                  </div>
               </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-2">
               <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-3">
                  {/* Obsidian Dark (Active) */}
                  <div
                     data-testid="theme-tile-obsidian"
                     className="relative flex flex-col gap-2 rounded-xl border-2 border-brand-1/60 bg-surface-nested p-3.5 shadow-sm"
                  >
                     <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-text-primary">
                           Obsidian Dark
                        </span>
                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-1 text-surface-page">
                           <Check className="h-3 w-3 stroke-[3]" />
                        </div>
                     </div>
                     <p className="text-meta text-text-secondary">
                        Active default palette. Deep focus dark surfaces with
                        gold & emerald highlights.
                     </p>
                     <div className="mt-auto flex items-center gap-1.5 pt-2">
                        <span className="h-3 w-3 rounded-full bg-surface-page border border-border-default" />
                        <span className="h-3 w-3 rounded-full bg-surface-elevated border border-border-default" />
                        <span className="h-3 w-3 rounded-full bg-brand-1" />
                        <span className="h-3 w-3 rounded-full bg-feedback-success" />
                     </div>
                  </div>

                  {/* Midnight Azure (Coming Soon) */}
                  <div
                     data-testid="theme-tile-midnight"
                     className="relative flex flex-col gap-2 rounded-xl border border-border-subtle bg-surface-nested/50 p-3.5 opacity-65"
                  >
                     <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-text-secondary">
                           Midnight Azure
                        </span>
                        <Badge
                           variant="outline"
                           className="text-caption px-1.5 py-0 uppercase border-border-subtle text-text-tertiary"
                        >
                           Soon
                        </Badge>
                     </div>
                     <p className="text-meta text-text-tertiary">
                        Deep oceanic navy shades tailored for night owl
                        programmers.
                     </p>
                     <div className="mt-auto flex items-center gap-1.5 pt-2">
                        <span className="h-3 w-3 rounded-full bg-surface-page border border-border-subtle" />
                        <span className="h-3 w-3 rounded-full bg-surface-nested border border-border-subtle" />
                        <span className="h-3 w-3 rounded-full bg-feedback-info" />
                     </div>
                  </div>

                  {/* Emerald Forest (Coming Soon) */}
                  <div
                     data-testid="theme-tile-emerald"
                     className="relative flex flex-col gap-2 rounded-xl border border-border-subtle bg-surface-nested/50 p-3.5 opacity-65"
                  >
                     <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-text-secondary">
                           Emerald Forest
                        </span>
                        <Badge
                           variant="outline"
                           className="text-caption px-1.5 py-0 uppercase border-border-subtle text-text-tertiary"
                        >
                           Soon
                        </Badge>
                     </div>
                     <p className="text-meta text-text-tertiary">
                        Organic woodland dark tones for calming, nature-inspired
                        flow.
                     </p>
                     <div className="mt-auto flex items-center gap-1.5 pt-2">
                        <span className="h-3 w-3 rounded-full bg-surface-page border border-border-subtle" />
                        <span className="h-3 w-3 rounded-full bg-surface-nested border border-border-subtle" />
                        <span className="h-3 w-3 rounded-full bg-feedback-success" />
                     </div>
                  </div>

                  {/* Cozy Sunset (Coming Soon) */}
                  <div
                     data-testid="theme-tile-sunset"
                     className="relative flex flex-col gap-2 rounded-xl border border-border-subtle bg-surface-nested/50 p-3.5 opacity-65"
                  >
                     <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-text-secondary">
                           Cozy Sunset
                        </span>
                        <Badge
                           variant="outline"
                           className="text-caption px-1.5 py-0 uppercase border-border-subtle text-text-tertiary"
                        >
                           Soon
                        </Badge>
                     </div>
                     <p className="text-meta text-text-tertiary">
                        Warm amber twilight tones for cozy café study vibes.
                     </p>
                     <div className="mt-auto flex items-center gap-1.5 pt-2">
                        <span className="h-3 w-3 rounded-full bg-surface-page border border-border-subtle" />
                        <span className="h-3 w-3 rounded-full bg-surface-nested border border-border-subtle" />
                        <span className="h-3 w-3 rounded-full bg-brand-2" />
                     </div>
                  </div>
               </div>
            </CardContent>
         </Card>

         {/* Section 3: Notifications & Reminders (Coming Soon) */}
         <Card className="border border-border-default bg-surface-card shadow-sm">
            <CardHeader className="pb-4">
               <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                     <div className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-nested text-text-primary border border-border-subtle">
                        <Bell className="h-4 w-4 text-text-secondary" />
                     </div>
                     <div>
                        <CardTitle className="text-base sm:text-lg font-semibold text-text-primary flex items-center gap-2">
                           Notifications & Reminders
                           <Badge
                              variant="outline"
                              className="text-label uppercase font-bold tracking-wider px-2 py-0.5 border-brand-1/40 bg-brand-1/10 text-brand-1"
                           >
                              Coming Soon
                           </Badge>
                        </CardTitle>
                        <CardDescription className="text-xs sm:text-sm text-text-secondary mt-0.5">
                           Configure challenge countdowns, rollover task
                           reminders, and pacing notifications.
                        </CardDescription>
                     </div>
                  </div>
               </div>
            </CardHeader>

            <CardContent className="space-y-3 pt-2">
               {/* Item 1 */}
               <div className="flex items-center justify-between p-3.5 rounded-xl border border-border-subtle bg-surface-nested/50 opacity-65">
                  <div className="space-y-0.5">
                     <span className="text-xs sm:text-sm font-medium text-text-secondary">
                        Daily Incomplete Task Rollover Digest
                     </span>
                     <p className="text-meta text-text-tertiary">
                        Get notified when unresolved yesterday tasks roll over
                        to your active today view.
                     </p>
                  </div>
                  <Switch
                     disabled
                     checked={false}
                     aria-label="Daily rollover reminder (coming soon)"
                  />
               </div>

               {/* Item 2 */}
               <div className="flex items-center justify-between p-3.5 rounded-xl border border-border-subtle bg-surface-nested/50 opacity-65">
                  <div className="space-y-0.5">
                     <span className="text-xs sm:text-sm font-medium text-text-secondary">
                        Challenge Kickoff & Settlement Alerts
                     </span>
                     <p className="text-meta text-text-tertiary">
                        Instant notification when a tournament kicks off or when
                        final host verdicts are locked.
                     </p>
                  </div>
                  <Switch
                     disabled
                     checked={false}
                     aria-label="Challenge kickoff alerts (coming soon)"
                  />
               </div>

               {/* Item 3 */}
               <div className="flex items-center justify-between p-3.5 rounded-xl border border-border-subtle bg-surface-nested/50 opacity-65">
                  <div className="space-y-0.5">
                     <span className="text-xs sm:text-sm font-medium text-text-secondary">
                        Study Deficit Dynamic Pacing Nudge
                     </span>
                     <p className="text-meta text-text-tertiary">
                        Friendly evening notification showing your catch-up
                        target hours before day-end.
                     </p>
                  </div>
                  <Switch
                     disabled
                     checked={false}
                     aria-label="Deficit pacing nudge (coming soon)"
                  />
               </div>
            </CardContent>
         </Card>

         {/* Section 4: Wrapped Mascot Preference */}
         <WrappedMascotPreferenceCard />
      </div>
   );
}
