"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
      <Dialog
         open={isOpen}
         onOpenChange={(open) => {
            if (!open) onClose();
         }}
      >
         <DialogContent className="max-w-md rounded-3xl border-border-default bg-surface-primary p-6">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
               <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                     <Wrench className="h-4 w-4" />
                  </div>
                  <div>
                     <h3
                        id="admin-trophy-adjust-title"
                        className="text-sm font-bold text-text-primary font-display"
                     >
                        Admin Trophy Adjustment
                     </h3>
                     <p className="text-xs text-text-tertiary">
                        Explicit audited rating modification
                     </p>
                  </div>
               </div>
               <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-text-tertiary hover:text-text-primary hover:bg-surface-elevated transition-colors"
                  aria-label="Close dialog"
               >
                  <X className="h-4 w-4" />
               </button>
            </div>

            {/* Target User Info */}
            <div className="mt-4 rounded-xl border border-border-subtle bg-surface-elevated p-3.5 flex items-center justify-between text-xs">
               <div>
                  <span className="text-meta text-text-tertiary block">
                     Participant
                  </span>
                  <strong className="text-sm font-semibold text-white">
                     {targetUser.displayName}
                  </strong>
                  <span className="text-text-tertiary pl-1.5 font-mono">
                     (@{targetUser.username})
                  </span>
               </div>
               <div className="text-right">
                  <span className="text-meta text-text-tertiary block">
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
                  <Label
                     htmlFor="trophy-adjustment-amount"
                     className="text-xs font-semibold text-text-secondary block mb-1.5"
                  >
                     Adjustment Amount (+ or -)
                  </Label>
                  <div className="flex items-center gap-2">
                     <Input
                        id="trophy-adjustment-amount"
                        type="number"
                        step={1}
                        value={amount}
                        onChange={(e) =>
                           setAmount(parseInt(e.target.value) || 0)
                        }
                        className="rounded-xl border-border-default bg-surface-elevated font-mono text-sm text-white"
                        placeholder="e.g. 50 or -25"
                        required
                     />
                     <div className="shrink-0 flex items-center gap-1.5">
                        <Button
                           type="button"
                           variant="outline"
                           size="sm"
                           onClick={() => setAmount(25)}
                           className="text-xs h-9 px-2.5 border-border-subtle bg-surface-elevated"
                        >
                           +25
                        </Button>
                        <Button
                           type="button"
                           variant="outline"
                           size="sm"
                           onClick={() => setAmount(-15)}
                           className="text-xs h-9 px-2.5 border-border-subtle bg-surface-elevated"
                        >
                           -15
                        </Button>
                     </div>
                  </div>
                  <div className="mt-1.5 flex justify-between text-meta text-text-tertiary">
                     <span>Resulting balance:</span>
                     <span className="font-mono font-bold text-white">
                        {newBalance.toLocaleString()} 🏆
                     </span>
                  </div>
               </div>

               <div>
                  <Label
                     htmlFor="trophy-adjustment-reason"
                     className="text-xs font-semibold text-text-secondary block mb-1.5"
                  >
                     Audit Reason (Required)
                  </Label>
                  <Input
                     id="trophy-adjustment-reason"
                     type="text"
                     value={reason}
                     onChange={(e) => setReason(e.target.value)}
                     placeholder="e.g. Tournament result correction / tiebreaker adjustment"
                     className="rounded-xl border-border-default bg-surface-elevated text-xs text-white"
                     required
                     minLength={3}
                  />
                  <span className="text-label text-text-tertiary mt-1 block">
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

               <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
                  <Button
                     type="button"
                     variant="outline"
                     size="sm"
                     onClick={onClose}
                     disabled={isSubmitting}
                     className="rounded-xl text-xs border-border-subtle bg-surface-elevated text-text-secondary"
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
         </DialogContent>
      </Dialog>
   );
}
