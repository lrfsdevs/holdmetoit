"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
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
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-[#262626] bg-[#141414] p-4 text-xs shadow-lg">
               <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#292929] text-[#ffffff] border border-[#333333]">
                     <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                     <p className="font-bold text-sm text-[#ffffff]">
                        Join {challengeTitle}
                     </p>
                     <p className="text-[11px] text-[#868686]">
                        Declare your target study hours and expected leaves
                        before kickoff.
                     </p>
                  </div>
               </div>

               <Button
                  onClick={() => setIsOpen(true)}
                  className="min-h-[40px] px-5 font-bold bg-[#ffffff] text-[#0d0d0d] hover:bg-[#e0e0e0] rounded-full"
               >
                  <span>Enroll Now</span>
               </Button>
            </div>
         )}

         {isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
               <div className="w-full max-w-sm sm:max-w-md rounded-[28px] border border-[#383838] bg-[#242424] p-7 sm:p-8 shadow-2xl space-y-6">
                  <form onSubmit={handleEnroll} className="space-y-6">
                     <div className="space-y-3">
                        <label className="block text-xl font-bold text-[#ffffff] tracking-tight">
                           So how many hours can you put in?
                        </label>
                        <input
                           type="number"
                           min={1}
                           max={100}
                           value={hours}
                           onChange={(e) => setHours(e.target.value)}
                           placeholder="Enter hours..."
                           required
                           className="w-full h-12 rounded-full border border-[#555555] bg-[#3a3a3a] px-5 text-[#ffffff] placeholder:text-[#888888] text-sm outline-none focus:border-[#ffffff] transition-colors"
                        />
                     </div>

                     <div className="space-y-3">
                        <label className="block text-xl font-bold text-[#ffffff] tracking-tight">
                           How many leaves you might take
                        </label>
                        <input
                           type="number"
                           min={0}
                           max={3}
                           value={leaveDays}
                           onChange={(e) => setLeaveDays(e.target.value)}
                           placeholder="Enter days..."
                           className="w-full h-12 rounded-full border border-[#555555] bg-[#3a3a3a] px-5 text-[#ffffff] placeholder:text-[#888888] text-sm outline-none focus:border-[#ffffff] transition-colors"
                        />
                     </div>

                     {errorMsg && (
                        <div className="rounded-xl border border-[#ef4444]/40 bg-[#401010]/30 p-3 text-xs text-[#ff5757]">
                           {errorMsg}
                        </div>
                     )}

                     <div className="flex items-center justify-between pt-2">
                        <button
                           type="button"
                           onClick={() => setIsOpen(false)}
                           disabled={isPending}
                           className="h-11 px-8 rounded-full bg-[#3d3d3d] hover:bg-[#4a4a4a] text-sm font-semibold text-[#ffffff] transition-colors"
                        >
                           Cancel
                        </button>
                        <button
                           type="submit"
                           disabled={isPending}
                           className="h-11 px-8 rounded-full bg-[#ffffff] hover:bg-[#e0e0e0] text-sm font-bold text-[#000000] transition-colors disabled:opacity-50"
                        >
                           {isPending ? "Submitting..." : "Submit"}
                        </button>
                     </div>
                  </form>
               </div>
            </div>
         )}
      </>
   );
}

export const JoinChallengeModal = EnrollmentModal;
