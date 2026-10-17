"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import {
   AlertCircle,
   Bug,
   CheckCircle2,
   Loader2,
   Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getLogRocketSessionURL } from "@/core/observability/logrocket";
import type { FeedbackType } from "@/features/feedback/domain/feedback.types";

interface FeedbackFormProps {
   onSuccess?: (code: string) => void;
   onCancel?: () => void;
}

export function FeedbackForm({ onSuccess, onCancel }: FeedbackFormProps) {
   const pathname = usePathname();
   const [type, setType] = useState<FeedbackType>("bug");
   const [title, setTitle] = useState("");
   const [description, setDescription] = useState("");
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [errorMessage, setErrorMessage] = useState<string | null>(null);
   const [submittedCode, setSubmittedCode] = useState<string | null>(null);

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (isSubmitting) return;

      // Client-side quick check
      if (title.trim().length < 3) {
         setErrorMessage("Title must be at least 3 characters.");
         return;
      }
      if (description.trim().length < 10) {
         setErrorMessage("Description must be at least 10 characters.");
         return;
      }

      setIsSubmitting(true);
      setErrorMessage(null);

      try {
         // Phase 2: If reporting a bug, try capturing the LogRocket session URL
         let logrocketSessionId: string | null = null;
         if (type === "bug") {
            try {
               logrocketSessionId = await getLogRocketSessionURL();
            } catch {
               // LogRocket fetch is non-blocking
            }
         }

         const res = await fetch("/api/feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
               type,
               title: title.trim(),
               description: description.trim(),
               url: pathname || window.location.pathname || "/",
               logrocketSessionId,
            }),
         });

         const data = await res.json();

         if (!res.ok || !data.success) {
            throw new Error(data.error || "Failed to submit feedback.");
         }

         const code = data.data?.code || "FB-OK";
         setSubmittedCode(code);
         if (onSuccess) {
            onSuccess(code);
         }
      } catch (err) {
         const msg =
            err instanceof Error ? err.message : "Something went wrong.";
         setErrorMessage(msg);
      } finally {
         setIsSubmitting(false);
      }
   };

   if (submittedCode) {
      return (
         <div className="py-8 text-center flex flex-col items-center justify-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
               <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="space-y-1">
               <h3 className="text-base font-semibold text-white">
                  Feedback Submitted!
               </h3>
               <p className="text-sm text-zinc-400">
                  Thank you for helping us improve HoldMeToIt.
               </p>
            </div>
         </div>
      );
   }

   return (
      <form onSubmit={handleSubmit} className="space-y-4">
         {/* Type Selector Tabs */}
         <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
               Feedback Type
            </label>
            <div className="grid grid-cols-2 gap-2">
               <button
                  type="button"
                  onClick={() => setType("bug")}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-sm font-medium transition-all ${
                     type === "bug"
                        ? "bg-rose-500/15 border-rose-500/40 text-rose-300 shadow-sm"
                        : "bg-[#1f1e24] border-[#2c2b33] text-zinc-400 hover:text-zinc-200 hover:bg-[#25242c]"
                  }`}
               >
                  <Bug className="h-4 w-4" />
                  <span>Bug Report</span>
               </button>

               <button
                  type="button"
                  onClick={() => setType("enhancement")}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-sm font-medium transition-all ${
                     type === "enhancement"
                        ? "bg-violet-500/15 border-violet-500/40 text-violet-300 shadow-sm"
                        : "bg-[#1f1e24] border-[#2c2b33] text-zinc-400 hover:text-zinc-200 hover:bg-[#25242c]"
                  }`}
               >
                  <Sparkles className="h-4 w-4" />
                  <span>Suggestion</span>
               </button>
            </div>
         </div>

         {/* Title Input */}
         <div className="space-y-1.5">
            <label
               htmlFor="feedback-title"
               className="text-xs font-medium text-zinc-400 uppercase tracking-wider"
            >
               Title
            </label>
            <Input
               id="feedback-title"
               type="text"
               value={title}
               onChange={(e) => setTitle(e.target.value)}
               placeholder={
                  type === "bug"
                     ? "e.g., Submit button doesn't work on mobile"
                     : "e.g., Add dark mode toggle or sound effects"
               }
               maxLength={120}
               required
               className="h-11 min-h-0 rounded-xl bg-[#1a1920] border-[#2e2d36] text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-400 focus:bg-[#1a1920]"
            />
         </div>

         {/* Description Textarea */}
         <div className="space-y-1.5">
            <label
               htmlFor="feedback-description"
               className="text-xs font-medium text-zinc-400 uppercase tracking-wider"
            >
               {type === "bug"
                  ? "What happened?"
                  : "What would you like to see?"}
            </label>
            <Textarea
               id="feedback-description"
               value={description}
               onChange={(e) => setDescription(e.target.value)}
               placeholder={
                  type === "bug"
                     ? "Describe the issue and steps to reproduce..."
                     : "Describe your suggestion and why it would be helpful..."
               }
               rows={4}
               maxLength={2000}
               required
               className="rounded-xl bg-[#1a1920] border-[#2e2d36] text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-400 focus:bg-[#1a1920] resize-none"
            />
         </div>

         {/* Error message */}
         {errorMessage && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
               <AlertCircle className="h-4 w-4 shrink-0" />
               <span>{errorMessage}</span>
            </div>
         )}

         {/* Action Buttons */}
         <div className="flex items-center justify-end gap-2 pt-2">
            {onCancel && (
               <button
                  type="button"
                  onClick={onCancel}
                  disabled={isSubmitting}
                  className="px-3.5 py-2 rounded-xl text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
               >
                  Cancel
               </button>
            )}

            <button
               type="submit"
               disabled={isSubmitting}
               className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-sm font-medium hover:bg-zinc-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
               {isSubmitting ? (
                  <>
                     <Loader2 className="h-4 w-4 animate-spin" />
                     <span>Submitting...</span>
                  </>
               ) : (
                  <span>Submit Feedback</span>
               )}
            </button>
         </div>
      </form>
   );
}
