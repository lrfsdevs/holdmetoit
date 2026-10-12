"use client";

import { useEffect } from "react";

import { initLogRocket } from "@/core/observability/logrocket";
import { logError, logEvents } from "@/core/observability/logger";

export default function GlobalError({
   error,
   reset,
}: {
   error: Error & { digest?: string };
   reset: () => void;
}) {
   useEffect(() => {
      initLogRocket();
      logError(logEvents.appError, {
         scope: "app.global_boundary",
         tags: { boundary: "global-error" },
         context: { digest: error.digest ?? "" },
         error,
      });
   }, [error]);

   return (
      <html lang="en">
         <body className="min-h-screen bg-[#0d0d0d] text-[#f4f3f6] font-sans antialiased">
            <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
               <p className="text-base font-bold text-[#ff5757]">
                  Something went wrong
               </p>
               <p className="text-sm text-[#d1d1d1]">
                  The app failed to render. Retry, or refresh the page.
               </p>
               <button
                  type="button"
                  className="min-h-[44px] rounded-xl bg-[#ffffff] px-4 text-sm font-semibold text-[#0d0d0d]"
                  onClick={reset}
               >
                  Try again
               </button>
            </div>
         </body>
      </html>
   );
}
