"use client";

import { useEffect } from "react";

import { initLogRocket } from "@/core/observability/logrocket";
import { logError, logEvents } from "@/core/observability/logger";

interface GlobalErrorProps {
   error: Error & { digest?: string };
   reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
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
         <body
            className="min-h-screen bg-[#0d0d0d] text-[#f4f3f6] font-sans antialiased"
            style={{
               backgroundColor: "#0d0d0d",
               color: "#f4f3f6",
               fontFamily: "Inter, sans-serif",
               margin: 0,
            }}
         >
            <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center p-4">
               <div
                  className="w-full rounded-3xl border border-[#262626] bg-[#141414] p-8 text-center shadow-2xl"
                  style={{
                     backgroundColor: "#141414",
                     borderColor: "#262626",
                     borderRadius: "24px",
                  }}
                  role="alert"
               >
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#ef4444]/30 bg-[#401010]/30 text-[#ff5757]">
                     <span className="text-xl font-bold">!</span>
                  </div>

                  <h1 className="text-xl font-bold text-[#ffffff] tracking-tight">
                     Critical Application Error
                  </h1>

                  <p className="mt-2 text-sm leading-relaxed text-[#d1d1d1]">
                     An unexpected error interrupted the application shell. You
                     can retry the operation or return to the study lounge.
                  </p>

                  {error.digest ? (
                     <p className="mt-3 text-xs text-[#868686] font-mono select-all">
                        Error ID: {error.digest}
                     </p>
                  ) : null}

                  <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                     <button
                        type="button"
                        onClick={reset}
                        className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center rounded-xl bg-[#ffffff] px-5 py-2.5 text-sm font-semibold text-[#0d0d0d] hover:bg-[#eae9ec] transition-colors focus:outline-none focus:ring-2 focus:ring-[#ffffff]/40"
                     >
                        Try again
                     </button>
                     <a
                        href="/"
                        className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center rounded-xl border border-[#292929] bg-[#1c1c1c] px-5 py-2.5 text-sm font-semibold text-[#f4f3f6] hover:bg-[#292929] hover:text-[#ffffff] transition-colors focus:outline-none focus:ring-2 focus:ring-[#434343]"
                     >
                        Return to Lounge
                     </a>
                  </div>
               </div>
            </main>
         </body>
      </html>
   );
}
