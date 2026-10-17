"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2Icon, Loader2Icon, XIcon } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";

import {
   consistencyOptions,
   soloPunishmentOptions,
   soloStyleOptions,
   submitChallengeFeedbackSchema,
   trackingPreferenceOptions,
   workSchoolHoursOptions,
   type SubmitChallengeFeedbackInput,
} from "@/features/wrapped/domain/challenge-feedback.schema";
import { submitChallengeFeedbackAction } from "@/features/wrapped/api/wrapped.actions";
import { writeWrappedLocalState } from "@/features/wrapped/presentation/wrapped-storage";

export interface ChallengeFeedbackDialogProps {
   isOpen: boolean;
   challengeId: string;
   challengeTitle: string;
   onClose: () => void;
   onSuccess?: () => void;
}

export function ChallengeFeedbackDialog({
   isOpen,
   challengeId,
   challengeTitle,
   onClose,
   onSuccess,
}: ChallengeFeedbackDialogProps) {
   const [isPending, startTransition] = useTransition();
   const [isSubmitted, setIsSubmitted] = useState(false);
   const [errorMessage, setErrorMessage] = useState<string | null>(null);

   // Form states
   const [consistency, setConsistency] = useState<string>("");
   const [fairnessRating, setFairnessRating] = useState<number>(0);
   const [trackingPreference, setTrackingPreference] = useState<string>("");
   const [teamBattleFeedback, setTeamBattleFeedback] = useState<string>("");
   const [workSchoolHours, setWorkSchoolHours] = useState<string>("");
   const [soloStyle, setSoloStyle] = useState<string>("");
   const [soloPunishment, setSoloPunishment] = useState<string>("");
   const [soloIdeas, setSoloIdeas] = useState<string>("");

   const dialogRef = useRef<HTMLDivElement>(null);

   // Handle Esc key
   useEffect(() => {
      if (!isOpen) return;

      const handleKeyDown = (e: KeyboardEvent) => {
         if (e.key === "Escape" && !isPending) {
            onClose();
         }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
   }, [isOpen, isPending, onClose]);

   const handleSubmit = useCallback(
      (e: React.FormEvent) => {
         e.preventDefault();
         setErrorMessage(null);

         const rawPayload = {
            challengeId,
            consistency,
            fairnessRating,
            trackingPreference,
            teamBattleFeedback: teamBattleFeedback.trim(),
            workSchoolHours,
            soloStyle,
            soloPunishment,
            soloIdeas: soloIdeas.trim(),
         };

         const parsed = submitChallengeFeedbackSchema.safeParse(rawPayload);
         if (!parsed.success) {
            const firstError =
               parsed.error.issues[0]?.message ??
               "Please answer all required questions.";
            setErrorMessage(firstError);
            return;
         }

         startTransition(async () => {
            const result = await submitChallengeFeedbackAction(
               parsed.data as SubmitChallengeFeedbackInput
            );

            if (result.ok) {
               writeWrappedLocalState(challengeId, { feedback: true });
               setIsSubmitted(true);
               if (onSuccess) {
                  onSuccess();
               }
            } else {
               setErrorMessage(
                  result.message ||
                     "Failed to submit feedback. Please try again."
               );
            }
         });
      },
      [
         challengeId,
         consistency,
         fairnessRating,
         trackingPreference,
         teamBattleFeedback,
         workSchoolHours,
         soloStyle,
         soloPunishment,
         soloIdeas,
         onSuccess,
      ]
   );

   if (!isOpen) {
      return null;
   }

   return (
      <div
         className="fixed inset-0 z-[70] grid place-items-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-150"
         role="dialog"
         aria-modal="true"
         aria-labelledby="feedback-dialog-title"
      >
         <div
            ref={dialogRef}
            className="relative w-full max-w-[620px] max-h-[min(90dvh,820px)] flex flex-col rounded-2xl sm:rounded-3xl bg-[#141414] border border-[#292929] text-[#f4f3f6] shadow-2xl my-auto animate-in zoom-in-95 duration-150"
         >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#292929] shrink-0">
               <div>
                  <h2
                     id="feedback-dialog-title"
                     className="font-display font-bold text-lg sm:text-xl text-[#f4f3f6] m-0 tracking-tight"
                  >
                     Challenge Feedback
                  </h2>
                  <p className="font-sans text-xs text-[#868686] mt-1 m-0">
                     {challengeTitle} · Help shape upcoming events
                  </p>
               </div>
               <button
                  type="button"
                  onClick={onClose}
                  disabled={isPending}
                  className="w-8 h-8 rounded-lg border border-[#292929] bg-[#1c1c1c] text-[#868686] hover:text-[#f4f3f6] hover:border-[#434343] inline-flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Close dialog"
               >
                  <XIcon className="w-4 h-4" />
               </button>
            </div>

            {/* Content */}
            {isSubmitted ? (
               <div className="p-8 text-center flex flex-col items-center justify-center gap-4 my-auto">
                  <div className="w-14 h-14 rounded-2xl bg-[#144520] border border-[#22c55e]/40 text-[#22c55e] grid place-items-center shadow-lg">
                     <CheckCircle2Icon className="w-8 h-8" />
                  </div>
                  <h3 className="font-display font-extrabold text-2xl text-[#f4f3f6] m-0">
                     Thank You for Your Feedback!
                  </h3>
                  <p className="font-sans text-sm text-[#868686] max-w-[380px] m-0 leading-relaxed">
                     Your answers have been forwarded directly to the hosts on
                     Discord. Your input is instrumental in shaping the next
                     challenge.
                  </p>
                  <button
                     type="button"
                     onClick={onClose}
                     className="mt-4 px-6 py-2.5 rounded-xl bg-[#22c55e] text-[#0d0d0d] font-bold text-sm cursor-pointer hover:bg-[#16a34a] transition-all shadow-md"
                  >
                     Done
                  </button>
               </div>
            ) : (
               <form
                  onSubmit={handleSubmit}
                  className="flex flex-col flex-1 min-h-0"
               >
                  <div className="overflow-y-auto px-6 py-6 flex flex-col gap-6 flex-1">
                     {errorMessage && (
                        <div
                           role="alert"
                           className="p-3.5 rounded-xl bg-[#401010]/80 border border-[#ef4444]/40 text-[#ff5757] text-xs font-semibold"
                        >
                           {errorMessage}
                        </div>
                     )}

                     {/* Q1: Consistency */}
                     <div className="flex flex-col gap-2.5">
                        <label className="font-sans text-sm font-semibold text-[#f4f3f6]">
                           1. Did the Team Battles help improve your study
                           consistency?{" "}
                           <span className="text-[#22c55e]">*</span>
                        </label>
                        <div className="grid gap-2">
                           {consistencyOptions.map((option) => {
                              const selected = consistency === option;
                              return (
                                 <button
                                    type="button"
                                    key={option}
                                    onClick={() => setConsistency(option)}
                                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-left text-xs font-medium transition-all cursor-pointer ${
                                       selected
                                          ? "bg-[#144520]/30 border-[#22c55e] text-[#f4f3f6]"
                                          : "bg-[#1c1c1c] border-[#292929] text-[#d1d1d1] hover:border-[#434343] hover:text-[#f4f3f6]"
                                    }`}
                                 >
                                    <span
                                       className={`w-4 h-4 rounded-full border grid place-items-center shrink-0 ${
                                          selected
                                             ? "border-[#22c55e] bg-[#22c55e]"
                                             : "border-[#434343] bg-transparent"
                                       }`}
                                    >
                                       {selected && (
                                          <span className="w-1.5 h-1.5 rounded-full bg-[#0d0d0d]" />
                                       )}
                                    </span>
                                    <span>{option}</span>
                                 </button>
                              );
                           })}
                        </div>
                     </div>

                     {/* Q2: Fairness Rating */}
                     <div className="flex flex-col gap-2.5">
                        <label className="font-sans text-sm font-semibold text-[#f4f3f6]">
                           2. How would you rate the fairness of the previous
                           Team Battles?{" "}
                           <span className="text-[#22c55e]">*</span>
                        </label>
                        <div className="grid grid-cols-5 gap-2">
                           {[1, 2, 3, 4, 5].map((score) => {
                              const selected = fairnessRating === score;
                              return (
                                 <button
                                    type="button"
                                    key={score}
                                    onClick={() => setFairnessRating(score)}
                                    className={`h-11 rounded-xl border font-sans font-bold text-sm transition-all cursor-pointer ${
                                       selected
                                          ? "bg-[#22c55e] border-[#22c55e] text-[#0d0d0d] shadow-sm"
                                          : "bg-[#1c1c1c] border-[#292929] text-[#d1d1d1] hover:border-[#434343] hover:text-[#f4f3f6]"
                                    }`}
                                 >
                                    {score}
                                 </button>
                              );
                           })}
                        </div>
                        <div className="flex justify-between px-1 font-sans text-[11px] text-[#868686] font-medium">
                           <span>1 · Unfair</span>
                           <span>5 · Very Fair</span>
                        </div>
                     </div>

                     {/* Q3: Tracking Method */}
                     <div className="flex flex-col gap-2.5">
                        <label className="font-sans text-sm font-semibold text-[#f4f3f6]">
                           3. Which tracking method do you prefer for future
                           challenges? <span className="text-[#22c55e]">*</span>
                        </label>
                        <div className="grid gap-2">
                           {trackingPreferenceOptions.map((option) => {
                              const selected = trackingPreference === option;
                              return (
                                 <button
                                    type="button"
                                    key={option}
                                    onClick={() =>
                                       setTrackingPreference(option)
                                    }
                                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-left text-xs font-medium transition-all cursor-pointer ${
                                       selected
                                          ? "bg-[#144520]/30 border-[#22c55e] text-[#f4f3f6]"
                                          : "bg-[#1c1c1c] border-[#292929] text-[#d1d1d1] hover:border-[#434343] hover:text-[#f4f3f6]"
                                    }`}
                                 >
                                    <span
                                       className={`w-4 h-4 rounded-full border grid place-items-center shrink-0 ${
                                          selected
                                             ? "border-[#22c55e] bg-[#22c55e]"
                                             : "border-[#434343] bg-transparent"
                                       }`}
                                    >
                                       {selected && (
                                          <span className="w-1.5 h-1.5 rounded-full bg-[#0d0d0d]" />
                                       )}
                                    </span>
                                    <span>{option}</span>
                                 </button>
                              );
                           })}
                        </div>
                     </div>

                     {/* Q4: Suggestions / Complaints */}
                     <div className="flex flex-col gap-2">
                        <label className="font-sans text-sm font-semibold text-[#f4f3f6]">
                           4. Suggestions to improve Team Battles or any
                           complaints?
                        </label>
                        <Textarea
                           rows={3}
                           value={teamBattleFeedback}
                           onChange={(e) =>
                              setTeamBattleFeedback(e.target.value)
                           }
                           placeholder="Share your thoughts on balance, rosters, pacing, etc..."
                           maxLength={2000}
                           className="rounded-xl bg-[#1c1c1c] border-[#292929] text-xs text-[#f4f3f6] placeholder:text-[#868686]/70 focus:border-[#22c55e] focus:bg-[#1c1c1c] resize-none"
                        />
                     </div>

                     {/* Q5: Work / School hours */}
                     <div className="flex flex-col gap-2.5">
                        <label className="font-sans text-sm font-semibold text-[#f4f3f6]">
                           5. Should we adjust targets to account for work or
                           school hours?{" "}
                           <span className="text-[#22c55e]">*</span>
                        </label>
                        <div className="grid gap-2">
                           {workSchoolHoursOptions.map((option) => {
                              const selected = workSchoolHours === option;
                              return (
                                 <button
                                    type="button"
                                    key={option}
                                    onClick={() => setWorkSchoolHours(option)}
                                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-left text-xs font-medium transition-all cursor-pointer ${
                                       selected
                                          ? "bg-[#144520]/40 border-[#22c55e] text-[#f4f3f6]"
                                          : "bg-[#1c1c1c] border-[#292929] text-[#d1d1d1] hover:border-[#434343] hover:text-[#f4f3f6]"
                                    }`}
                                 >
                                    <span
                                       className={`w-4 h-4 rounded-full border grid place-items-center shrink-0 ${
                                          selected
                                             ? "border-[#22c55e] bg-[#22c55e]"
                                             : "border-[#434343] bg-transparent"
                                       }`}
                                    >
                                       {selected && (
                                          <span className="w-1.5 h-1.5 rounded-full bg-[#0d0d0d]" />
                                       )}
                                    </span>
                                    <span>{option}</span>
                                 </button>
                              );
                           })}
                        </div>
                     </div>

                     {/* Q6: Solo operating style */}
                     <div className="flex flex-col gap-2.5">
                        <label className="font-sans text-sm font-semibold text-[#f4f3f6]">
                           6. How would you prefer the Solo Challenge to
                           operate? <span className="text-[#22c55e]">*</span>
                        </label>
                        <div className="grid gap-2">
                           {soloStyleOptions.map((option) => {
                              const selected = soloStyle === option;
                              return (
                                 <button
                                    type="button"
                                    key={option}
                                    onClick={() => setSoloStyle(option)}
                                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-left text-xs font-medium transition-all cursor-pointer ${
                                       selected
                                          ? "bg-[#144520]/40 border-[#22c55e] text-[#f4f3f6]"
                                          : "bg-[#1c1c1c] border-[#292929] text-[#d1d1d1] hover:border-[#434343] hover:text-[#f4f3f6]"
                                    }`}
                                 >
                                    <span
                                       className={`w-4 h-4 rounded-full border grid place-items-center shrink-0 ${
                                          selected
                                             ? "border-[#22c55e] bg-[#22c55e]"
                                             : "border-[#434343] bg-transparent"
                                       }`}
                                    >
                                       {selected && (
                                          <span className="w-1.5 h-1.5 rounded-full bg-[#0d0d0d]" />
                                       )}
                                    </span>
                                    <span>{option}</span>
                                 </button>
                              );
                           })}
                        </div>
                     </div>

                     {/* Q7: Punishment PFP System */}
                     <div className="flex flex-col gap-2.5">
                        <label className="font-sans text-sm font-semibold text-[#f4f3f6]">
                           7. Should we keep the punishment PFP system for the
                           Solo Challenge?{" "}
                           <span className="text-[#22c55e]">*</span>
                        </label>
                        <div className="grid gap-2">
                           {soloPunishmentOptions.map((option) => {
                              const selected = soloPunishment === option;
                              return (
                                 <button
                                    type="button"
                                    key={option}
                                    onClick={() => setSoloPunishment(option)}
                                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-left text-xs font-medium transition-all cursor-pointer ${
                                       selected
                                          ? "bg-[#144520]/40 border-[#22c55e] text-[#f4f3f6]"
                                          : "bg-[#1c1c1c] border-[#292929] text-[#d1d1d1] hover:border-[#434343] hover:text-[#f4f3f6]"
                                    }`}
                                 >
                                    <span
                                       className={`w-4 h-4 rounded-full border grid place-items-center shrink-0 ${
                                          selected
                                             ? "border-[#22c55e] bg-[#22c55e]"
                                             : "border-[#434343] bg-transparent"
                                       }`}
                                    >
                                       {selected && (
                                          <span className="w-1.5 h-1.5 rounded-full bg-[#0d0d0d]" />
                                       )}
                                    </span>
                                    <span>{option}</span>
                                 </button>
                              );
                           })}
                        </div>
                     </div>

                     {/* Q8: Ideas & Thoughts */}
                     <div className="flex flex-col gap-2">
                        <label className="font-sans text-sm font-semibold text-[#f4f3f6]">
                           8. Any other ideas or thoughts for the upcoming Solo
                           Challenge?
                        </label>
                        <Textarea
                           rows={3}
                           value={soloIdeas}
                           onChange={(e) => setSoloIdeas(e.target.value)}
                           placeholder="Rules, duration, rewards, formats, features..."
                           maxLength={2000}
                           className="rounded-xl bg-[#1c1c1c] border-[#292929] text-xs text-[#f4f3f6] placeholder:text-[#868686]/70 focus:border-[#22c55e] focus:bg-[#1c1c1c] resize-none"
                        />
                     </div>
                  </div>

                  {/* Footer actions */}
                  <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#292929] bg-[#141414] shrink-0 rounded-b-2xl sm:rounded-b-3xl">
                     <button
                        type="button"
                        onClick={onClose}
                        disabled={isPending}
                        className="px-4 py-2 rounded-xl border border-[#292929] bg-[#1c1c1c] text-[#868686] hover:text-[#f4f3f6] hover:border-[#434343] font-sans font-medium text-xs transition-colors cursor-pointer"
                     >
                        Cancel
                     </button>
                     <button
                        type="submit"
                        disabled={isPending}
                        className="px-5 py-2 rounded-xl bg-[#22c55e] text-[#0d0d0d] font-sans font-bold text-xs hover:bg-[#16a34a] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2 shadow-sm"
                     >
                        {isPending && (
                           <Loader2Icon className="w-3.5 h-3.5 animate-spin" />
                        )}
                        <span>Submit Feedback</span>
                     </button>
                  </div>
               </form>
            )}
         </div>
      </div>
   );
}
