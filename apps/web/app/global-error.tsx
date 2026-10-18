"use client";

import { useEffect } from "react";

import { initLogRocket } from "@/core/observability/logrocket";
import { logError, logEvents } from "@/core/observability/logger";

interface GlobalErrorProps {
   error: Error & { digest?: string };
   reset: () => void;
}

/** Renders the last-resort application shell when the root layout fails. */
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
            className="min-h-screen bg-surface-page text-text-primary font-sans antialiased"
            style={{
               backgroundColor: "var(--color-surface-page)",
               color: "var(--color-text-primary)",
               fontFamily: "Inter, sans-serif",
               margin: 0,
            }}
         >
            <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center p-4">
               <div
                  className="w-full rounded-3xl border border-border-default bg-surface-primary p-8 text-center shadow-2xl"
                  style={{
                     backgroundColor: "var(--color-surface-primary)",
                     borderColor: "var(--color-border-default)",
                     borderRadius: "24px",
                  }}
                  role="alert"
               >
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-feedback-error/30 bg-feedback-error-bg/30 text-feedback-error-text">
                     <span className="text-xl font-bold">!</span>
                  </div>

                  <h1 className="text-xl font-bold text-white tracking-tight">
                     Critical Application Error
                  </h1>

                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                     An unexpected error interrupted the application shell. You
                     can retry the operation or return to the study lounge.
                  </p>

                  {error.digest ? (
                     <p className="mt-3 text-xs text-text-tertiary font-mono select-all">
                        Error ID: {error.digest}
                     </p>
                  ) : null}

                  <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                     <button
                        type="button"
                        onClick={reset}
                        className="inline-flex min-h-control-sm w-full sm:w-auto items-center justify-center rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-text-inverse hover:bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-white/40"
                     >
                        Try again
                     </button>
                     <a
                        href="/"
                        className="inline-flex min-h-control-sm w-full sm:w-auto items-center justify-center rounded-xl border border-border-default bg-surface-elevated px-5 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-nested hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-border-strong"
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
