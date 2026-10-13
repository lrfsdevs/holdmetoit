"use client";

import { useEffect } from "react";
import Link from "next/link";

import { ErrorState } from "@/components/state/error-state";
import { Button } from "@/components/ui/button";
import { logError, logEvents } from "@/core/observability/logger";

interface ChallengesErrorProps {
   error: Error & { digest?: string };
   reset: () => void;
}

export default function ChallengesError({
   error,
   reset,
}: ChallengesErrorProps) {
   useEffect(() => {
      logError(logEvents.appError, {
         scope: "challenges.directory.boundary",
         tags: { boundary: "challenges-error" },
         context: { digest: error.digest ?? "" },
         error,
      });
   }, [error]);

   return (
      <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-4 py-12">
         <ErrorState
            title="Couldn't load challenges"
            message="Something went wrong while fetching the challenges catalog. You can retry or head back to the study lounge."
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
               <Link href="/">Return to Study Lounge</Link>
            </Button>
         </div>
      </div>
   );
}
