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
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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

/** Renders the administrator target-hours override modal. */
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
      <Dialog
         open={isOpen}
         onOpenChange={(open) => {
            if (!open) onClose();
         }}
      >
         <DialogContent className="max-w-lg rounded-[28px] border-border-strong bg-surface-elevated p-6 sm:p-7 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-border-default pb-4">
               <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-accent-bg border border-accent/40 flex items-center justify-center shrink-0">
                     <Target className="h-5 w-5 text-accent-text" />
                  </div>
                  <div>
                     <DialogTitle
                        id="admin-target-override-title"
                        className="text-base sm:text-lg font-bold text-text-primary tracking-tight"
                     >
                        Edit Weekly Target Hours
                     </DialogTitle>
                     <p className="text-xs text-text-tertiary">
                        Host & Developer Override · Law L5 / FEAT-DECL-04
                     </p>
                  </div>
               </div>
            </div>

            {/* Participant Info Banner */}
            <div className="rounded-2xl border border-border-default bg-surface-primary p-3.5 flex items-center justify-between gap-3">
               <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-surface-nested border border-border-strong overflow-hidden shrink-0 flex items-center justify-center">
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
                        <UserIcon className="h-5 w-5 text-text-tertiary" />
                     )}
                  </div>
                  <div className="min-w-0">
                     <p className="text-xs font-bold text-white truncate">
                        {participant.displayName}
                     </p>
                     <p className="text-meta text-text-tertiary truncate">
                        @{participant.username || "scholar"}
                        {teamBadge && (
                           <>
                              {" "}
                              •{" "}
                              <span
                                 className="px-1.5 py-0.2 rounded font-semibold text-label"
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
                  <span className="text-label uppercase font-semibold text-text-tertiary block">
                     Current Target
                  </span>
                  <span className="text-xs font-mono font-bold text-accent-text">
                     {formatSecondsToClock(currentTargetSeconds)}
                  </span>
               </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
               {/* Clock Input (HH:MM:SS) */}
               <div className="space-y-2">
                  <Label
                     id="target-override-clock"
                     className="text-xs font-bold uppercase tracking-wider text-text-secondary block"
                  >
                     New Target Commitment (HH:MM:SS)
                  </Label>
                  <div
                     role="group"
                     aria-labelledby="target-override-clock"
                     className="grid grid-cols-3 gap-2 sm:gap-3"
                  >
                     <div>
                        <span className="text-label text-text-tertiary uppercase font-bold block mb-1">
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
                           className="h-12 text-center text-lg font-bold font-mono bg-surface-nested border-border-strong text-white focus:border-accent"
                           placeholder="35"
                           required
                        />
                     </div>
                     <div>
                        <span className="text-label text-text-tertiary uppercase font-bold block mb-1">
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
                           className="h-12 text-center text-lg font-bold font-mono bg-surface-nested border-border-strong text-white focus:border-accent"
                           placeholder="00"
                        />
                     </div>
                     <div>
                        <span className="text-label text-text-tertiary uppercase font-bold block mb-1">
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
                           className="h-12 text-center text-lg font-bold font-mono bg-surface-nested border-border-strong text-white focus:border-accent"
                           placeholder="00"
                        />
                     </div>
                  </div>
               </div>

               {/* Quick Presets */}
               <div className="space-y-1.5">
                  <span className="text-meta text-text-tertiary font-medium block">
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
                                    ? "bg-accent/20 border-accent text-accent-text font-bold"
                                    : "bg-surface-nested border-border-strong text-text-secondary hover:bg-surface-nested hover:text-white"
                              }`}
                           >
                              {pHours}h
                           </button>
                        );
                     })}
                  </div>
               </div>

               {/* Comparison & Preview Box */}
               <div className="rounded-2xl border border-border-default bg-surface-primary p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                     <span className="text-text-tertiary">Target Change:</span>
                     <div className="flex items-center gap-2 font-mono font-semibold">
                        <span className="text-text-tertiary">
                           {formatSecondsToClock(currentTargetSeconds)}
                        </span>
                        <ArrowRight className="h-3 w-3 text-text-tertiary" />
                        <span
                           className={`font-bold ${
                              validationError
                                 ? "text-feedback-error"
                                 : "text-accent-text"
                           }`}
                        >
                           {formatSecondsToClock(previewSeconds)}
                        </span>
                     </div>
                  </div>

                  <div className="flex items-center justify-between text-meta text-text-tertiary pt-1 border-t border-border-default">
                     <span>Human Duration:</span>
                     <span className="font-medium text-text-secondary">
                        {formatSecondsToHuman(Math.max(0, previewSeconds))}
                        {diffSeconds !== 0 && (
                           <span
                              className={`ml-1.5 font-semibold ${
                                 diffSeconds > 0
                                    ? "text-feedback-success"
                                    : "text-brand-1"
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
                  <Label
                     htmlFor="target-override-reason"
                     className="text-xs font-bold uppercase tracking-wider text-text-secondary block"
                  >
                     Audit Reason
                  </Label>
                  <Input
                     id="target-override-reason"
                     type="text"
                     value={reason}
                     onChange={(e) => setReason(e.target.value)}
                     disabled={isPending}
                     placeholder="e.g. Host accommodation for student illness / work schedule"
                     className="h-10 text-xs bg-surface-nested border-border-strong text-white placeholder-text-tertiary focus:border-accent"
                  />
                  <p className="text-label text-text-tertiary">
                     Recorded in the immutable event audit trail for
                     transparency.
                  </p>
               </div>

               {/* Notice */}
               <div className="rounded-xl border border-feedback-info/20 bg-feedback-info-bg/20 p-2.5 flex items-start gap-2 text-xs text-feedback-info-text">
                  <Info className="h-4 w-4 shrink-0 text-feedback-info mt-0.5" />
                  <p className="text-meta leading-relaxed">
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
                           ? "bg-feedback-success-bg/40 border-feedback-success/40 text-feedback-success-text"
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

               {/* Action Buttons */}
               <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border-default">
                  <Button
                     type="button"
                     variant="outline"
                     onClick={onClose}
                     disabled={isPending}
                     className="h-10 px-4 rounded-xl border-border-strong bg-surface-nested hover:bg-surface-nested text-text-secondary text-xs font-semibold"
                  >
                     Cancel
                  </Button>

                  <Button
                     type="submit"
                     disabled={isPending || Boolean(validationError)}
                     className="h-10 px-5 rounded-xl bg-accent hover:bg-accent text-white text-xs font-bold gap-2 disabled:opacity-50"
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
         </DialogContent>
      </Dialog>
   );
}
