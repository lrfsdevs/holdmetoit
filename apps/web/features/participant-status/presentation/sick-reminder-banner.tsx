"use client";

import React, { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { respondSickReminderAction } from "../api/sick-mode.actions";
import { isSickReminderDue } from "../domain/sick-mode";

export interface SickReminderBannerProps {
   isSick?: boolean;
   activatedAt?: Date | string | null;
   reminderSnoozedUntil?: Date | string | null;
   onStatusChange?: (isSick: boolean) => void;
}

/**
 * Empathetic 3-day reminder check-in prompt banner for participants in Sick Mode.
 * Non-blocking, mobile responsive (360px+), with 1-click recovery actions.
 */
export function SickReminderBanner({
   isSick = false,
   activatedAt,
   reminderSnoozedUntil,
   onStatusChange,
}: SickReminderBannerProps) {
   const [isPending, startTransition] = useTransition();
   const [isDismissedLocally, setIsDismissedLocally] = useState(false);

   // Check if reminder is due
   const isDue =
      !isDismissedLocally &&
      isSickReminderDue({
         isSick,
         activatedAt,
         reminderSnoozedUntil,
      });

   if (!isDue) return null;

   const handleTurnOff = () => {
      startTransition(async () => {
         const res = await respondSickReminderAction({ action: "turn_off" });
         if (res.ok) {
            setIsDismissedLocally(true);
            onStatusChange?.(false);
            toast.success(
               "Sick Mode turned off. Glad to hear you're feeling better!"
            );
         } else {
            toast.error(res.message);
         }
      });
   };

   const handleExtend = () => {
      startTransition(async () => {
         const res = await respondSickReminderAction({ action: "extend" });
         if (res.ok) {
            setIsDismissedLocally(true);
            toast.info("Reminder snoozed for 2 additional days. Rest well!");
         } else {
            toast.error(res.message);
         }
      });
   };

   return (
      <div
         data-testid="sick-reminder-banner"
         className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:p-5 shadow-lg backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
      >
         <div className="flex items-start gap-3 min-w-0">
            <span className="text-2xl shrink-0 select-none" aria-hidden="true">
               🩹
            </span>
            <div className="min-w-0">
               <h4 className="text-sm sm:text-base font-bold text-amber-200 tracking-tight">
                  Checking In: How are you feeling?
               </h4>
               <p className="text-xs sm:text-sm text-amber-100/80 mt-1 leading-relaxed">
                  You activated Sick Mode 3 days ago. Teammates can see you are
                  resting, but study deficits continue to accumulate. Are you
                  ready to resume?
               </p>
            </div>
         </div>

         <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 w-full sm:w-auto">
            <Button
               type="button"
               variant="outline"
               size="sm"
               disabled={isPending}
               onClick={handleExtend}
               className="rounded-xl border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 hover:text-amber-100 text-xs font-semibold h-9"
            >
               Still Recovering (+2 Days)
            </Button>
            <Button
               type="button"
               size="sm"
               disabled={isPending}
               onClick={handleTurnOff}
               className="rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs h-9 shadow-md"
            >
               I&apos;m Better (Turn Off)
            </Button>
         </div>
      </div>
   );
}
