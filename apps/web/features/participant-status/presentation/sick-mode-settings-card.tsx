"use client";

import React, { useState, useTransition } from "react";
import { toast } from "sonner";
import {
   Card,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toggleSickModeAction } from "../api/sick-mode.actions";
import {
   calculateSickDuration,
   isSickModeAutoExpired,
   SICK_MODE_MAX_NOTE_LENGTH,
} from "../domain/sick-mode";
import { SickStatusBadge } from "./sick-status-badge";

export interface SickModeSettingsCardProps {
   initialIsSick?: boolean;
   initialActivatedAt?: Date | string | null;
   initialNote?: string | null;
   initialLastDeactivatedAt?: Date | string | null;
}

/**
 * Settings card rendered under Participant Preferences in `/profile` (tab="settings").
 */
export function SickModeSettingsCard({
   initialIsSick = false,
   initialActivatedAt,
   initialNote = null,
   initialLastDeactivatedAt = null,
}: SickModeSettingsCardProps) {
   const [isPending, startTransition] = useTransition();

   const isExpired = isSickModeAutoExpired({
      isSick: initialIsSick,
      activatedAt: initialActivatedAt,
   });

   const [isSick, setIsSick] = useState(initialIsSick && !isExpired);
   const [note, setNote] = useState(initialNote ?? "");
   const [activatedAt, setActivatedAt] = useState<Date | string | null>(
      initialActivatedAt ?? null
   );
   const [lastDeactivatedAt, setLastDeactivatedAt] = useState<
      Date | string | null
   >(initialLastDeactivatedAt ?? null);

   const elapsed = calculateSickDuration(activatedAt);
   const charsLeft = SICK_MODE_MAX_NOTE_LENGTH - note.length;

   const handleToggle = (checked: boolean) => {
      startTransition(async () => {
         setIsSick(checked);

         if (checked) {
            setActivatedAt(new Date());
            const res = await toggleSickModeAction({
               isSick: true,
               note: note.trim() || null,
            });
            if (res.ok) {
               setActivatedAt(res.status.activatedAt);
               setNote(res.status.note ?? "");
               toast.success("Sick Mode activated.");
            } else {
               setIsSick(false);
               toast.error(res.message);
            }
         } else {
            const res = await toggleSickModeAction({ isSick: false });
            if (res.ok) {
               setActivatedAt(null);
               setLastDeactivatedAt(res.status.lastDeactivatedAt ?? new Date());
               toast.success("Sick Mode turned off.");
            } else {
               setIsSick(true);
               toast.error(res.message);
            }
         }
      });
   };

   const handleSaveNote = () => {
      startTransition(async () => {
         const res = await toggleSickModeAction({
            isSick: true,
            note: note.trim() || null,
         });
         if (res.ok) {
            setNote(res.status.note ?? "");
            toast.success("Status note updated.");
         } else {
            toast.error(res.message);
         }
      });
   };

   return (
      <Card
         data-testid="sick-mode-settings-card"
         className="border-border-default bg-surface-card rounded-2xl shadow-sm"
      >
         <CardHeader className="p-5 sm:p-6 pb-4">
            <div className="flex items-center justify-between gap-4">
               <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-lg">
                     🤒
                  </div>
                  <div>
                     <CardTitle className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                        <span>Sick Mode / Resting Status</span>
                        {isSick && (
                           <SickStatusBadge
                              isSick={isSick}
                              activatedAt={activatedAt}
                              note={note}
                              variant="compact"
                           />
                        )}
                     </CardTitle>
                     <CardDescription className="text-xs sm:text-sm text-text-secondary mt-0.5">
                        Indicate temporary health setbacks across leaderboards
                        and team rosters.
                     </CardDescription>
                  </div>
               </div>

               <Switch
                  checked={isSick}
                  disabled={isPending}
                  onCheckedChange={handleToggle}
                  aria-label="Toggle Sick Mode"
               />
            </div>
         </CardHeader>

         <CardContent className="p-5 sm:p-6 pt-0 space-y-4">
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs text-amber-200/90 leading-relaxed">
               <span className="font-semibold text-amber-200">
                  Non-Negotiable Community Rule (Law L3):
               </span>{" "}
               Sick Mode is strictly an informational social indicator. It does
               NOT pause timers, freeze deficit accrual, grant grace passes, or
               reduce weekly targets. Deficits continue to calculate normally.
            </div>

            {isSick && (
               <div className="space-y-3 pt-1">
                  <div className="text-xs text-text-secondary flex flex-wrap gap-x-4 gap-y-1">
                     <span>
                        <strong className="text-white">Active Duration:</strong>{" "}
                        {elapsed.formattedDuration}
                     </span>
                     <span>
                        <strong className="text-white">Auto-Expiry:</strong>{" "}
                        After 7 consecutive days
                     </span>
                  </div>

                  <div className="space-y-1.5">
                     <div className="flex items-center justify-between text-xs font-semibold text-text-secondary">
                        <label htmlFor="sick-note-field">
                           Status Note (Optional)
                        </label>
                        <span
                           className={
                              charsLeft < 10
                                 ? "text-feedback-danger"
                                 : "text-text-tertiary"
                           }
                        >
                           {charsLeft} chars remaining
                        </span>
                     </div>
                     <div className="flex gap-2">
                        <Input
                           id="sick-note-field"
                           type="text"
                           value={note}
                           maxLength={SICK_MODE_MAX_NOTE_LENGTH}
                           disabled={isPending}
                           onChange={(e) => setNote(e.target.value)}
                           placeholder="e.g. Flu & high fever, resting"
                           className="bg-surface-nested border-border-strong text-white text-xs h-9 flex-1"
                        />
                        <Button
                           type="button"
                           size="sm"
                           disabled={isPending}
                           onClick={handleSaveNote}
                           className="rounded-xl bg-surface-nested hover:bg-surface-elevated text-xs font-semibold text-text-secondary hover:text-white border border-border-strong h-9"
                        >
                           Save Note
                        </Button>
                     </div>
                  </div>
               </div>
            )}

            {!isSick && lastDeactivatedAt && (
               <p className="text-meta text-text-tertiary">
                  Last deactivated on{" "}
                  {new Date(lastDeactivatedAt).toLocaleDateString("en-US", {
                     month: "short",
                     day: "numeric",
                     year: "numeric",
                  })}
               </p>
            )}
         </CardContent>
      </Card>
   );
}
