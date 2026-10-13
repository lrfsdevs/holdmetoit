"use client";

import { useEffect } from "react";
import Link from "next/link";

import { ErrorState } from "@/components/state/error-state";
import { Button } from "@/components/ui/button";
import { logError, logEvents } from "@/core/observability/logger";

interface AdminErrorProps {
   error: Error & { digest?: string };
   reset: () => void;
}

export default function AdminError({ error, reset }: AdminErrorProps) {
   useEffect(() => {
      logError(logEvents.appError, {
         scope: "admin.boundary",
         tags: { boundary: "admin-error" },
         context: { digest: error.digest ?? "" },
         error,
      });
   }, [error]);

   return (
      <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-4 py-12">
         <ErrorState
            title="Admin Console Error"
            message="An unexpected error occurred in the admin operations area. You can retry or exit to the challenges directory."
         />
         <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
               type="button"
               variant="default"
               className="min-h-[44px]"
               onClick={reset}
            >
               Try again
            </Button>
            <Button asChild variant="secondary" className="min-h-[44px]">
               <Link href="/challenges">Go to Challenges</Link>
            </Button>
         </div>
      </div>
   );
}
