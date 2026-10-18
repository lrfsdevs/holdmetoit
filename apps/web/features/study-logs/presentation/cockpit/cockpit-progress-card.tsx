"use client";

import { formatSecondsToClock } from "@/features/study-logs/domain/duration";
import type { CockpitViewModel } from "@/features/study-logs/data/cockpit-data";

export interface CockpitProgressCardProps {
   cockpit: CockpitViewModel;
   effectiveTotalLoggedClock: string;
   effectiveTargetClock: string;
   effectiveTargetSeconds: number;
}

/** Renders participant progress, deficit, and catch-up pacing metrics. */
export function CockpitProgressCard({
   cockpit,
   effectiveTotalLoggedClock,
   effectiveTargetClock,
   effectiveTargetSeconds,
}: CockpitProgressCardProps) {
   if (cockpit.challengeStatus !== "ACTIVE" || effectiveTargetSeconds <= 0) {
      return null;
   }

   const progressPercent =
      effectiveTargetSeconds > 0
         ? Math.min(
              100,
              Math.round(
                 (cockpit.totalLoggedSeconds / effectiveTargetSeconds) * 100
              )
           )
         : 0;

   return (
      <div className="rounded-2xl border border-border-default bg-surface-primary p-5 sm:p-6 shadow-md space-y-4">
         <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
               <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                     Weekly Commitment Progress
                  </span>
               </div>
               <p className="text-xl font-bold text-white mt-0.5">
                  <span className="font-sans font-sans-tabular">
                     {effectiveTotalLoggedClock}
                  </span>
                  <span className="text-sm font-normal text-text-tertiary">
                     {" "}
                     / {effectiveTargetClock}
                  </span>
               </p>
            </div>

            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 sm:gap-3 w-full sm:w-auto">
               {cockpit.catchUp && cockpit.catchUp.deficitSeconds > 0 ? (
                  <div className="rounded-xl border border-feedback-error/40 bg-feedback-error-bg px-2.5 sm:px-3 py-1 sm:py-1.5 text-meta sm:text-xs text-feedback-error-text">
                     <span className="font-semibold">Deficit:</span>{" "}
                     <span className="font-sans font-sans-tabular">
                        -
                        {formatSecondsToClock(
                           Math.round(cockpit.catchUp.deficitSeconds)
                        )}
                     </span>
                     {cockpit.catchUp.paceSecondsPerDay ? (
                        <>
                           {" "}
                           (need{" "}
                           <span className="font-sans font-sans-tabular">
                              {formatSecondsToClock(
                                 Math.round(cockpit.catchUp.paceSecondsPerDay)
                              )}
                           </span>
                           /day)
                        </>
                     ) : null}
                  </div>
               ) : (
                  <div className="rounded-xl border border-feedback-success/40 bg-feedback-success-bg px-2.5 sm:px-3 py-1 sm:py-1.5 text-meta sm:text-xs text-feedback-success-text font-semibold">
                     Pace on Target
                  </div>
               )}
               <span className="text-sm font-bold text-white">
                  {progressPercent}%
               </span>
            </div>
         </div>

         <div className="h-2.5 w-full rounded-full bg-surface-nested overflow-hidden">
            <div
               className={`h-full rounded-full transition-all duration-500 ${
                  progressPercent >= 100
                     ? "bg-feedback-success"
                     : cockpit.catchUp && cockpit.catchUp.deficitSeconds > 0
                       ? "bg-feedback-error"
                       : "bg-white"
               }`}
               style={{ width: `${progressPercent}%` }}
            />
         </div>
      </div>
   );
}
