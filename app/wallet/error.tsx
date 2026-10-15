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
      <div className="min-h-screen bg-[#0d0d0d] text-[#f4f3f6] flex items-center justify-center p-4">
         <div className="rounded-2xl border border-red-950/60 bg-[#141010] p-8 sm:p-12 text-center text-[#f4f3f6] max-w-lg w-full">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-950/40 border border-red-900/50 text-red-400">
               <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-bold font-display">
               Wallet Encountered an Error
            </h2>
            <p className="mt-2 text-xs text-[#868686] max-w-md mx-auto">
               {error.message ||
                  "An unexpected error occurred while loading your coin wallet."}
            </p>
            <div className="mt-6 flex justify-center gap-3">
               <Button
                  onClick={() => reset()}
                  className="bg-[#292929] hover:bg-[#333333] text-[#f4f3f6] rounded-xl text-xs font-semibold px-4 py-2 inline-flex items-center gap-1.5 active:scale-[0.96] transition-transform duration-150"
               >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Try Again</span>
               </Button>
            </div>
         </div>
      </div>
   );
}
