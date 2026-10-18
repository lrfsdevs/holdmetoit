import { Flame, AlertTriangle, ShieldCheck, CheckCircle2 } from "lucide-react";
import type { ParticipantAccountabilityStats } from "../domain/participant-stats.types";

interface ParticipantAccountabilityProps {
   accountability: ParticipantAccountabilityStats;
}

export function ParticipantAccountability({
   accountability,
}: ParticipantAccountabilityProps) {
   const isExcused = accountability.statusBadge === "Excused";
   const isPunished = accountability.statusBadge === "Punished";
   const isCatchUp = accountability.statusBadge === "Catch-Up";
   const isCompleted = accountability.statusBadge === "Completed";

   return (
      <div className="rounded-3xl border border-border-default bg-surface-primary p-5 sm:p-7 shadow-xl space-y-4">
         <div className="flex items-center justify-between pb-3 border-b border-border-default">
            <div className="flex items-center gap-2">
               <Flame
                  className={`h-5 w-5 ${
                     isCatchUp || isPunished
                        ? "text-brand-1"
                        : "text-feedback-success"
                  }`}
               />
               <h2 className="text-base sm:text-lg font-bold text-text-primary">
                  Accountability & Catch-Up Status
               </h2>
            </div>

            <span
               className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
                  isPunished
                     ? "bg-feedback-error-bg border-feedback-error/40 text-feedback-error-text"
                     : isExcused
                       ? "bg-accent-bg border-accent/40 text-accent-text"
                       : isCatchUp
                         ? "bg-brand-1/15 border-brand-1/40 text-brand-1"
                         : "bg-feedback-success-bg border-feedback-success/40 text-feedback-success-text"
               }`}
            >
               {accountability.statusBadge}
            </span>
         </div>

         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Remaining Deficit */}
            <div className="rounded-2xl border border-border-default bg-surface-tertiary p-4 space-y-1">
               <span className="text-xs text-text-tertiary flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-brand-1" />
                  Target Deficit
               </span>
               <p className="text-xl sm:text-2xl font-extrabold font-sans font-sans-tabular text-text-primary">
                  {accountability.deficitClock}
               </p>
               <p className="text-xs text-text-tertiary">
                  {accountability.deficitSeconds === 0
                     ? "Commitment fully satisfied"
                     : `${accountability.deficitHuman} behind declared target`}
               </p>
            </div>

            {/* Required Daily Pace */}
            <div className="rounded-2xl border border-border-default bg-surface-tertiary p-4 space-y-1">
               <span className="text-xs text-text-tertiary flex items-center gap-1.5">
                  <Flame className="h-3.5 w-3.5 text-feedback-info" />
                  Required Daily Pace
               </span>
               <p className="text-xl sm:text-2xl font-extrabold font-sans font-sans-tabular text-text-primary">
                  {accountability.requiredDailyPaceSeconds > 0
                     ? `${accountability.requiredDailyPaceClock} / day`
                     : "00:00:00 / day"}
               </p>
               <p className="text-xs text-text-tertiary">
                  {accountability.requiredDailyPaceSeconds > 0
                     ? `${accountability.requiredDailyPaceHuman}/day over remaining ${accountability.daysRemaining} days`
                     : accountability.deficitSeconds === 0
                       ? "On track — no daily deficit recovery needed"
                       : "Challenge event finalized"}
               </p>
            </div>
         </div>

         {/* Special Context Banners for Pardoned or Punished */}
         {isExcused && (
            <div className="p-3.5 rounded-2xl bg-accent-bg/40 border border-accent/30 flex items-start gap-2.5 text-xs text-accent-text">
               <ShieldCheck className="h-4 w-4 shrink-0 text-accent-text mt-0.5" />
               <div>
                  <p className="font-semibold text-white">
                     Officially Excused by Host
                  </p>
                  <p className="text-accent-text mt-0.5">
                     {accountability.pardonReason
                        ? `Pardon note: "${accountability.pardonReason}"`
                        : "A challenge host granted an official pardon for this scholar."}
                  </p>
               </div>
            </div>
         )}

         {isPunished && (
            <div className="p-3.5 rounded-2xl bg-feedback-error-bg/40 border border-feedback-error/30 flex items-start gap-2.5 text-xs text-feedback-error-text">
               <AlertTriangle className="h-4 w-4 shrink-0 text-feedback-error mt-0.5" />
               <div>
                  <p className="font-semibold text-white">
                     Dual-Failure Forfeit Assigned
                  </p>
                  <p className="text-feedback-error-text mt-0.5">
                     This participant logged fewer hours than their declared
                     target commitment and was assigned the challenge forfeit
                     avatar.
                  </p>
               </div>
            </div>
         )}

         {isCompleted && !isPunished && !isExcused && (
            <div className="p-3.5 rounded-2xl bg-feedback-success-bg/40 border border-feedback-success/30 flex items-start gap-2.5 text-xs text-feedback-success-text">
               <CheckCircle2 className="h-4 w-4 shrink-0 text-feedback-success mt-0.5" />
               <div>
                  <p className="font-semibold text-white">
                     Challenge Completed Successfully
                  </p>
                  <p className="text-feedback-success-text mt-0.5">
                     Target requirements were fully met with zero outstanding
                     deficits.
                  </p>
               </div>
            </div>
         )}
      </div>
   );
}
