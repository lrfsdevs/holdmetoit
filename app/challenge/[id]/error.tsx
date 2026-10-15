"use client";

import { useEffect } from "react";
import Link from "next/link";

import { ErrorState } from "@/components/state/error-state";
import { Button } from "@/components/ui/button";
import { logError, logEvents } from "@/core/observability/logger";

interface ChallengeErrorProps {
   error: Error & { digest?: string };
   reset: () => void;
}

/** Renders recovery actions when a challenge scoreboard fails to load. */
export default function ChallengeError({ error, reset }: ChallengeErrorProps) {
   useEffect(() => {
      logError(logEvents.appError, {
         scope: "challenge.scoreboard.boundary",
         tags: { boundary: "challenge-error" },
         context: { digest: error.digest ?? "" },
         error,
      });
   }, [error]);

   return (
      <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-4 py-12">
         <ErrorState
            title="Couldn't load challenge scoreboard"
            message="Something went wrong while rendering this challenge view. You can retry or browse other challenges."
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
               <Link href="/challenges">Browse Challenges</Link>
            </Button>
         </div>
      </div>
   );
}
