"use client";

import { MessageSquarePlus } from "lucide-react";
import { FeedbackForm } from "./feedback-form";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface FeedbackDialogProps {
   isOpen: boolean;
   onClose: () => void;
}

export function FeedbackDialog({ isOpen, onClose }: FeedbackDialogProps) {
   return (
      <Dialog
         open={isOpen}
         onOpenChange={(open) => {
            if (!open) onClose();
         }}
      >
         <DialogContent className="max-w-md rounded-2xl bg-surface-primary border-border-default p-5 md:p-6 text-zinc-100 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border-default pb-3">
               <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-surface-elevated border border-border-strong flex items-center justify-center text-zinc-300">
                     <MessageSquarePlus className="h-4 w-4" />
                  </div>
                  <div>
                     <DialogTitle
                        id="feedback-dialog-title"
                        className="text-base font-semibold text-white tracking-tight"
                     >
                        Send Feedback
                     </DialogTitle>
                     <p className="text-xs text-zinc-400">
                        Report a bug or suggest an enhancement
                     </p>
                  </div>
               </div>
            </div>

            {/* Content Form */}
            <FeedbackForm onCancel={onClose} />
         </DialogContent>
      </Dialog>
   );
}
