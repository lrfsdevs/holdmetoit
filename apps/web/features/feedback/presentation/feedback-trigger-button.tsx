"use client";

import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { FeedbackDialog } from "./feedback-dialog";

export function FeedbackTriggerButton() {
   const [isOpen, setIsOpen] = useState(false);

   return (
      <>
         <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 group flex items-center gap-2 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-full bg-surface-secondary/90 hover:bg-surface-nested border border-border-strong hover:border-border-strong text-zinc-300 hover:text-white shadow-xl backdrop-blur-md transition-all duration-200 active:scale-95 focus:outline-none focus:ring-2 focus:ring-zinc-500/30"
            aria-label="Send Feedback or Report Bug"
            title="Send Feedback"
         >
            <MessageSquarePlus className="h-4 w-4 text-zinc-400 group-hover:text-zinc-200 transition-colors" />
            <span className="text-xs font-medium tracking-wide hidden xs:inline sm:inline">
               Feedback
            </span>
         </button>

         <FeedbackDialog isOpen={isOpen} onClose={() => setIsOpen(false)} />
      </>
   );
}
