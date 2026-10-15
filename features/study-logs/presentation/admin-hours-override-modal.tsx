"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
   Clock,
   X,
   AlertTriangle,
   Check,
   Loader2,
   ShieldAlert,
   User as UserIcon,
   RotateCcw,
   Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
   captureLogRocketException,
   trackLogRocketEvent,
} from "@/core/observability/logrocket";
import {
   decomposeSecondsToParts,
   formatSecondsToClock,
} from "@/features/study-logs/domain/duration";
import {
   getChallengeDayOptions,
   type ChallengeDayOption,
} from "@/features/study-logs/domain/challenge-day";
import { getTeamBadgeStyle } from "@/features/challenges/domain/team-colors";

export interface AdminHoursOverrideParticipant {
   participantId: string;
   userId?: string;
   displayName: string;
   username?: string | null;
   image?: string | null;
   teamName?: string;
   teamColor?: string | null;
   dailyLogs?: Record<string, number>; // dateKey (YYYY-MM-DD) -> durationSeconds
   totalLoggedSeconds?: number;
}

export interface AdminHoursOverrideModalProps {
   isOpen: boolean;
   onClose: () => void;
   challengeId: string;
   challengeStartDate?: string | Date;
   totalChallengeDays?: number;
   participant: AdminHoursOverrideParticipant | null;
   initialDayNumber?: number;
   onSuccess?: () => void;
   onOpenTargetOverride?: () => void;
}

