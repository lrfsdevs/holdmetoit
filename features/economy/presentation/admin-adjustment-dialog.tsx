"use client";

import React, { useState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminAdjustBalanceAction } from "../api/wallet.actions";
import { ShieldAlert, Loader2, X } from "lucide-react";

export interface AdminAdjustmentDialogProps {
   isOpen: boolean;
   onClose: () => void;
   defaultUserId?: string;
   onSuccess?: () => void;
}

export function AdminAdjustmentDialog({
   isOpen,
   onClose,
   defaultUserId = "",
   onSuccess,
}: AdminAdjustmentDialogProps) {
   const [targetUserId, setTargetUserId] = useState(defaultUserId);
   const [amount, setAmount] = useState<string>("");
   const [reason, setReason] = useState<string>("");
   const [error, setError] = useState<string | null>(null);
   const [isPending, startTransition] = useTransition();

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

   if (!isOpen) return null;

   const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const parsedAmount = parseInt(amount, 10);
      if (isNaN(parsedAmount) || parsedAmount === 0) {
         setError("Please enter a non-zero whole coin amount.");
         return;
      }

      if (!targetUserId.trim()) {
         setError("Target user ID is required.");
         return;
      }

      if (reason.trim().length < 3) {
         setError("Audit reason must be at least 3 characters long.");
         return;
      }

      startTransition(async () => {
         const res = await adminAdjustBalanceAction({
            targetUserId: targetUserId.trim(),
            amount: parsedAmount,
            reason: reason.trim(),
         });

         if (res.ok) {
            onClose();
            setAmount("");
            setReason("");
            onSuccess?.();
         } else {
            setError(res.message);
         }
      });
   };

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
         <div className="relative w-full max-w-md rounded-2xl border border-[#292929] bg-[#141414] text-[#f4f3f6] p-6 shadow-2xl">
            <button
               type="button"
               onClick={onClose}
               disabled={isPending}
               className="absolute top-4 right-4 text-[#868686] hover:text-[#f4f3f6] transition-colors"
            >
               <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
               <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#e08a32]/30 bg-[#e08a32]/10 text-[#e08a32]">
                  <ShieldAlert className="h-5 w-5" />
               </div>
               <div>
                  <h3 className="text-base font-semibold text-[#f4f3f6]">
                     Administrative Balance Adjustment
                  </h3>
                  <p className="text-xs text-[#868686]">
                     Manually credit or debit coins for moderation or glitch
                     corrections.
                  </p>
               </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
               {error && (
                  <div className="rounded-xl border border-[#ef4444]/30 bg-[#ef4444]/10 p-3 text-xs text-[#ff5757]">
                     {error}
                  </div>
               )}

               <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#d1d1d1]">
                     Target User ID
                  </label>
                  <Input
                     value={targetUserId}
                     onChange={(e) => setTargetUserId(e.target.value)}
                     placeholder="e.g. usr_cl..."
                     disabled={isPending}
                     className="bg-[#1c1c1c] border-[#292929] text-xs h-9 text-[#f4f3f6]"
                  />
               </div>

               <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#d1d1d1]">
                     Amount (Positive to credit, Negative to debit)
                  </label>
                  <Input
                     type="number"
                     step="1"
                     value={amount}
                     onChange={(e) => setAmount(e.target.value)}
                     placeholder="e.g. 50 or -25"
                     disabled={isPending}
                     className="bg-[#1c1c1c] border-[#292929] text-xs h-9 text-[#f4f3f6] font-mono"
                  />
                  <p className="text-[11px] text-[#868686]">
                     Example: +50 adds 50 coins; -50 deducts 50 coins.
                  </p>
               </div>

               <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#d1d1d1]">
                     Audit Reason
                  </label>
                  <Input
                     value={reason}
                     onChange={(e) => setReason(e.target.value)}
                     placeholder="e.g. Compensation for crashed YPT sync"
                     disabled={isPending}
                     className="bg-[#1c1c1c] border-[#292929] text-xs h-9 text-[#f4f3f6]"
                  />
               </div>

               <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#242424]">
                  <Button
                     type="button"
                     variant="ghost"
                     size="sm"
                     onClick={onClose}
                     disabled={isPending}
                     className="text-xs text-[#868686] hover:text-[#f4f3f6]"
                  >
                     Cancel
                  </Button>
                  <Button
                     type="submit"
                     size="sm"
                     disabled={isPending}
                     className="bg-[#e08a32] hover:bg-[#c97420] text-black font-semibold text-xs h-9 px-4 rounded-xl"
                  >
                     {isPending ? (
                        <>
                           <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                           Applying...
                        </>
                     ) : (
                        "Commit Adjustment"
                     )}
                  </Button>
               </div>
            </form>
         </div>
      </div>
   );
}
