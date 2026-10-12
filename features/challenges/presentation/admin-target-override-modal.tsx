"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
   Target,
   X,
   AlertTriangle,
   Check,
   Loader2,
   User as UserIcon,
   ArrowRight,
   Info,
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
   formatSecondsToHuman,
   MIN_WEEKLY_TARGET_SECONDS,
   MAX_WEEKLY_TARGET_SECONDS,
} from "@/features/study-logs/domain/duration";
import { composeDurationSeconds } from "@/features/study-logs/domain/daily-log.validation";
import { getTeamBadgeStyle } from "@/features/challenges/domain/team-colors";

export interface AdminTargetOverrideParticipant {
   participantId: string;
   userId?: string;
   displayName: string;
   username?: string | null;
   image?: string | null;
   teamName?: string | null;
   teamColor?: string | null;
   targetSeconds: number;
   targetClock?: string;
}

export interface AdminTargetOverrideModalProps {
   isOpen: boolean;
   onClose: () => void;
   challengeId: string;
   participant: AdminTargetOverrideParticipant | null;
   onSuccess?: (newTargetSeconds: number) => void;
}

const COMMON_PRESET_HOURS = [15, 20, 25, 30, 35, 40, 50, 60];

export function AdminTargetOverrideModal({
   isOpen,
   onClose,
   challengeId,
   participant,
   onSuccess,
}: AdminTargetOverrideModalProps) {
   const router = useRouter();
   const [isPending, startTransition] = useTransition();

   const initialParts = useMemo(() => {
      return decomposeSecondsToParts(participant?.targetSeconds || 0);
   }, [participant?.targetSeconds]);

   const [hours, setHours] = useState<string>(() =>
      participant?.targetSeconds ? String(initialParts.hours) : "35"
   );
   const [minutes, setMinutes] = useState<string>(() =>
      participant?.targetSeconds ? String(initialParts.minutes) : "0"
   );
   const [seconds, setSeconds] = useState<string>(() =>
      participant?.targetSeconds ? String(initialParts.seconds) : "0"
   );
   const [reason, setReason] = useState<string>("");
   const [feedback, setFeedback] = useState<{
      type: "success" | "error";
      message: string;
   } | null>(null);

   // Populate form inputs when modal opens or participant changes
   useEffect(() => {
      if (isOpen && participant) {
         const parts = decomposeSecondsToParts(participant.targetSeconds || 0);
         setHours(String(parts.hours));
         setMinutes(String(parts.minutes));
         setSeconds(String(parts.seconds));
         setReason("");
         setFeedback(null);
      }
   }, [isOpen, participant]);

   // Calculate preview duration in seconds
   const previewSeconds = useMemo(() => {
      const h = Math.max(0, parseInt(hours || "0", 10) || 0);
      const m = Math.max(0, Math.min(59, parseInt(minutes || "0", 10) || 0));
      const s = Math.max(0, Math.min(59, parseInt(seconds || "0", 10) || 0));
      return composeDurationSeconds(h, m, s);
   }, [hours, minutes, seconds]);

   // Validation state
   const validationError = useMemo(() => {
      if (previewSeconds < MIN_WEEKLY_TARGET_SECONDS) {
         return "Weekly target must be at least 1 hour (01:00:00).";
      }
      if (previewSeconds > MAX_WEEKLY_TARGET_SECONDS) {
         return "Weekly target cannot exceed 105 hours (105:00:00).";
      }
      return null;
   }, [previewSeconds]);

   const currentTargetSeconds = participant?.targetSeconds ?? 0;
   const diffSeconds = previewSeconds - currentTargetSeconds;

   if (!isOpen || !participant) return null;

   const teamBadge = participant.teamName
      ? getTeamBadgeStyle(participant.teamColor)
      : null;

   const handlePresetClick = (presetHours: number) => {
      setHours(String(presetHours));
      setMinutes("0");
      setSeconds("0");
      setFeedback(null);
   };

   const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();

      if (validationError) {
         setFeedback({
            type: "error",
            message: validationError,
         });
         return;
      }

      setFeedback(null);

      startTransition(async () => {
         try {
            const h = parseInt(hours || "0", 10) || 0;
            const m = parseInt(minutes || "0", 10) || 0;
            const s = parseInt(seconds || "0", 10) || 0;

            const { adminUpdateParticipantTargetAction } =
               await import("@/features/challenges/api/challenge-admin.actions");

            const res = await adminUpdateParticipantTargetAction({
               challengeId,
               participantId: participant.participantId,
               hours: h,
               minutes: m,
               seconds: s,
               reason: reason.trim() || undefined,
            });

            if (!res.ok) {
               setFeedback({
                  type: "error",
                  message: res.message || "Failed to update target hours.",
               });
               return;
            }

            trackLogRocketEvent("AdminTargetOverrideSuccess", {
               challengeId,
               participantId: participant.participantId,
               oldTargetSeconds: currentTargetSeconds,
               newTargetSeconds: previewSeconds,
            });

            setFeedback({
               type: "success",
               message: `Successfully updated weekly target to ${formatSecondsToClock(previewSeconds)}.`,
            });

            startTransition(() => {
               router.refresh();
            });
            onSuccess?.(previewSeconds);

            setTimeout(() => {
               onClose();
            }, 600);
         } catch (err) {
            captureLogRocketException(err, {
               tags: { action: "admin-update-target" },
               extra: { challengeId, participantId: participant.participantId },
            });
            setFeedback({
               type: "error",
               message:
                  err instanceof Error
                     ? err.message
                     : "An unexpected error occurred while updating target.",
            });
         }
      });
   };

   return (
      <div
         className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in"
         role="dialog"
         aria-modal="true"
         aria-labelledby="admin-target-override-title"
      >
         <div className="relative w-full max-w-lg rounded-[28px] border border-[#383838] bg-[#1c1c1c] p-6 sm:p-7 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-[#292929] pb-4">
               <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-[#2a1b3d] border border-[#a855f7]/40 flex items-center justify-center shrink-0">
                     <Target className="h-5 w-5 text-[#c084fc]" />
                  </div>
                  <div>
                     <h2
                        id="admin-target-override-title"
                        className="text-base sm:text-lg font-bold text-[#f4f3f6] tracking-tight"
                     >
                        Edit Weekly Target Hours
                     </h2>
                     <p className="text-xs text-[#868686]">
                        Host & Developer Override · Law L5 / FEAT-DECL-04
                     </p>
                  </div>
               </div>
               <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-1.5 text-[#868686] hover:bg-[#292929] hover:text-[#f4f3f6] transition-colors"
                  aria-label="Close dialog"
                  disabled={isPending}
               >
                  <X className="h-5 w-5" />
               </button>
            </div>

            {/* Participant Info Banner */}
            <div className="rounded-2xl border border-[#292929] bg-[#141414] p-3.5 flex items-center justify-between gap-3">
               <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-[#292929] border border-[#383838] overflow-hidden shrink-0 flex items-center justify-center">
                     {participant.image && participant.image.trim() !== "" ? (
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
                     <p className="text-xs font-bold text-[#ffffff] truncate">
                        {participant.displayName}
                     </p>
                     <p className="text-[11px] text-[#868686] truncate">
                        @{participant.username || "scholar"}
                        {teamBadge && (
                           <>
                              {" "}
                              •{" "}
                              <span
                                 className="px-1.5 py-0.2 rounded font-semibold text-[10px]"
                                 style={teamBadge}
                              >
                                 {participant.teamName}
                              </span>
                           </>
                        )}
                     </p>
                  </div>
               </div>

               <div className="text-right shrink-0">
                  <span className="text-[10px] uppercase font-semibold text-[#868686] block">
                     Current Target
                  </span>
                  <span className="text-xs font-mono font-bold text-[#c084fc]">
                     {formatSecondsToClock(currentTargetSeconds)}
                  </span>
               </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
               {/* Clock Input (HH:MM:SS) */}
               <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#d1d1d1] block">
                     New Target Commitment (HH:MM:SS)
                  </label>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                     <div>
                        <span className="text-[10px] text-[#868686] uppercase font-bold block mb-1">
                           Hours (1–105)
                        </span>
                        <Input
                           type="number"
                           min={0}
                           max={105}
                           value={hours}
                           onChange={(e) => {
                              setHours(e.target.value);
                              setFeedback(null);
                           }}
                           disabled={isPending}
                           className="h-12 text-center text-lg font-bold font-mono bg-[#242424] border-[#383838] text-white focus:border-[#a855f7]"
                           placeholder="35"
                           required
                        />
                     </div>
                     <div>
                        <span className="text-[10px] text-[#868686] uppercase font-bold block mb-1">
                           Minutes (0–59)
                        </span>
                        <Input
                           type="number"
                           min={0}
                           max={59}
                           value={minutes}
                           onChange={(e) => {
                              setMinutes(e.target.value);
                              setFeedback(null);
                           }}
                           disabled={isPending}
                           className="h-12 text-center text-lg font-bold font-mono bg-[#242424] border-[#383838] text-white focus:border-[#a855f7]"
                           placeholder="00"
                        />
                     </div>
                     <div>
                        <span className="text-[10px] text-[#868686] uppercase font-bold block mb-1">
                           Seconds (0–59)
                        </span>
                        <Input
                           type="number"
                           min={0}
                           max={59}
                           value={seconds}
                           onChange={(e) => {
                              setSeconds(e.target.value);
                              setFeedback(null);
                           }}
                           disabled={isPending}
                           className="h-12 text-center text-lg font-bold font-mono bg-[#242424] border-[#383838] text-white focus:border-[#a855f7]"
                           placeholder="00"
                        />
                     </div>
                  </div>
               </div>

               {/* Quick Presets */}
               <div className="space-y-1.5">
                  <span className="text-[11px] text-[#868686] font-medium block">
                     Quick Presets:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                     {COMMON_PRESET_HOURS.map((pHours) => {
                        const isSelected = previewSeconds === pHours * 3600;
                        return (
                           <button
                              key={pHours}
                              type="button"
                              onClick={() => handlePresetClick(pHours)}
                              disabled={isPending}
                              className={`px-2.5 py-1 text-xs rounded-xl border transition-colors font-mono ${
                                 isSelected
                                    ? "bg-[#a855f7]/20 border-[#a855f7] text-[#e9d5ff] font-bold"
                                    : "bg-[#242424] border-[#383838] text-[#d1d1d1] hover:bg-[#2e2e2e] hover:text-white"
                              }`}
                           >
                              {pHours}h
                           </button>
                        );
                     })}
                  </div>
               </div>

               {/* Comparison & Preview Box */}
               <div className="rounded-2xl border border-[#292929] bg-[#141414] p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                     <span className="text-[#868686]">Target Change:</span>
                     <div className="flex items-center gap-2 font-mono font-semibold">
                        <span className="text-[#868686]">
                           {formatSecondsToClock(currentTargetSeconds)}
                        </span>
                        <ArrowRight className="h-3 w-3 text-[#868686]" />
                        <span
                           className={`font-bold ${
                              validationError
                                 ? "text-[#ef4444]"
                                 : "text-[#c084fc]"
                           }`}
                        >
                           {formatSecondsToClock(previewSeconds)}
                        </span>
                     </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#868686] pt-1 border-t border-[#262626]">
                     <span>Human Duration:</span>
                     <span className="font-medium text-[#d1d1d1]">
                        {formatSecondsToHuman(Math.max(0, previewSeconds))}
                        {diffSeconds !== 0 && (
                           <span
                              className={`ml-1.5 font-semibold ${
                                 diffSeconds > 0
                                    ? "text-[#22c55e]"
                                    : "text-[#f59e0b]"
                              }`}
                           >
                              ({diffSeconds > 0 ? "+" : "-"}
                              {formatSecondsToHuman(Math.abs(diffSeconds))})
                           </span>
                        )}
                     </span>
                  </div>
               </div>

               {/* Audit Reason */}
               <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#d1d1d1] block">
                     Audit Reason
                  </label>
                  <Input
                     type="text"
                     value={reason}
                     onChange={(e) => setReason(e.target.value)}
                     disabled={isPending}
                     placeholder="e.g. Host accommodation for student illness / work schedule"
                     className="h-10 text-xs bg-[#242424] border-[#383838] text-white placeholder-[#868686] focus:border-[#a855f7]"
                  />
                  <p className="text-[10px] text-[#868686]">
                     Recorded in the immutable event audit trail for
                     transparency.
                  </p>
               </div>

               {/* Notice */}
               <div className="rounded-xl border border-[#3b82f6]/20 bg-[#1e293b]/20 p-2.5 flex items-start gap-2 text-xs text-[#93c5fd]">
                  <Info className="h-4 w-4 shrink-0 text-[#60a5fa] mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                     Updating weekly target hours dynamically recalculates the
                     scholar&apos;s catch-up deficit pace, goal completion
                     percentage, and three-condition punishment outcomes.
                  </p>
               </div>

               {/* Feedback banner */}
               {feedback && (
                  <div
                     className={`rounded-xl border p-3 text-xs flex items-center gap-2 ${
                        feedback.type === "success"
                           ? "bg-[#144520]/40 border-[#22c55e]/40 text-[#85ff93]"
                           : "bg-[#401010]/40 border-[#ef4444]/40 text-[#ff5757]"
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

               {/* Action Buttons */}
               <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#292929]">
                  <Button
                     type="button"
                     variant="outline"
                     onClick={onClose}
                     disabled={isPending}
                     className="h-10 px-4 rounded-xl border-[#383838] bg-[#242424] hover:bg-[#2e2e2e] text-[#d1d1d1] text-xs font-semibold"
                  >
                     Cancel
                  </Button>

                  <Button
                     type="submit"
                     disabled={isPending || Boolean(validationError)}
                     className="h-10 px-5 rounded-xl bg-[#a855f7] hover:bg-[#9333ea] text-white text-xs font-bold gap-2 disabled:opacity-50"
                  >
                     {isPending ? (
                        <>
                           <Loader2 className="h-3.5 w-3.5 animate-spin" />
                           <span>Saving Target...</span>
                        </>
                     ) : (
                        <>
                           <Target className="h-3.5 w-3.5" />
                           <span>Save Target Hours</span>
                        </>
                     )}
                  </Button>
               </div>
            </form>
         </div>
      </div>
   );
}
