"use client";

import React, { useState, useTransition } from "react";
import { toast } from "sonner";
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
   DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toggleSickModeAction } from "../api/sick-mode.actions";
import {
   calculateSickDuration,
   isSickModeAutoExpired,
   SICK_MODE_MAX_NOTE_LENGTH,
} from "../domain/sick-mode";

export interface SickModeQuickToggleProps {
   initialIsSick?: boolean;
   initialActivatedAt?: Date | string | null;
   initialNote?: string | null;
   onStatusChange?: (isSick: boolean) => void;
}

/**
 * Quick toggle chip on Cockpit Header.
 * Allows participants to activate/deactivate Sick Mode and provide an optional status note.
 */
export function SickModeQuickToggle({
   initialIsSick = false,
   initialActivatedAt,
   initialNote = null,
   onStatusChange,
}: SickModeQuickToggleProps) {
   const [isOpen, setIsOpen] = useState(false);
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

   const elapsed = calculateSickDuration(activatedAt);
   const charsLeft = SICK_MODE_MAX_NOTE_LENGTH - note.length;

   const handleActivate = () => {
      startTransition(async () => {
         // Optimistic state
         setIsSick(true);
         setActivatedAt(new Date());
         onStatusChange?.(true);

         const res = await toggleSickModeAction({
            isSick: true,
            note: note.trim() || null,
         });

         if (res.ok) {
            setIsOpen(false);
            setActivatedAt(res.status.activatedAt);
            setNote(res.status.note ?? "");
            toast.success(
               "Sick Mode activated. Rest well and get better soon!"
            );
         } else {
            // Rollback optimistic state
            setIsSick(false);
            onStatusChange?.(false);
            toast.error(res.message);
         }
      });
   };

   const handleDeactivate = () => {
      startTransition(async () => {
         // Optimistic state
         setIsSick(false);
         onStatusChange?.(false);

         const res = await toggleSickModeAction({ isSick: false });

         if (res.ok) {
            setIsOpen(false);
            setNote("");
            setActivatedAt(null);
            toast.success("Sick Mode turned off. Welcome back to the cockpit!");
         } else {
            // Rollback optimistic state
            setIsSick(true);
            onStatusChange?.(true);
            toast.error(res.message);
         }
      });
   };

   return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
         <DialogTrigger asChild>
            <button
               type="button"
               data-testid="sick-mode-quick-toggle"
               className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                  isSick
                     ? "bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25 shadow-sm"
                     : "bg-surface-nested hover:bg-surface-elevated text-text-secondary hover:text-white border-border-default"
               }`}
            >
               <span
                  aria-hidden="true"
                  className={isSick ? "animate-pulse" : ""}
               >
                  {isSick ? "🩹" : "🤒"}
               </span>
               <span>{isSick ? "Resting (Sick Mode)" : "Feeling Unwell?"}</span>
            </button>
         </DialogTrigger>

         <DialogContent className="max-w-md bg-surface-card border-border-strong text-white">
            <DialogHeader>
               <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <span>
                     {isSick
                        ? "🩹 Resting Status Active"
                        : "🤒 Activate Sick Mode"}
                  </span>
               </DialogTitle>
               <DialogDescription className="text-xs sm:text-sm text-text-secondary">
                  {isSick
                     ? `You have been in Sick Mode for ${elapsed.formattedDuration}. Your resting badge is visible to teammates.`
                     : "Temporarily resting due to illness? Display an empathetic badge across team rosters and leaderboards so teammates understand your absence."}
               </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
               <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200/90 leading-relaxed">
                  <span className="font-bold">⚠️ Note:</span> Sick Mode is
                  purely an informational and social indicator. Per community
                  rules, required study hours and catch-up deficits continue to
                  calculate normally (zero grace passes).
               </div>

               <div className="space-y-1.5">
                  <label
                     htmlFor="sick-mode-note-input"
                     className="text-xs font-semibold text-text-secondary flex justify-between"
                  >
                     <span>Status Note (Optional)</span>
                     <span
                        className={
                           charsLeft < 10
                              ? "text-feedback-danger"
                              : "text-text-tertiary"
                        }
                     >
                        {charsLeft} left
                     </span>
                  </label>
                  <Input
                     id="sick-mode-note-input"
                     type="text"
                     placeholder="e.g., Flu & high fever, recovering"
                     maxLength={SICK_MODE_MAX_NOTE_LENGTH}
                     value={note}
                     onChange={(e) => setNote(e.target.value)}
                     disabled={isPending}
                     className="bg-surface-nested border-border-strong text-white text-xs h-9"
                  />
               </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
               {isSick ? (
                  <Button
                     type="button"
                     variant="outline"
                     disabled={isPending}
                     onClick={handleDeactivate}
                     className="rounded-xl border-amber-500/30 text-amber-200 hover:bg-amber-500/20 w-full sm:w-auto text-xs"
                  >
                     I&apos;m Feeling Better (Turn Off)
                  </Button>
               ) : null}

               <Button
                  type="button"
                  disabled={isPending}
                  onClick={handleActivate}
                  className="rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold w-full sm:w-auto text-xs"
               >
                  {isSick ? "Update Status Note" : "Activate Sick Mode"}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
   );
}
