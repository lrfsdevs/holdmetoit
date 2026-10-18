"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
   captureLogRocketException,
   trackLogRocketEvent,
} from "@/core/observability/logrocket";
import { enrollInChallengeAction } from "@/features/challenges/api/enroll-participant.actions";

export interface EnrollmentModalProps {
   challengeId: string;
   challengeTitle: string;
   format?: "TEAM_VS_TEAM" | "DUOS" | "SOLOS";
   teams?: Array<{
      id: string;
      name: string;
      color: string | null;
      iconEmoji: string | null;
   }>;
   isOpen?: boolean;
   onOpenChange?: (open: boolean) => void;
   showTrigger?: boolean;
   onSuccess?: () => void;
}

export type JoinChallengeModalProps = EnrollmentModalProps;

/** Renders the participant enrollment and target declaration modal. */
export function EnrollmentModal({
   challengeId,
   challengeTitle,
   isOpen: controlledIsOpen,
   onOpenChange,
   showTrigger = true,
   onSuccess,
}: EnrollmentModalProps) {
   const [internalIsOpen, setInternalIsOpen] = useState(false);
   const isOpen =
      controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
   const setIsOpen = (open: boolean) => {
      setInternalIsOpen(open);
      onOpenChange?.(open);
   };
   const [hours, setHours] = useState<string>("35");
   const [leaveDays, setLeaveDays] = useState<string>("");
   const [errorMsg, setErrorMsg] = useState<string | null>(null);
   const [isPending, startTransition] = useTransition();

   const handleEnroll = (e: React.FormEvent) => {
      e.preventDefault();
      const h = parseInt(hours, 10);
      if (isNaN(h) || h < 1 || h > 105) {
         setErrorMsg("Please enter a target between 1 and 105 hours.");
         return;
      }

      const l = leaveDays.trim() !== "" ? parseInt(leaveDays, 10) : 0;
      if (isNaN(l) || l < 0 || l > 30) {
         setErrorMsg("Please enter a valid number of leave days (0–30).");
         return;
      }

      setErrorMsg(null);
      startTransition(async () => {
         try {
            const res = await enrollInChallengeAction({
               challengeId,
               teamId: undefined,
               hours: h,
               minutes: 0,
               seconds: 0,
               leaveDays: l,
            });

            if (!res.ok) {
               setErrorMsg(res.message);
               return;
            }

            trackLogRocketEvent("ChallengeEnrolled", {
               challengeId,
               hours: h,
               leaveDays: l,
            });
            setIsOpen(false);
            onSuccess?.();
         } catch (error) {
            captureLogRocketException(error, {
               tags: { action: "enroll-challenge" },
               extra: { challengeId },
            });
            setErrorMsg(
               "Could not enroll in this challenge. Please try again."
            );
         }
      });
   };

   return (
      <>
         {showTrigger && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-border-default bg-surface-primary p-4 text-xs shadow-lg">
               <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-nested text-white border border-border-strong">
                     <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                     <p className="font-bold text-sm text-white">
                        Join {challengeTitle}
                     </p>
                     <p className="text-meta text-text-tertiary">
                        Declare your target study hours and expected leaves
                        before kickoff.
                     </p>
                  </div>
               </div>

               <Button
                  onClick={() => setIsOpen(true)}
                  className="min-h-[40px] px-5 font-bold bg-white text-text-inverse hover:bg-white/90 rounded-full"
               >
                  <span>Enroll Now</span>
               </Button>
            </div>
         )}

         <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="max-w-sm sm:max-w-md rounded-[28px] border-border-strong bg-surface-nested p-7 sm:p-8 space-y-6">
               <DialogTitle className="sr-only">
                  Enroll in {challengeTitle}
               </DialogTitle>
               <form onSubmit={handleEnroll} className="space-y-6">
                  <div className="space-y-3">
                     <label className="block text-xl font-bold text-white tracking-tight">
                        So how many hours can you put in?
                     </label>
                     <Input
                        type="number"
                        min={1}
                        max={100}
                        value={hours}
                        onChange={(e) => setHours(e.target.value)}
                        placeholder="Enter hours..."
                        required
                        className="h-12 min-h-0 rounded-full border-border-strong bg-input-bg px-5 text-white placeholder:text-text-tertiary text-sm focus:border-white focus:bg-input-bg"
                     />
                  </div>

                  <div className="space-y-3">
                     <label className="block text-xl font-bold text-white tracking-tight">
                        How many leaves you might take
                     </label>
                     <Input
                        type="number"
                        min={0}
                        max={3}
                        value={leaveDays}
                        onChange={(e) => setLeaveDays(e.target.value)}
                        placeholder="Enter days..."
                        className="h-12 min-h-0 rounded-full border-border-strong bg-input-bg px-5 text-white placeholder:text-text-tertiary text-sm focus:border-white focus:bg-input-bg"
                     />
                  </div>

                  {errorMsg && (
                     <div className="rounded-xl border border-feedback-error/40 bg-feedback-error-bg/30 p-3 text-xs text-feedback-error-text">
                        {errorMsg}
                     </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                     <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        disabled={isPending}
                        className="h-11 px-8 rounded-full bg-input-bg hover:bg-input-bg text-sm font-semibold text-white transition-colors"
                     >
                        Cancel
                     </button>
                     <button
                        type="submit"
                        disabled={isPending}
                        className="h-11 px-8 rounded-full bg-white hover:bg-white/90 text-sm font-bold text-black transition-colors disabled:opacity-50"
                     >
                        {isPending ? "Submitting..." : "Submit"}
                     </button>
                  </div>
               </form>
            </DialogContent>
         </Dialog>
      </>
   );
}

export const JoinChallengeModal = EnrollmentModal;
