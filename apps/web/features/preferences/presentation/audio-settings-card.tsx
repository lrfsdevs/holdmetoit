"use client";

import { useState } from "react";
import { Volume2, VolumeX, Sparkles, Play } from "lucide-react";

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

export function AudioSettingsCard() {
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
      <Card
         className="border border-border-default bg-surface-card shadow-sm"
         data-testid="audio-settings-card"
      >
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
                        Auditory sensory rewards for completing study tasks and
                        goals.
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
                     Play an energetic celebratory audio chime whenever a Daily
                     or Weekly task is marked as done.
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
                     <span>{isPlayingPreview ? "Playing..." : "Preview"}</span>
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
   );
}
