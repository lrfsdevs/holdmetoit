"use client";

import { useEffect, useRef } from "react";
import { MessageSquarePlus, X } from "lucide-react";
import { FeedbackForm } from "./feedback-form";

interface FeedbackDialogProps {
   isOpen: boolean;
   onClose: () => void;
}

export function FeedbackDialog({ isOpen, onClose }: FeedbackDialogProps) {
   const overlayRef = useRef<HTMLDivElement>(null);

   useEffect(() => {
      if (!isOpen) return;

      const handleKeyDown = (e: KeyboardEvent) => {
         if (e.key === "Escape") {
            onClose();
         }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
   }, [isOpen, onClose]);

   if (!isOpen) return null;

   return (
      <div
         ref={overlayRef}
         onClick={(e) => {
            if (e.target === overlayRef.current) {
               onClose();
            }
         }}
         className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
         role="dialog"
         aria-modal="true"
         aria-labelledby="feedback-dialog-title"
      >
         <div className="w-full max-w-md rounded-2xl bg-[#141318] border border-[#26252d] shadow-2xl p-5 md:p-6 text-zinc-100 animate-in zoom-in-95 duration-150 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#24232b] pb-3">
               <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-[#201f27] border border-[#2e2d38] flex items-center justify-center text-zinc-300">
                     <MessageSquarePlus className="h-4 w-4" />
                  </div>
                  <div>
                     <h2
                        id="feedback-dialog-title"
                        className="text-base font-semibold text-white tracking-tight"
                     >
                        Send Feedback
                     </h2>
                     <p className="text-xs text-zinc-400">
                        Report a bug or suggest an enhancement
                     </p>
                  </div>
               </div>

               <button
                  type="button"
                  onClick={onClose}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-[#201f27] transition-colors"
                  aria-label="Close dialog"
               >
                  <X className="h-4 w-4" />
               </button>
            </div>

            {/* Content Form */}
            <FeedbackForm onCancel={onClose} />
         </div>
      </div>
   );
}
