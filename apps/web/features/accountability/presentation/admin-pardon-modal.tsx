"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
   HeartHandshake,
   X,
   AlertTriangle,
   Check,
   Loader2,
   User as UserIcon,
   Info,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
   captureLogRocketException,
   trackLogRocketEvent,
} from "@/core/observability/logrocket";
import { getTeamBadgeStyle } from "@/features/challenges/domain/team-colors";

export interface AdminPardonParticipant {
   participantId: string;
   userId?: string;
   displayName: string;
   username?: string | null;
   image?: string | null;
   teamName?: string | null;
   teamColor?: string | null;
   paceStatus?: string;
   status?: string;
}

export interface AdminPardonModalProps {
   isOpen: boolean;
   onClose: () => void;
   challengeId: string;
   participant: AdminPardonParticipant | null;
   onSuccess?: () => void;
}

/** Renders the host pardon / excuse modal dialog (FEAT-PUN-04). */
export function AdminPardonModal({
   isOpen,
   onClose,
   challengeId,
   participant,
   onSuccess,
}: AdminPardonModalProps) {
   const router = useRouter();
   const [isPending, startTransition] = useTransition();
   const [reason, setReason] = useState("");
   const [feedback, setFeedback] = useState<{
      type: "success" | "error";
      message: string;
   } | null>(null);

   if (!isOpen || !participant) {
      return null;
   }

   const teamBadgeStyle = getTeamBadgeStyle(participant.teamColor);

   const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedReason = reason.trim();

      if (trimmedReason.length < 3) {
         setFeedback({
            type: "error",
            message:
               "Please provide a valid pardon rationale (at least 3 characters).",
         });
         return;
      }

      setFeedback(null);
      startTransition(async () => {
         try {
            const { adminPardonAction } =
               await import("@/features/accountability/api/admin-pardon.actions");
            const result = await adminPardonAction({
               challengeId,
               participantId: participant.participantId,
               reason: trimmedReason,
            });

            if (result.ok) {
               trackLogRocketEvent("AdminPardonGranted", {
                  challengeId,
                  participantId: participant.participantId,
                  reason: trimmedReason,
               });

               setFeedback({
                  type: "success",
                  message: `Successfully pardoned ${participant.displayName}.`,
               });

               setTimeout(() => {
                  onClose();
                  onSuccess?.();
                  router.refresh();
               }, 800);
            } else {
               setFeedback({
                  type: "error",
                  message: result.message || "Failed to grant pardon.",
               });
            }
         } catch (error) {
            captureLogRocketException(error, {
               tags: { action: "admin-pardon" },
               extra: { challengeId, participantId: participant.participantId },
            });
            setFeedback({
               type: "error",
               message: "An unexpected error occurred while granting pardon.",
            });
         }
      });
   };

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
         <div
            className="w-full max-w-lg rounded-3xl border border-border-default bg-surface-page p-6 sm:p-7 shadow-2xl relative space-y-5 animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pardon-modal-title"
         >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border-default">
               <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-feedback-success/15 border border-feedback-success/30 flex items-center justify-center text-feedback-success">
                     <HeartHandshake className="h-5 w-5" />
                  </div>
                  <div>
                     <h3
                        id="pardon-modal-title"
                        className="text-base sm:text-lg font-bold text-white tracking-tight"
                     >
                        Issue Host Pardon / Excuse
                     </h3>
                     <p className="text-xs text-text-tertiary">
                        Relieve member from forfeit obligations (Law L5 /
                        FEAT-PUN-04)
                     </p>
                  </div>
               </div>

               <button
                  type="button"
                  onClick={onClose}
                  disabled={isPending}
                  className="h-8 w-8 rounded-full bg-surface-elevated border border-border-default flex items-center justify-center text-text-tertiary hover:text-white hover:border-border-strong transition-colors"
                  aria-label="Close dialog"
               >
                  <X className="h-4 w-4" />
               </button>
            </div>

            {/* Scholar Identity Card */}
            <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-surface-primary border border-border-default">
               <div className="h-11 w-11 rounded-full bg-surface-nested border border-border-strong overflow-hidden shrink-0 flex items-center justify-center">
                  {participant.image ? (
                     <Image
                        src={participant.image}
                        alt={participant.displayName}
                        width={44}
                        height={44}
                        className="h-full w-full object-cover"
                        unoptimized
                     />
                  ) : (
                     <UserIcon className="h-5 w-5 text-text-tertiary" />
                  )}
               </div>

               <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                     <span className="text-sm font-bold text-white truncate">
                        {participant.displayName}
                     </span>
                     {participant.teamName && (
                        <span
                           className="text-label px-2 py-0.5 rounded-full font-medium border shrink-0"
                           style={teamBadgeStyle}
                        >
                           {participant.teamName}
                        </span>
                     )}
                  </div>
                  <p className="text-xs text-text-tertiary truncate">
                     @{participant.username || "scholar"}
                  </p>
               </div>

               {participant.status && (
                  <span
                     className={`text-label px-2.5 py-1 rounded-full font-bold uppercase tracking-wider shrink-0 border ${
                        participant.status === "EXCUSED"
                           ? "bg-feedback-success/10 text-feedback-success border-feedback-success/30"
                           : participant.status === "PUNISHED"
                             ? "bg-feedback-error/10 text-feedback-error border-feedback-error/30"
                             : "bg-surface-nested/40 text-text-secondary border-border-strong"
                     }`}
                  >
                     {participant.status}
                  </span>
               )}
            </div>

            {/* Explainer Notice */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-feedback-info-bg/50 border border-feedback-info/20 text-xs text-feedback-info-text">
               <Info className="h-4 w-4 shrink-0 mt-0.5 text-feedback-info" />
               <p className="text-meta leading-relaxed">
                  Pardoning will mark this scholar as <strong>EXCUSED</strong>.
                  They will be relieved of forfeit obligations, their punishment
                  record will store your verified rationale, and the audit log
                  will preserve this action.
               </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
               <div>
                  <label
                     htmlFor="pardon-reason"
                     className="block text-xs font-semibold text-text-secondary mb-1.5"
                  >
                     Pardon / Excuse Rationale{" "}
                     <span className="text-feedback-error">*</span>
                  </label>
                  <Input
                     id="pardon-reason"
                     type="text"
                     placeholder="e.g. Medical emergency verified / timer crash"
                     value={reason}
                     onChange={(e) => setReason(e.target.value)}
                     disabled={isPending}
                     required
                     minLength={3}
                     className="h-10 rounded-xl bg-surface-primary border-border-default text-white text-xs placeholder:text-text-tertiary focus-visible:ring-1 focus-visible:ring-feedback-success focus-visible:border-feedback-success"
                  />
                  <span className="text-label text-text-tertiary mt-1 block">
                     Mandatory audit trail reason (minimum 3 characters).
                  </span>
               </div>

               {/* Feedback alerts */}
               {feedback && (
                  <div
                     className={`flex items-center gap-2 p-3 rounded-xl text-xs border ${
                        feedback.type === "success"
                           ? "bg-feedback-success/10 border-feedback-success/30 text-feedback-success-text"
                           : "bg-feedback-error/10 border-feedback-error/30 text-feedback-error-text"
                     }`}
                  >
                     {feedback.type === "success" ? (
                        <Check className="h-4 w-4 shrink-0 text-feedback-success" />
                     ) : (
                        <AlertTriangle className="h-4 w-4 shrink-0 text-feedback-error" />
                     )}
                     <span>{feedback.message}</span>
                  </div>
               )}

               {/* Actions */}
               <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border-default">
                  <Button
                     type="button"
                     variant="ghost"
                     onClick={onClose}
                     disabled={isPending}
                     className="h-10 px-4 rounded-xl text-xs font-semibold text-text-tertiary hover:text-white hover:bg-surface-elevated"
                  >
                     Cancel
                  </Button>

                  <Button
                     type="submit"
                     disabled={isPending || reason.trim().length < 3}
                     className="h-10 px-5 rounded-xl bg-feedback-success hover:bg-feedback-success text-black text-xs font-bold transition-all shadow-md gap-1.5"
                  >
                     {isPending ? (
                        <>
                           <Loader2 className="h-3.5 w-3.5 animate-spin" />
                           <span>Issuing Pardon...</span>
                        </>
                     ) : (
                        <>
                           <HeartHandshake className="h-3.5 w-3.5" />
                           <span>Grant Pardon</span>
                        </>
                     )}
                  </Button>
               </div>
            </form>
         </div>
      </div>
   );
}
