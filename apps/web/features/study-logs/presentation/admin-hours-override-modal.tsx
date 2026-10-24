"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
   Clock,
   X,
   AlertTriangle,
   Check,
   Info,
   Loader2,
   ShieldAlert,
   User as UserIcon,
   RotateCcw,
   Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
   captureLogRocketException,
   trackLogRocketEvent,
} from "@/core/observability/logrocket";
import {
   decomposeSecondsToParts,
   formatSecondsToClock,
   MAX_COUNTED_DAILY_STUDY_SECONDS,
   MAX_DAILY_LOG_SECONDS,
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

/**
 * Edits a participant’s study duration for a selected challenge day with an audit reason.
 */
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

   const handleHoursChange = (raw: string) => {
      if (raw === "") {
         setHours("");
         return;
      }
      const clean = raw.replace(/\D/g, "");
      if (clean === "") {
         setHours("");
         return;
      }
      const val = parseInt(clean, 10);
      if (isNaN(val)) return;
      const clamped = Math.max(0, Math.min(24, val));
      setHours(String(clamped));
   };

   const handleMinutesChange = (raw: string) => {
      if (raw === "") {
         setMinutes("");
         return;
      }
      const clean = raw.replace(/\D/g, "");
      if (clean === "") {
         setMinutes("");
         return;
      }
      const val = parseInt(clean, 10);
      if (isNaN(val)) return;
      const clamped = Math.max(0, Math.min(59, val));
      setMinutes(String(clamped));
   };

   const handleSecondsChange = (raw: string) => {
      if (raw === "") {
         setSeconds("");
         return;
      }
      const clean = raw.replace(/\D/g, "");
      if (clean === "") {
         setSeconds("");
         return;
      }
      const val = parseInt(clean, 10);
      if (isNaN(val)) return;
      const clamped = Math.max(0, Math.min(59, val));
      setSeconds(String(clamped));
   };

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
      if (durationSeconds > MAX_DAILY_LOG_SECONDS) {
         setFeedback({
            type: "error",
            message: "A single day cannot exceed 24:00:00 of study time.",
         });
         return;
      }
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
               startTransition(() => {
                  router.refresh();
               });
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

   const handleResetOverall = (e: React.FormEvent) => {
      e.preventDefault();
      setFeedback(null);

      const effectiveReason =
         reason.trim().length >= 3
            ? reason.trim()
            : "Reset overall study hours to 00:00:00 by moderator";

      startTransition(async () => {
         try {
            const { adminResetParticipantOverallHoursAction } =
               await import("@/features/study-logs/api/admin-override.actions");
            const result = await adminResetParticipantOverallHoursAction({
               challengeId,
               participantId: participant.participantId,
               reason: effectiveReason,
            });

            if (result.ok) {
               trackLogRocketEvent("AdminOverallHoursResetExecuted", {
                  challengeId,
                  participantId: participant.participantId,
                  reason: effectiveReason,
               });
               setFeedback({
                  type: "success",
                  message: `Successfully reset overall study hours to 00:00:00 for ${participant.displayName}.`,
               });
               startTransition(() => {
                  router.refresh();
               });
               onSuccess?.();
               setTimeout(() => {
                  onClose();
               }, 600);
            } else {
               setFeedback({
                  type: "error",
                  message:
                     result.message || "Failed to reset overall study hours.",
               });
            }
         } catch (error) {
            captureLogRocketException(error, {
               tags: { action: "admin-reset-overall-hours" },
               extra: {
                  challengeId,
                  participantId: participant.participantId,
               },
            });
            setFeedback({
               type: "error",
               message:
                  "An unexpected error occurred while resetting overall hours.",
            });
         }
      });
   };

   return (
      <Dialog
         open={isOpen}
         onOpenChange={(open) => {
            if (!open) onClose();
         }}
      >
         <DialogContent className="max-w-lg rounded-3xl border-border-strong bg-surface-primary p-6 sm:p-7 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
               <div className="space-y-1">
                  <div className="flex items-center gap-2">
                     <span className="inline-flex items-center px-2 py-0.5 rounded-full text-label font-bold uppercase tracking-wider bg-feedback-info/20 text-feedback-info border border-feedback-info/30">
                        Session Correction
                     </span>
                  </div>
                  <DialogTitle className="text-lg sm:text-xl font-bold text-white">
                     Correct Participant Study Session
                  </DialogTitle>
               </div>
            </div>

            {/* Participant Identification Card */}
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-surface-elevated border border-border-strong">
               <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-surface-nested border border-border-strong overflow-hidden flex items-center justify-center shrink-0">
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
                        <UserIcon className="h-5 w-5 text-text-tertiary" />
                     )}
                  </div>
                  <div className="min-w-0">
                     <p className="text-sm font-bold text-white truncate">
                        {participant.displayName}
                     </p>
                     <p className="text-xs text-text-tertiary truncate">
                        @{participant.username || "scholar"}
                     </p>
                  </div>
               </div>
               <div className="flex items-center gap-2 shrink-0">
                  {participant.teamName && (
                     <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-meta font-semibold border shrink-0"
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
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-accent-bg hover:bg-accent-bg border border-accent/40 text-meta font-semibold text-accent-text hover:text-white transition-colors"
                        title="Switch to editing weekly target hours"
                     >
                        <Target className="h-3 w-3 text-accent-text" />
                        <span>Edit Target</span>
                     </button>
                  )}
               </div>
            </div>

            {/* 7-Day Week Selector (Full Week D1..D7) */}
            <div className="space-y-2">
               <div className="flex items-center justify-between text-xs font-semibold text-text-tertiary">
                  <span>Select Challenge Day (Full Week D1–D7)</span>
                  <span className="text-text-secondary font-sans-tabular">
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
                                   ? "bg-surface-elevated/40 text-text-tertiary cursor-not-allowed border border-transparent opacity-50"
                                   : "bg-surface-elevated text-text-secondary hover:bg-surface-nested hover:text-white border border-border-strong"
                           }`}
                           title={
                              isFuture
                                 ? `Day ${opt.dayNumber} (${opt.dateKey}) - Future date (cannot log or edit yet)`
                                 : `${opt.label} (${opt.dateKey}) - ${formatSecondsToClock(loggedSec)} logged`
                           }
                        >
                           <span className="text-label uppercase tracking-wider opacity-75 leading-none">
                              {opt.weekday}
                           </span>
                           <span className="text-xs font-semibold mt-1 leading-none">
                              D{opt.dayNumber}
                           </span>
                           <span
                              className={`text-caption mt-1 font-mono leading-none ${
                                 isSelected
                                    ? "text-black font-semibold"
                                    : isFuture
                                      ? "text-text-tertiary"
                                      : hasHours
                                        ? "text-feedback-success"
                                        : "text-text-tertiary"
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

               <div className="flex items-center justify-between text-meta text-text-tertiary px-1 pt-0.5">
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
               <div className="flex items-center gap-2.5 p-3 rounded-xl text-xs font-medium bg-brand-1/15/40 border border-brand-1/40 text-brand-1">
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
               <div className="flex items-center gap-2.5 p-3 rounded-xl text-xs font-medium bg-feedback-error-bg/40 border border-feedback-error/40 text-feedback-error-text">
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
                  <Label
                     id="admin-override-duration"
                     className="block text-xs font-semibold text-text-tertiary"
                  >
                     Corrected Study Duration (HH:MM:SS)
                  </Label>
                  <div
                     role="group"
                     aria-labelledby="admin-override-duration"
                     className="grid grid-cols-3 gap-3"
                  >
                     <div>
                        <span className="block text-meta text-text-tertiary mb-1">
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
                           onChange={(e) => handleHoursChange(e.target.value)}
                           className="h-11 rounded-xl bg-surface-elevated border-border-strong focus:border-white text-white text-center font-mono text-base disabled:opacity-40"
                        />
                     </div>
                     <div>
                        <span className="block text-meta text-text-tertiary mb-1">
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
                           onChange={(e) => handleMinutesChange(e.target.value)}
                           className="h-11 rounded-xl bg-surface-elevated border-border-strong focus:border-white text-white text-center font-mono text-base disabled:opacity-40"
                        />
                     </div>
                     <div>
                        <span className="block text-meta text-text-tertiary mb-1">
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
                           onChange={(e) => handleSecondsChange(e.target.value)}
                           className="h-11 rounded-xl bg-surface-elevated border-border-strong focus:border-white text-white text-center font-mono text-base disabled:opacity-40"
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
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-meta font-semibold bg-surface-elevated hover:bg-surface-nested text-feedback-error hover:text-feedback-error-text border border-border-strong transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                     >
                        <RotateCcw className="h-3 w-3" />
                        Clear Time
                     </button>
                  </div>
               </div>

               {(() => {
                  const currentSec =
                     parseInt(hours || "0", 10) * 3600 +
                     parseInt(minutes || "0", 10) * 60 +
                     parseInt(seconds || "0", 10);
                  if (currentSec > MAX_COUNTED_DAILY_STUDY_SECONDS) {
                     return (
                        <div
                           data-testid="admin-daily-cap-notice"
                           className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200 animate-in fade-in"
                        >
                           <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
                           <div className="text-left">
                              <p className="font-semibold text-amber-300">
                                 14-Hour Scoring Cap Enforced
                              </p>
                              <p className="text-amber-200/80 mt-0.5 leading-relaxed">
                                 The participant will have{" "}
                                 {hours.padStart(2, "0")}:
                                 {minutes.padStart(2, "0")}:
                                 {seconds.padStart(2, "0")} logged, but
                                 challenge scoring and deficit calculations will
                                 strictly count a maximum of 14:00:00.
                              </p>
                           </div>
                        </div>
                     );
                  }
                  return null;
               })()}

               {/* Mandatory Audit Reason */}
               <div className="space-y-1.5">
                  <Label
                     htmlFor="admin-override-reason"
                     className="block text-xs font-semibold text-text-tertiary"
                  >
                     Mandatory Technical Correction Reason{" "}
                     <span className="text-red-400">*</span>
                  </Label>
                  <Input
                     id="admin-override-reason"
                     type="text"
                     placeholder="Detail technical glitch or error (min 10 characters, e.g. YPT sync offset correction)"
                     value={reason}
                     disabled={
                        isPending ||
                        selectedDayOption.isFuture ||
                        !hasExistingSession
                     }
                     onChange={(e) => setReason(e.target.value)}
                     className="h-11 rounded-xl bg-surface-elevated border-border-strong focus:border-white text-white text-xs px-3.5 disabled:opacity-40"
                  />
                  <p className="text-meta text-text-tertiary flex items-center gap-1.5 pt-0.5">
                     <ShieldAlert className="h-3.5 w-3.5 text-feedback-info shrink-0" />
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
                           ? "bg-feedback-success-bg/40 border-feedback-success/40 text-feedback-success"
                           : "bg-feedback-error-bg/40 border-feedback-error/40 text-feedback-error-text"
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
                     className="h-10 px-5 rounded-xl border-border-strong bg-surface-elevated text-white hover:bg-surface-nested text-xs font-semibold"
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
                     className="h-10 px-5 rounded-xl bg-white text-black hover:bg-white/90 text-xs font-bold gap-2 shadow-sm disabled:opacity-50"
                  >
                     {isPending && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                     )}
                     Save Correction
                  </Button>
               </div>
            </form>
         </DialogContent>
      </Dialog>
   );
}
