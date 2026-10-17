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
      <div className="rounded-3xl border border-[#262626] bg-[#141414] p-5 sm:p-7 shadow-xl space-y-4">
         <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
            <div className="flex items-center gap-2">
               <Flame
                  className={`h-5 w-5 ${
                     isCatchUp || isPunished
                        ? "text-[#f59e0b]"
                        : "text-[#22c55e]"
                  }`}
               />
               <h2 className="text-base sm:text-lg font-bold text-[#f4f3f6]">
                  Accountability & Catch-Up Status
               </h2>
            </div>

            <span
               className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
                  isPunished
                     ? "bg-[#401010] border-[#ef4444]/40 text-[#ff8080]"
                     : isExcused
                       ? "bg-[#230e40] border-[#8b5cf6]/40 text-[#c4b5fd]"
                       : isCatchUp
                         ? "bg-[#402010] border-[#f59e0b]/40 text-[#fcd34d]"
                         : "bg-[#144520] border-[#22c55e]/40 text-[#85ff93]"
               }`}
            >
               {accountability.statusBadge}
            </span>
         </div>

         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Remaining Deficit */}
            <div className="rounded-2xl border border-[#262626] bg-[#1a1a1a] p-4 space-y-1">
               <span className="text-xs text-[#868686] flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-[#f59e0b]" />
                  Target Deficit
               </span>
               <p className="text-xl sm:text-2xl font-extrabold font-sans font-sans-tabular text-[#f4f3f6]">
                  {accountability.deficitClock}
               </p>
               <p className="text-xs text-[#868686]">
                  {accountability.deficitSeconds === 0
                     ? "Commitment fully satisfied"
                     : `${accountability.deficitHuman} behind declared target`}
               </p>
            </div>

            {/* Required Daily Pace */}
            <div className="rounded-2xl border border-[#262626] bg-[#1a1a1a] p-4 space-y-1">
               <span className="text-xs text-[#868686] flex items-center gap-1.5">
                  <Flame className="h-3.5 w-3.5 text-[#3b82f6]" />
                  Required Daily Pace
               </span>
               <p className="text-xl sm:text-2xl font-extrabold font-sans font-sans-tabular text-[#f4f3f6]">
                  {accountability.requiredDailyPaceSeconds > 0
                     ? `${accountability.requiredDailyPaceClock} / day`
                     : "00:00:00 / day"}
               </p>
               <p className="text-xs text-[#868686]">
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
            <div className="p-3.5 rounded-2xl bg-[#230e40]/40 border border-[#8b5cf6]/30 flex items-start gap-2.5 text-xs text-[#d8b4fe]">
               <ShieldCheck className="h-4 w-4 shrink-0 text-[#c084fc] mt-0.5" />
               <div>
                  <p className="font-semibold text-white">
                     Officially Excused by Host
                  </p>
                  <p className="text-[#c4b5fd] mt-0.5">
                     {accountability.pardonReason
                        ? `Pardon note: "${accountability.pardonReason}"`
                        : "A challenge host granted an official pardon for this scholar."}
                  </p>
               </div>
            </div>
         )}

         {isPunished && (
            <div className="p-3.5 rounded-2xl bg-[#450a0a]/40 border border-[#ef4444]/30 flex items-start gap-2.5 text-xs text-[#fca5a5]">
               <AlertTriangle className="h-4 w-4 shrink-0 text-[#ef4444] mt-0.5" />
               <div>
                  <p className="font-semibold text-white">
                     Dual-Failure Forfeit Assigned
                  </p>
                  <p className="text-[#f87171] mt-0.5">
                     This participant logged fewer hours than their declared
                     target commitment and was assigned the challenge forfeit
                     avatar.
                  </p>
               </div>
            </div>
         )}

         {isCompleted && !isPunished && !isExcused && (
            <div className="p-3.5 rounded-2xl bg-[#144520]/40 border border-[#22c55e]/30 flex items-start gap-2.5 text-xs text-[#85ff93]">
               <CheckCircle2 className="h-4 w-4 shrink-0 text-[#22c55e] mt-0.5" />
               <div>
                  <p className="font-semibold text-white">
                     Challenge Completed Successfully
                  </p>
                  <p className="text-[#a7f3d0] mt-0.5">
                     Target requirements were fully met with zero outstanding
                     deficits.
                  </p>
               </div>
            </div>
         )}
      </div>
   );
}
