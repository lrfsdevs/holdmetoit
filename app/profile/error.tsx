"use client";

import { useEffect } from "react";
import Link from "next/link";

import { ErrorState } from "@/components/state/error-state";
import { Button } from "@/components/ui/button";
import { logError, logEvents } from "@/core/observability/logger";

interface ProfileErrorProps {
   error: Error & { digest?: string };
   reset: () => void;
}

/** Renders recovery actions when profile resolution fails. */
export default function ProfileError({ error, reset }: ProfileErrorProps) {
   useEffect(() => {
      logError(logEvents.appError, {
         scope: "profile.resolver.boundary",
         tags: { boundary: "profile-error" },
         context: { digest: error.digest ?? "" },
         error,
      });
   }, [error]);

   return (
      <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-4 py-12">
         <ErrorState
            title="Couldn't resolve profile"
            message="Something went wrong while looking up your participant profile. You can retry or head back to the study lounge."
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
