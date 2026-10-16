"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
   Wrench,
   X,
   Loader2,
   AlertCircle,
   CheckCircle2,
   Sparkles,
} from "lucide-react";
import { adminAdjustTrophiesAction } from "../api/trophy.actions";

interface AdminTrophyAdjustmentDialogProps {
   isOpen: boolean;
   onClose: () => void;
   targetUser?: {
      id: string;
      displayName: string;
      username: string;
      currentTrophies: number;
   } | null;
   onSuccess?: () => void;
}

export function AdminTrophyAdjustmentDialog({
   isOpen,
   onClose,
   targetUser,
   onSuccess,
}: AdminTrophyAdjustmentDialogProps) {
   const [amount, setAmount] = useState<number>(25);
   const [reason, setReason] = useState<string>("");
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [feedback, setFeedback] = useState<{
      type: "success" | "error";
      message: string;
   } | null>(null);

   if (!isOpen || !targetUser) return null;

   const current = targetUser.currentTrophies ?? 0;
   const newBalance = Math.max(0, current + amount);

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!reason.trim()) {
         setFeedback({
            type: "error",
            message: "A justification reason is required for auditing.",
         });
         return;
      }

      setIsSubmitting(true);
      setFeedback(null);

      try {
         const res = await adminAdjustTrophiesAction({
            userId: targetUser.id,
            amount,
            reason: reason.trim(),
         });

         if (res.ok) {
            setFeedback({
               type: "success",
               message: `Successfully adjusted trophies. New balance: ${res.data?.balanceAfter.toLocaleString()} 🏆`,
            });
            setTimeout(() => {
               onClose();
               onSuccess?.();
            }, 1200);
         } else {
            setFeedback({
               type: "error",
               message: res.message || "Failed to adjust trophies.",
            });
         }
      } catch (err) {
         setFeedback({
            type: "error",
            message: err instanceof Error ? err.message : "Network error.",
         });
      } finally {
         setIsSubmitting(false);
      }
   };

   return (
      <div
         className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
         role="dialog"
         aria-modal="true"
         aria-labelledby="admin-trophy-adjust-title"
      >
         <div className="relative w-full max-w-md rounded-3xl border border-obsidian-border bg-obsidian-card p-6 shadow-2xl backdrop-blur-xl">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-obsidian-borderSubtle">
               <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                     <Wrench className="h-4 w-4" />
                  </div>
                  <div>
                     <h3
                        id="admin-trophy-adjust-title"
                        className="text-sm font-bold text-obsidian-text font-display"
                     >
                        Admin Trophy Adjustment
                     </h3>
                     <p className="text-xs text-obsidian-textDim">
                        Explicit audited rating modification
                     </p>
                  </div>
               </div>
               <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-obsidian-textDim hover:text-obsidian-text hover:bg-obsidian-elevated transition-colors"
                  aria-label="Close dialog"
               >
                  <X className="h-4 w-4" />
               </button>
            </div>

            {/* Target User Info */}
            <div className="mt-4 rounded-xl border border-obsidian-borderSubtle bg-obsidian-elevated p-3.5 flex items-center justify-between text-xs">
               <div>
                  <span className="text-[11px] text-obsidian-textDim block">
                     Participant
                  </span>
                  <strong className="text-sm font-semibold text-white">
                     {targetUser.displayName}
                  </strong>
                  <span className="text-obsidian-textDim pl-1.5 font-mono">
                     (@{targetUser.username})
                  </span>
               </div>
               <div className="text-right">
                  <span className="text-[11px] text-obsidian-textDim block">
                     Current Trophies
                  </span>
                  <span className="font-mono text-sm font-bold text-amber-400">
                     🏆 {current.toLocaleString()}
                  </span>
               </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
               <div>
                  <label className="text-xs font-semibold text-obsidian-textMuted block mb-1.5">
                     Adjustment Amount (+ or -)
                  </label>
                  <div className="flex items-center gap-2">
                     <Input
                        type="number"
                        step={1}
                        value={amount}
                        onChange={(e) =>
                           setAmount(parseInt(e.target.value) || 0)
                        }
                        className="rounded-xl border-obsidian-border bg-obsidian-elevated font-mono text-sm text-white"
                        placeholder="e.g. 50 or -25"
                        required
                     />
                     <div className="shrink-0 flex items-center gap-1.5">
                        <Button
                           type="button"
                           variant="outline"
                           size="sm"
                           onClick={() => setAmount(25)}
                           className="text-xs h-9 px-2.5 border-obsidian-borderSubtle bg-obsidian-elevated"
                        >
                           +25
                        </Button>
                        <Button
                           type="button"
                           variant="outline"
                           size="sm"
                           onClick={() => setAmount(-15)}
                           className="text-xs h-9 px-2.5 border-obsidian-borderSubtle bg-obsidian-elevated"
                        >
                           -15
                        </Button>
                     </div>
                  </div>
                  <div className="mt-1.5 flex justify-between text-[11px] text-obsidian-textDim">
                     <span>Resulting balance:</span>
                     <span className="font-mono font-bold text-white">
                        {newBalance.toLocaleString()} 🏆
                     </span>
                  </div>
               </div>

               <div>
                  <label className="text-xs font-semibold text-obsidian-textMuted block mb-1.5">
                     Audit Reason (Required)
                  </label>
                  <Input
                     type="text"
                     value={reason}
                     onChange={(e) => setReason(e.target.value)}
                     placeholder="e.g. Tournament result correction / tiebreaker adjustment"
                     className="rounded-xl border-obsidian-border bg-obsidian-elevated text-xs text-white"
                     required
                     minLength={3}
                  />
                  <span className="text-[10px] text-obsidian-textDim mt-1 block">
                     This reason will be permanently recorded in the system
                     audit trail.
                  </span>
               </div>

               {feedback && (
                  <div
                     className={`flex items-center gap-2 rounded-xl p-3 text-xs ${
                        feedback.type === "success"
                           ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                           : "bg-rose-500/10 border border-rose-500/30 text-rose-400"
                     }`}
                  >
                     {feedback.type === "success" ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                     ) : (
                        <AlertCircle className="h-4 w-4 shrink-0" />
                     )}
                     <span>{feedback.message}</span>
                  </div>
               )}

               <div className="flex items-center justify-end gap-2 pt-2 border-t border-obsidian-borderSubtle">
                  <Button
                     type="button"
                     variant="outline"
                     size="sm"
                     onClick={onClose}
                     disabled={isSubmitting}
                     className="rounded-xl text-xs border-obsidian-borderSubtle bg-obsidian-elevated text-obsidian-textMuted"
                  >
                     Cancel
                  </Button>
                  <Button
                     type="submit"
                     variant="gold"
                     size="sm"
                     disabled={isSubmitting || amount === 0 || !reason.trim()}
                     className="rounded-xl text-xs font-bold gap-1.5"
                  >
                     {isSubmitting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                     ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                     )}
                     Confirm Adjustment
                  </Button>
               </div>
            </form>
         </div>
      </div>
   );
}
