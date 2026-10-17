"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Renders the Wallet recovery boundary and retry action (Law L9). */
export default function WalletError({
   error,
   reset,
}: {
   error: Error & { digest?: string };
   reset: () => void;
}) {
   useEffect(() => {
      console.error("Wallet page runtime error:", error);
   }, [error]);

   return (
      <div className="min-h-screen bg-obsidian-bg text-obsidian-text flex items-center justify-center p-4">
         <div className="rounded-2xl border border-destructive/40 bg-obsidian-crimson-bg p-8 sm:p-12 text-center text-obsidian-text max-w-lg w-full">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive">
               <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-bold font-display">
               Wallet Encountered an Error
            </h2>
            <p className="mt-2 text-xs text-obsidian-textDim max-w-md mx-auto">
               {error.message ||
                  "An unexpected error occurred while loading your coin wallet."}
            </p>
            <div className="mt-6 flex justify-center gap-3">
               <Button
                  onClick={() => reset()}
                  variant="secondary"
                  size="sm"
                  className="rounded-xl text-xs font-semibold px-4 py-2 inline-flex items-center gap-1.5 active:scale-[0.96] transition-transform duration-150"
               >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Try Again</span>
               </Button>
            </div>
         </div>
      </div>
   );
}