export function AdminHoursOverrideModal({
   isOpen,
   onClose,
   challengeId,
   challengeStartDate,
   totalChallengeDays = 7,
   participant,
   initialDayNumber = 1,
   onSuccess,
   onOpenTargetOverride,
}: AdminHoursOverrideModalProps) {
   const router = useRouter();
   const [isPending, startTransition] = useTransition();

   const effectiveStartDate = useMemo(() => {
      if (!challengeStartDate) return new Date().toISOString().slice(0, 10);
      if (typeof challengeStartDate === "string")
         return challengeStartDate.slice(0, 10);
      return challengeStartDate.toISOString().slice(0, 10);
   }, [challengeStartDate]);

   const dayOptions: ChallengeDayOption[] = useMemo(() => {
      return getChallengeDayOptions(
         effectiveStartDate,
         new Date(),
         totalChallengeDays
      );
   }, [effectiveStartDate, totalChallengeDays]);

   const initialDayNumberToUse = useMemo(() => {
      const requested =
         initialDayNumber >= 1 && initialDayNumber <= totalChallengeDays
            ? initialDayNumber
            : 1;
      const requestedOption = dayOptions.find((d) => d.dayNumber === requested);
      if (requestedOption && !requestedOption.isFuture) {
         return requested;
      }
      const lastNonFuture = [...dayOptions].reverse().find((d) => !d.isFuture);
      return lastNonFuture ? lastNonFuture.dayNumber : 1;
   }, [dayOptions, initialDayNumber, totalChallengeDays]);

   const [selectedDayNumber, setSelectedDayNumber] = useState<number>(
      initialDayNumberToUse
   );

   const selectedDayOption = useMemo(() => {
      return (
         dayOptions.find((d) => d.dayNumber === selectedDayNumber) ||
         dayOptions[0] || {
            dayNumber: 1,
            dateKey: effectiveStartDate,
            label: "Day 1",
            shortLabel: "Day 1",
            weekday: "Mon",
            isToday: false,
            isYesterday: false,
            isFuture: false,
         }
      );
   }, [dayOptions, selectedDayNumber, effectiveStartDate]);

   const getExistingSecondsForDate = (dateKey: string): number => {
      if (!participant?.dailyLogs) return 0;
      return participant.dailyLogs[dateKey] ?? 0;
   };

   const initialExistingSeconds = useMemo(() => {
      const opt = dayOptions.find((d) => d.dayNumber === initialDayNumberToUse);
      const dateKey = opt ? opt.dateKey : effectiveStartDate;
      return participant?.dailyLogs?.[dateKey] ?? 0;
   }, [
      dayOptions,
      initialDayNumberToUse,
      effectiveStartDate,
      participant?.dailyLogs,
   ]);

   const initialParts = useMemo(() => {
      if (initialExistingSeconds > 0) {
         return decomposeSecondsToParts(initialExistingSeconds);
      }
      return { hours: 0, minutes: 0, seconds: 0 };
   }, [initialExistingSeconds]);

   const [hours, setHours] = useState(String(initialParts.hours));
   const [minutes, setMinutes] = useState(String(initialParts.minutes));
   const [seconds, setSeconds] = useState(String(initialParts.seconds));
   const [reason, setReason] = useState("");
   const [feedback, setFeedback] = useState<{
      type: "success" | "error";
      message: string;
   } | null>(null);

   const populateInputsForDay = (dayNum: number) => {
      const opt = dayOptions.find((d) => d.dayNumber === dayNum);
      const dateKey = opt ? opt.dateKey : effectiveStartDate;
      const existing = getExistingSecondsForDate(dateKey);
      if (existing > 0) {
         const parts = decomposeSecondsToParts(existing);
         setHours(String(parts.hours));
         setMinutes(String(parts.minutes));
         setSeconds(String(parts.seconds));
      } else {
         setHours("0");
         setMinutes("0");
         setSeconds("0");
      }
   };

   useEffect(() => {
      if (isOpen && participant) {
         const safeDayNum =
            initialDayNumber >= 1 && initialDayNumber <= totalChallengeDays
               ? initialDayNumber
               : 1;
         const requestedOption = dayOptions.find(
            (d) => d.dayNumber === safeDayNum
         );
         const chosenDayNum =
            requestedOption && !requestedOption.isFuture
               ? safeDayNum
               : ([...dayOptions].reverse().find((d) => !d.isFuture)
                    ?.dayNumber ?? 1);

         setSelectedDayNumber(chosenDayNum);
         const opt = dayOptions.find((d) => d.dayNumber === chosenDayNum);
         const dateKey = opt ? opt.dateKey : effectiveStartDate;
         const existing = participant.dailyLogs?.[dateKey] ?? 0;
         if (existing > 0) {
            const parts = decomposeSecondsToParts(existing);
            setHours(String(parts.hours));
            setMinutes(String(parts.minutes));
            setSeconds(String(parts.seconds));
         } else {
            setHours("0");
            setMinutes("0");
            setSeconds("0");
         }
         setReason("");
         setFeedback(null);
      }
   }, [
      isOpen,
      participant,
      initialDayNumber,
      totalChallengeDays,
      dayOptions,
      effectiveStartDate,
   ]);

   const totalOverallLoggedSeconds = useMemo(() => {
      if (typeof participant?.totalLoggedSeconds === "number") {
         return participant.totalLoggedSeconds;
      }
      if (participant?.dailyLogs) {
         return Object.values(participant.dailyLogs).reduce(
            (acc, sec) => acc + (sec || 0),
            0
         );
      }
      return 0;
   }, [participant?.totalLoggedSeconds, participant?.dailyLogs]);
   if (!isOpen || !participant) return null;

   const currentDayExistingSeconds = getExistingSecondsForDate(
      selectedDayOption.dateKey
   );
   const hasExistingSession =
      currentDayExistingSeconds > 0 ||
      participant.dailyLogs?.[selectedDayOption.dateKey] !== undefined;

   const handleSelectDay = (dayNum: number) => {
      const opt = dayOptions.find((d) => d.dayNumber === dayNum);
      if (opt?.isFuture) {
         setFeedback({
            type: "error",
            message: "Cannot add or edit study time for future dates.",
         });
         return;
      }
      setSelectedDayNumber(dayNum);
      populateInputsForDay(dayNum);
      setFeedback(null);
   };

   const handleClearTime = () => {
      setHours("0");
      setMinutes("0");
      setSeconds("0");
      if (!reason.trim()) {
         setReason("Set study hours to 00:00:00 by moderator");
      }
   };

   const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      setFeedback(null);

      if (selectedDayOption.isFuture) {
         setFeedback({
            type: "error",
            message: "Cannot add or edit study time for future dates.",
         });
         return;
      }

      const h = parseInt(hours || "0", 10);
      const m = parseInt(minutes || "0", 10);
      const s = parseInt(seconds || "0", 10);

      if (isNaN(h) || isNaN(m) || isNaN(s) || h < 0 || m < 0 || s < 0) {
         setFeedback({
            type: "error",
            message:
               "Please enter valid non-negative numbers for hours, minutes, and seconds.",
         });
         return;
      }

      if (m > 59 || s > 59) {
         setFeedback({
            type: "error",
            message: "Minutes and seconds must be between 0 and 59.",
         });
         return;
      }

      const durationSeconds = h * 3600 + m * 60 + s;
      const existingSecondsForDate = getExistingSecondsForDate(
         selectedDayOption.dateKey
      );
      const hasExistingSession =
         existingSecondsForDate > 0 ||
         participant.dailyLogs?.[selectedDayOption.dateKey] !== undefined;

      if (!hasExistingSession) {
         setFeedback({
            type: "error",
            message:
               "Cannot create arbitrary study hours. Technical corrections must reference an existing study session.",
         });
         return;
      }

      if (!reason || reason.trim().length < 10) {
         setFeedback({
            type: "error",
            message:
               "Mandatory audit reason must be at least 10 characters detailing the technical error.",
         });
         return;
      }

      const effectiveReason = reason.trim();

      startTransition(async () => {
         try {
            const { adminOverrideStudyHoursAction } =
               await import("@/features/study-logs/api/admin-override.actions");
            const result = await adminOverrideStudyHoursAction({
               challengeId,
               participantId: participant.participantId,
               logDate: selectedDayOption.dateKey,
               hours: h,
               minutes: m,
               seconds: s,
               reason: effectiveReason,
            });

            if (result.ok) {
               trackLogRocketEvent("AdminHoursOverrideExecuted", {
                  challengeId,
                  participantId: participant.participantId,
                  logDate: selectedDayOption.dateKey,
                  hours: h,
                  minutes: m,
                  seconds: s,
                  reason: effectiveReason,
               });
               setFeedback({
                  type: "success",
                  message: `Successfully updated hours for ${selectedDayOption.shortLabel} (${selectedDayOption.dateKey}).`,
               });
               router.refresh();
               onSuccess?.();
               setTimeout(() => {
                  onClose();
               }, 600);
            } else {
               setFeedback({
                  type: "error",
                  message: result.message || "Failed to update study hours.",
               });
            }
         } catch (error) {
            captureLogRocketException(error, {
               tags: { action: "admin-override-hours" },
               extra: {
                  challengeId,
                  participantId: participant.participantId,
                  logDate: selectedDayOption.dateKey,
               },
            });
            setFeedback({
               type: "error",
               message:
                  "An unexpected error occurred while saving the correction.",
            });
         }
      });
   };

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
         <div className="w-full max-w-lg rounded-3xl border border-[#383838] bg-[#141414] p-6 sm:p-7 shadow-2xl space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
               <div className="space-y-1">
                  <div className="flex items-center gap-2">
                     <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#3b82f6]/20 text-[#60a5fa] border border-[#3b82f6]/30">
                        Session Correction
                     </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-white">
                     Correct Participant Study Session
                  </h3>
               </div>
               <button
                  type="button"
                  onClick={onClose}
                  className="text-[#868686] hover:text-white transition-colors p-1 rounded-lg hover:bg-[#292929]"
               >
                  <X className="h-5 w-5" />
               </button>
            </div>

            {/* Participant Identification Card */}
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#1c1c1c] border border-[#2e2e2e]">
               <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-[#292929] border border-[#434343] overflow-hidden flex items-center justify-center shrink-0">
                     {participant.image ? (
                        <Image
                           src={participant.image}
                           alt={participant.displayName}
                           width={40}
                           height={40}
                           className="h-full w-full object-cover"
                           unoptimized
                        />
                     ) : (
                        <UserIcon className="h-5 w-5 text-[#868686]" />
                     )}
                  </div>
                  <div className="min-w-0">
                     <p className="text-sm font-bold text-white truncate">
                        {participant.displayName}
                     </p>
                     <p className="text-xs text-[#868686] truncate">
                        @{participant.username || "scholar"}
                     </p>
                  </div>
               </div>
               <div className="flex items-center gap-2 shrink-0">
                  {participant.teamName && (
                     <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border shrink-0"
                        style={getTeamBadgeStyle(participant.teamColor)}
                     >
                        {participant.teamName}
                     </span>
                  )}
                  {onOpenTargetOverride && (
                     <button
                        type="button"
                        onClick={() => {
                           onClose();
                           onOpenTargetOverride();
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#2a1b3d] hover:bg-[#3b2456] border border-[#a855f7]/40 text-[11px] font-semibold text-[#c084fc] hover:text-white transition-colors"
                        title="Switch to editing weekly target hours"
                     >
                        <Target className="h-3 w-3 text-[#c084fc]" />
                        <span>Edit Target</span>
                     </button>
                  )}
               </div>
            </div>

            {/* 7-Day Week Selector (Full Week D1..D7) */}
            <div className="space-y-2">
               <div className="flex items-center justify-between text-xs font-semibold text-[#868686]">
                  <span>Select Challenge Day (Full Week D1–D7)</span>
                  <span className="text-[#d1d1d1] font-sans-tabular">
                     {selectedDayOption.dateKey}
                  </span>
               </div>

               <div className="grid grid-cols-7 gap-1 w-full">
                  {dayOptions.map((opt) => {
                     const isSelected = selectedDayNumber === opt.dayNumber;
                     const loggedSec = getExistingSecondsForDate(opt.dateKey);
                     const hasHours = loggedSec > 0;
                     const isFuture = opt.isFuture;

                     return (
                        <button
                           key={opt.dayNumber}
                           type="button"
                           disabled={isFuture}
                           onClick={() => handleSelectDay(opt.dayNumber)}
                           className={`w-full min-w-0 py-2 px-1 rounded-xl text-center flex flex-col items-center justify-center transition-all ${
                              isSelected
                                 ? "bg-white text-black font-bold shadow-md ring-2 ring-white/20"
                                 : isFuture
                                   ? "bg-[#1c1c1c]/40 text-[#545454] cursor-not-allowed border border-transparent opacity-50"
                                   : "bg-[#1c1c1c] text-[#d1d1d1] hover:bg-[#292929] hover:text-white border border-[#2e2e2e]"
                           }`}
                           title={
                              isFuture
                                 ? `Day ${opt.dayNumber} (${opt.dateKey}) - Future date (cannot log or edit yet)`
                                 : `${opt.label} (${opt.dateKey}) - ${formatSecondsToClock(loggedSec)} logged`
                           }
                        >
                           <span className="text-[10px] uppercase tracking-wider opacity-75 leading-none">
                              {opt.weekday}
                           </span>
                           <span className="text-xs font-semibold mt-1 leading-none">
                              D{opt.dayNumber}
                           </span>
                           <span
                              className={`text-[9px] mt-1 font-mono leading-none ${
                                 isSelected
                                    ? "text-black font-semibold"
                                    : isFuture
                                      ? "text-[#404040]"
                                      : hasHours
                                        ? "text-[#4ade80]"
                                        : "text-[#666666]"
                              }`}
                           >
                              {isFuture
                                 ? "Locked"
                                 : hasHours
                                   ? `${Math.floor(loggedSec / 3600)}h`
                                   : "-"}
                           </span>
                        </button>
                     );
                  })}
               </div>

               <div className="flex items-center justify-between text-[11px] text-[#868686] px-1 pt-0.5">
                  <span>
                     Currently Logged on {selectedDayOption.shortLabel}:
                  </span>
                  <span className="font-mono font-semibold text-white">
                     {formatSecondsToClock(currentDayExistingSeconds)}
                  </span>
               </div>
            </div>

            {/* Ineligible day notice: No existing study session record */}
            {!hasExistingSession && !selectedDayOption.isFuture && (
               <div className="flex items-center gap-2.5 p-3 rounded-xl text-xs font-medium bg-[#382b10]/40 border border-[#eab308]/40 text-[#facc15]">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                     No study session recorded on {selectedDayOption.shortLabel}{" "}
                     ({selectedDayOption.dateKey}). In accordance with system
                     policy, arbitrary additions are prohibited; technical
                     corrections require an existing session record.
                  </span>
               </div>
            )}

            {/* Future date lock warning */}
            {selectedDayOption.isFuture && (
               <div className="flex items-center gap-2.5 p-3 rounded-xl text-xs font-medium bg-[#450a0a]/40 border border-[#ef4444]/40 text-[#f87171]">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                     Future date ({selectedDayOption.dateKey}): moderators
                     cannot add or edit study hours for future dates.
                  </span>
               </div>
            )}

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
               {/* Time Inputs */}
               <div className="space-y-2">
                  <label className="block text-xs font-semibold text-[#a3a3a3]">
                     Corrected Study Duration (HH:MM:SS)
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                     <div>
                        <span className="block text-[11px] text-[#868686] mb-1">
                           Hours (0–24)
                        </span>
                        <Input
                           type="number"
                           min="0"
                           max="24"
                           placeholder="0"
                           value={hours}
                           disabled={
                              isPending ||
                              selectedDayOption.isFuture ||
                              !hasExistingSession
                           }
                           onChange={(e) => setHours(e.target.value)}
                           className="h-11 rounded-xl bg-[#222222] border-[#383838] focus:border-white text-white text-center font-mono text-base disabled:opacity-40"
                        />
                     </div>
                     <div>
                        <span className="block text-[11px] text-[#868686] mb-1">
                           Minutes (0–59)
                        </span>
                        <Input
                           type="number"
                           min="0"
                           max="59"
                           placeholder="0"
                           value={minutes}
                           disabled={
                              isPending ||
                              selectedDayOption.isFuture ||
                              !hasExistingSession
                           }
                           onChange={(e) => setMinutes(e.target.value)}
                           className="h-11 rounded-xl bg-[#222222] border-[#383838] focus:border-white text-white text-center font-mono text-base disabled:opacity-40"
                        />
                     </div>
                     <div>
                        <span className="block text-[11px] text-[#868686] mb-1">
                           Seconds (0–59)
                        </span>
                        <Input
                           type="number"
                           min="0"
                           max="59"
                           placeholder="0"
                           value={seconds}
                           disabled={
                              isPending ||
                              selectedDayOption.isFuture ||
                              !hasExistingSession
                           }
                           onChange={(e) => setSeconds(e.target.value)}
                           className="h-11 rounded-xl bg-[#222222] border-[#383838] focus:border-white text-white text-center font-mono text-base disabled:opacity-40"
                        />
                     </div>
                  </div>

                  {/* Quick Clear Action */}
                  <div className="flex items-center pt-1">
                     <button
                        type="button"
                        onClick={handleClearTime}
                        disabled={
                           isPending ||
                           selectedDayOption.isFuture ||
                           !hasExistingSession
                        }
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#222222] hover:bg-[#2e2e2e] text-[#ef4444] hover:text-[#f87171] border border-[#383838] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                     >
                        <RotateCcw className="h-3 w-3" />
                        Clear Time
                     </button>
                  </div>
               </div>

               {/* Mandatory Audit Reason */}
               <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#a3a3a3]">
                     Mandatory Technical Correction Reason{" "}
                     <span className="text-red-400">*</span>
                  </label>
                  <Input
                     type="text"
                     placeholder="Detail technical glitch or error (min 10 characters, e.g. YPT sync offset correction)"
                     value={reason}
                     disabled={
                        isPending ||
                        selectedDayOption.isFuture ||
                        !hasExistingSession
                     }
                     onChange={(e) => setReason(e.target.value)}
                     className="h-11 rounded-xl bg-[#222222] border-[#383838] focus:border-white text-white text-xs px-3.5 disabled:opacity-40"
                  />
                  <p className="text-[11px] text-[#868686] flex items-center gap-1.5 pt-0.5">
                     <ShieldAlert className="h-3.5 w-3.5 text-[#3b82f6] shrink-0" />
                     <span>
                        Permanent audit log: recorded with your moderator ID and
                        reason.
                     </span>
                  </p>
               </div>

               {/* Feedback banner */}
               {feedback && (
                  <div
                     className={`flex items-center gap-2.5 p-3 rounded-xl text-xs font-medium border ${
                        feedback.type === "success"
                           ? "bg-[#144520]/40 border-[#22c55e]/40 text-[#4ade80]"
                           : "bg-[#450a0a]/40 border-[#ef4444]/40 text-[#f87171]"
                     }`}
                  >
                     {feedback.type === "success" ? (
                        <Check className="h-4 w-4 shrink-0" />
                     ) : (
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                     )}
                     <span>{feedback.message}</span>
                  </div>
               )}

               {/* Modal Actions */}
               <div className="flex items-center justify-end gap-3 pt-2">
                  <Button
                     type="button"
                     variant="outline"
                     onClick={onClose}
                     disabled={isPending}
                     className="h-10 px-5 rounded-xl border-[#383838] bg-[#1c1c1c] text-white hover:bg-[#292929] text-xs font-semibold"
                  >
                     Cancel
                  </Button>
                  <Button
                     type="submit"
                     disabled={
                        isPending ||
                        selectedDayOption.isFuture ||
                        !hasExistingSession ||
                        reason.trim().length < 10
                     }
                     className="h-10 px-5 rounded-xl bg-white text-black hover:bg-[#e0e0e0] text-xs font-bold gap-2 shadow-sm disabled:opacity-50"
                  >
                     {isPending && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                     )}
                     Save Correction
                  </Button>
               </div>
            </form>
         </div>
      </div>
   );
}
