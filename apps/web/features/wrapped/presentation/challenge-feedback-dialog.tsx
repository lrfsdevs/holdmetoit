"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2Icon, Loader2Icon, XIcon } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

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
      <Dialog
         open={isOpen}
         onOpenChange={(open) => {
            if (!open) onClose();
         }}
      >
         <DialogContent className="max-w-panel-md z-[70] flex flex-col rounded-2xl sm:rounded-3xl bg-surface-primary border-border-default text-text-primary">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-border-default shrink-0">
               <div>
                  <DialogTitle
                     id="feedback-dialog-title"
                     className="font-display font-bold text-lg sm:text-xl text-text-primary m-0 tracking-tight"
                  >
                     Challenge Feedback
                  </DialogTitle>
                  <p className="font-sans text-xs text-text-tertiary mt-1 m-0">
                     {challengeTitle} · Help shape upcoming events
                  </p>
               </div>
            </div>

            {/* Content */}
            {isSubmitted ? (
               <div className="p-8 text-center flex flex-col items-center justify-center gap-4 my-auto">
                  <div className="w-14 h-14 rounded-2xl bg-feedback-success-bg border border-feedback-success/40 text-feedback-success grid place-items-center shadow-lg">
                     <CheckCircle2Icon className="w-8 h-8" />
                  </div>
                  <h3 className="font-display font-extrabold text-2xl text-text-primary m-0">
                     Thank You for Your Feedback!
                  </h3>
                  <p className="font-sans text-sm text-text-tertiary max-w-[380px] m-0 leading-relaxed">
                     Your answers have been forwarded directly to the hosts on
                     Discord. Your input is instrumental in shaping the next
                     challenge.
                  </p>
                  <button
                     type="button"
                     onClick={onClose}
                     className="mt-4 px-6 py-2.5 rounded-xl bg-feedback-success text-text-inverse font-bold text-sm cursor-pointer hover:bg-feedback-success transition-all shadow-md"
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
                           className="p-3.5 rounded-xl bg-feedback-error-bg/80 border border-feedback-error/40 text-feedback-error-text text-xs font-semibold"
                        >
                           {errorMessage}
                        </div>
                     )}

                     {/* Q1: Consistency */}
                     <div className="flex flex-col gap-2.5">
                        <label className="font-sans text-sm font-semibold text-text-primary">
                           1. Did the Team Battles help improve your study
                           consistency?{" "}
                           <span className="text-feedback-success">*</span>
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
                                          ? "bg-feedback-success-bg/30 border-feedback-success text-text-primary"
                                          : "bg-surface-elevated border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary"
                                    }`}
                                 >
                                    <span
                                       className={`w-4 h-4 rounded-full border grid place-items-center shrink-0 ${
                                          selected
                                             ? "border-feedback-success bg-feedback-success"
                                             : "border-border-strong bg-transparent"
                                       }`}
                                    >
                                       {selected && (
                                          <span className="w-1.5 h-1.5 rounded-full bg-surface-page" />
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
                        <label className="font-sans text-sm font-semibold text-text-primary">
                           2. How would you rate the fairness of the previous
                           Team Battles?{" "}
                           <span className="text-feedback-success">*</span>
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
                                          ? "bg-feedback-success border-feedback-success text-text-inverse shadow-sm"
                                          : "bg-surface-elevated border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary"
                                    }`}
                                 >
                                    {score}
                                 </button>
                              );
                           })}
                        </div>
                        <div className="flex justify-between px-1 font-sans text-meta text-text-tertiary font-medium">
                           <span>1 · Unfair</span>
                           <span>5 · Very Fair</span>
                        </div>
                     </div>

                     {/* Q3: Tracking Method */}
                     <div className="flex flex-col gap-2.5">
                        <label className="font-sans text-sm font-semibold text-text-primary">
                           3. Which tracking method do you prefer for future
                           challenges?{" "}
                           <span className="text-feedback-success">*</span>
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
                                          ? "bg-feedback-success-bg/30 border-feedback-success text-text-primary"
                                          : "bg-surface-elevated border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary"
                                    }`}
                                 >
                                    <span
                                       className={`w-4 h-4 rounded-full border grid place-items-center shrink-0 ${
                                          selected
                                             ? "border-feedback-success bg-feedback-success"
                                             : "border-border-strong bg-transparent"
                                       }`}
                                    >
                                       {selected && (
                                          <span className="w-1.5 h-1.5 rounded-full bg-surface-page" />
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
                        <label className="font-sans text-sm font-semibold text-text-primary">
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
                           className="rounded-xl bg-surface-elevated border-border-default text-xs text-text-primary placeholder:text-text-tertiary/70 focus:border-feedback-success focus:bg-surface-elevated resize-none"
                        />
                     </div>

                     {/* Q5: Work / School hours */}
                     <div className="flex flex-col gap-2.5">
                        <label className="font-sans text-sm font-semibold text-text-primary">
                           5. Should we adjust targets to account for work or
                           school hours?{" "}
                           <span className="text-feedback-success">*</span>
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
                                          ? "bg-feedback-success-bg/40 border-feedback-success text-text-primary"
                                          : "bg-surface-elevated border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary"
                                    }`}
                                 >
                                    <span
                                       className={`w-4 h-4 rounded-full border grid place-items-center shrink-0 ${
                                          selected
                                             ? "border-feedback-success bg-feedback-success"
                                             : "border-border-strong bg-transparent"
                                       }`}
                                    >
                                       {selected && (
                                          <span className="w-1.5 h-1.5 rounded-full bg-surface-page" />
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
                        <label className="font-sans text-sm font-semibold text-text-primary">
                           6. How would you prefer the Solo Challenge to
                           operate?{" "}
                           <span className="text-feedback-success">*</span>
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
                                          ? "bg-feedback-success-bg/40 border-feedback-success text-text-primary"
                                          : "bg-surface-elevated border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary"
                                    }`}
                                 >
                                    <span
                                       className={`w-4 h-4 rounded-full border grid place-items-center shrink-0 ${
                                          selected
                                             ? "border-feedback-success bg-feedback-success"
                                             : "border-border-strong bg-transparent"
                                       }`}
                                    >
                                       {selected && (
                                          <span className="w-1.5 h-1.5 rounded-full bg-surface-page" />
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
                        <label className="font-sans text-sm font-semibold text-text-primary">
                           7. Should we keep the punishment PFP system for the
                           Solo Challenge?{" "}
                           <span className="text-feedback-success">*</span>
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
                                          ? "bg-feedback-success-bg/40 border-feedback-success text-text-primary"
                                          : "bg-surface-elevated border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary"
                                    }`}
                                 >
                                    <span
                                       className={`w-4 h-4 rounded-full border grid place-items-center shrink-0 ${
                                          selected
                                             ? "border-feedback-success bg-feedback-success"
                                             : "border-border-strong bg-transparent"
                                       }`}
                                    >
                                       {selected && (
                                          <span className="w-1.5 h-1.5 rounded-full bg-surface-page" />
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
                        <label className="font-sans text-sm font-semibold text-text-primary">
                           8. Any other ideas or thoughts for the upcoming Solo
                           Challenge?
                        </label>
                        <Textarea
                           rows={3}
                           value={soloIdeas}
                           onChange={(e) => setSoloIdeas(e.target.value)}
                           placeholder="Rules, duration, rewards, formats, features..."
                           maxLength={2000}
                           className="rounded-xl bg-surface-elevated border-border-default text-xs text-text-primary placeholder:text-text-tertiary/70 focus:border-feedback-success focus:bg-surface-elevated resize-none"
                        />
                     </div>
                  </div>

                  {/* Footer actions */}
                  <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-default bg-surface-primary shrink-0 rounded-b-2xl sm:rounded-b-3xl">
                     <button
                        type="button"
                        onClick={onClose}
                        disabled={isPending}
                        className="px-4 py-2 rounded-xl border border-border-default bg-surface-elevated text-text-tertiary hover:text-text-primary hover:border-border-strong font-sans font-medium text-xs transition-colors cursor-pointer"
                     >
                        Cancel
                     </button>
                     <button
                        type="submit"
                        disabled={isPending}
                        className="px-5 py-2 rounded-xl bg-feedback-success text-text-inverse font-sans font-bold text-xs hover:bg-feedback-success transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2 shadow-sm"
                     >
                        {isPending && (
                           <Loader2Icon className="w-3.5 h-3.5 animate-spin" />
                        )}
                        <span>Submit Feedback</span>
                     </button>
                  </div>
               </form>
            )}
         </DialogContent>
      </Dialog>
   );
}
