"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Renders the DevBoard recovery boundary and retry action. */
export default function DevBoardError({
   error,
   reset,
}: {
   error: Error & { digest?: string };
   reset: () => void;
}) {
   useEffect(() => {
      console.error("DevBoard runtime error:", error);
   }, [error]);

   return (
      <div className="rounded-2xl border border-red-950/60 bg-surface-primary p-12 text-center text-text-primary">
         <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-950/40 border border-red-900/50 text-red-400">
            <AlertTriangle className="h-6 w-6" />
         </div>
         <h2 className="mt-4 text-lg font-bold font-display">
            DevBoard Encountered an Error
         </h2>
         <p className="mt-2 text-xs text-text-tertiary max-w-md mx-auto text-wrap:balance">
            {error.message ||
               "An unexpected error occurred while loading feature flags."}
         </p>
         <div className="mt-6 flex justify-center gap-3">
            <Button
               onClick={() => reset()}
               className="bg-surface-nested hover:bg-surface-nested text-text-primary rounded-xl text-xs font-semibold px-4 py-2 inline-flex items-center gap-1.5 active:scale-[0.96] transition-transform duration-150"
            >
               <RefreshCw className="h-3.5 w-3.5" />
               <span>Try Again</span>
            </Button>
         </div>
      </div>
   );
}
