import {
   Clock,
   Calendar,
   Target,
   Trophy,
   CheckCircle2,
   Hourglass,
} from "lucide-react";
import type { ParticipantSummaryStats } from "../domain/participant-stats.types";

interface ParticipantSummaryCardsProps {
   summary: ParticipantSummaryStats;
   isAdmin?: boolean;
   onEditTarget?: () => void;
}

export function ParticipantSummaryCards({
   summary,
   isAdmin = false,
   onEditTarget,
}: ParticipantSummaryCardsProps) {
   return (
      <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-4">
         {/* 1. Total Study Time */}
         <div className="rounded-2xl border border-[#262626] bg-[#141414] p-4 sm:p-5 space-y-2">
            <div className="flex items-center justify-between text-[#868686]">
               <span className="text-xs font-semibold uppercase tracking-wider">
                  Total Study Time
               </span>
               <Clock className="h-4 w-4 text-[#22c55e]" />
            </div>
            <div>
               <p className="text-2xl sm:text-3xl font-extrabold text-[#f4f3f6] font-sans font-sans-tabular">
                  {summary.totalLoggedClock}
               </p>
               <p className="text-xs text-[#868686] mt-0.5">
                  {summary.totalLoggedHuman} recorded
               </p>
            </div>
         </div>

         {/* 2. Today's Study Time */}
         <div className="rounded-2xl border border-[#262626] bg-[#141414] p-4 sm:p-5 space-y-2">
            <div className="flex items-center justify-between text-[#868686]">
               <span className="text-xs font-semibold uppercase tracking-wider">
                  Today&apos;s Hours
               </span>
               {summary.todayIsLeave ? (
                  <span className="text-[10px] text-[#fcd34d] font-bold px-2 py-0.5 rounded-full bg-[#451a03] border border-[#f59e0b]/40">
                     🌴 Leave
                  </span>
               ) : (
                  <Calendar className="h-4 w-4 text-[#3b82f6]" />
               )}
            </div>
            <div>
               <p
                  className={`text-2xl sm:text-3xl font-extrabold font-sans font-sans-tabular ${
                     summary.todayIsLeave ? "text-[#fcd34d]" : "text-[#f4f3f6]"
                  }`}
               >
                  {summary.todayLoggedClock}
               </p>
               <p className="text-xs mt-0.5">
                  {summary.todayIsLeave ? (
                     <span className="text-[#fcd34d] font-medium flex items-center gap-1">
                        <span>🌴</span> Marked as Leave today
                     </span>
                  ) : summary.todayLoggedSeconds > 0 ? (
                     <span className="text-[#868686]">
                        {summary.todayLoggedHuman} today
                     </span>
                  ) : (
                     <span className="text-[#868686]">
                        No study recorded today
                     </span>
                  )}
               </p>
            </div>
         </div>

         {/* 3. Challenge Target */}
         <div className="rounded-2xl border border-[#262626] bg-[#141414] p-4 sm:p-5 space-y-2">
            <div className="flex items-center justify-between text-[#868686]">
               <span className="text-xs font-semibold uppercase tracking-wider">
                  Declared Target
               </span>
               <div className="flex items-center gap-1.5">
                  {isAdmin && onEditTarget && (
                     <button
                        type="button"
                        onClick={onEditTarget}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#242424] hover:bg-[#333333] border border-[#383838] text-[10px] font-semibold text-[#c084fc] hover:text-white transition-colors"
                        title="Admin: Edit weekly target hours"
                     >
                        <Target className="h-3 w-3 text-[#a855f7]" />
                        <span>Edit</span>
                     </button>
                  )}
                  <Target className="h-4 w-4 text-[#a855f7]" />
               </div>
            </div>
            <div>
               <p className="text-2xl sm:text-3xl font-extrabold text-[#f4f3f6] font-sans font-sans-tabular">
                  {summary.targetClock}
               </p>
               <p className="text-xs text-[#868686] mt-0.5">
                  {summary.targetHuman} goal
               </p>
            </div>
         </div>

         {/* 4. Completion Percentage */}
         <div className="rounded-2xl border border-[#262626] bg-[#141414] p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between text-[#868686]">
               <span className="text-xs font-semibold uppercase tracking-wider">
                  Goal Progress
               </span>
               <span className="text-xs font-bold text-[#f4f3f6]">
                  {summary.completionPercentage}%
               </span>
            </div>
            <div>
               <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#1c1c1c] border border-[#292929]">
                  <div
                     className={`h-full rounded-full transition-all duration-500 ${
                        summary.isTargetMet ? "bg-[#22c55e]" : "bg-[#3b82f6]"
                     }`}
                     style={{
                        width: `${Math.min(100, summary.completionPercentage)}%`,
                     }}
                  />
               </div>
               <p className="text-xs text-[#868686] mt-2">
                  {summary.isTargetMet
                     ? "Weekly commitment fulfilled"
                     : `${summary.remainingHuman} to reach goal`}
               </p>
            </div>
         </div>

         {/* 5. Leaderboard Rank */}
         <div className="rounded-2xl border border-[#262626] bg-[#141414] p-4 sm:p-5 space-y-2">
            <div className="flex items-center justify-between text-[#868686]">
               <span className="text-xs font-semibold uppercase tracking-wider">
                  Current Rank
               </span>
               <Trophy className="h-4 w-4 text-[#eab308]" />
            </div>
            <div>
               <p className="text-2xl sm:text-3xl font-extrabold text-[#f4f3f6] font-sans">
                  #{summary.rank}
               </p>
               <p className="text-xs text-[#868686] mt-0.5">
                  of {summary.totalParticipants} enrolled scholars
               </p>
            </div>
         </div>

         {/* 6. Remaining / Excess */}
         <div className="rounded-2xl border border-[#262626] bg-[#141414] p-4 sm:p-5 space-y-2">
            <div className="flex items-center justify-between text-[#868686]">
               <span className="text-xs font-semibold uppercase tracking-wider">
                  Target Status
               </span>
               {summary.isTargetMet ? (
                  <CheckCircle2 className="h-4 w-4 text-[#22c55e]" />
               ) : (
                  <Hourglass className="h-4 w-4 text-[#f59e0b]" />
               )}
            </div>
            <div>
               {summary.isTargetMet ? (
                  <>
                     <p className="text-xl sm:text-2xl font-bold text-[#22c55e] truncate">
                        Target Met!
                     </p>
                     <p className="text-xs text-[#85ff93] mt-0.5">
                        {summary.excessSeconds > 0
                           ? `+${summary.excessHuman} excess study time`
                           : "Exactly on target"}
                     </p>
                  </>
               ) : (
                  <>
                     <p className="text-2xl sm:text-3xl font-extrabold text-[#fcd34d] font-sans font-sans-tabular">
                        {summary.remainingClock}
                     </p>
                     <p className="text-xs text-[#868686] mt-0.5">
                        {summary.remainingHuman} remaining
                     </p>
                  </>
               )}
            </div>
         </div>
      </div>
   );
}
