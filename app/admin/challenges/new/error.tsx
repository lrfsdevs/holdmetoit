"use client";

import { useEffect } from "react";
import Link from "next/link";

import { ErrorState } from "@/components/state/error-state";
import { Button } from "@/components/ui/button";
import { logError, logEvents } from "@/core/observability/logger";

interface NewChallengeErrorProps {
   error: Error & { digest?: string };
   reset: () => void;
}

export default function NewChallengeError({
   error,
   reset,
}: NewChallengeErrorProps) {
   useEffect(() => {
      logError(logEvents.appError, {
         scope: "admin.new_challenge.boundary",
         tags: { boundary: "new-challenge-error" },
         context: { digest: error.digest ?? "" },
         error,
      });
   }, [error]);

   return (
      <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-4 py-12">
         <ErrorState
            title="Couldn't load challenge creator"
            message="An unexpected error occurred while loading the challenge wizard. You can retry or return to the challenges list."
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
               <Link href="/challenges">Return to Challenges</Link>
            </Button>
         </div>
      </div>
   );
}
