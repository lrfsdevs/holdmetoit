"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ErrorState } from "@/components/state/error-state";
import { Button } from "@/components/ui/button";

interface UserProfileErrorProps {
   error: Error & { digest?: string };
   reset: () => void;
}

export default function UserProfileError({
   error,
   reset,
}: UserProfileErrorProps) {
   useEffect(() => {
      console.error("User profile error boundary caught:", error);
   }, [error]);

   return (
      <main className="mx-auto max-w-2xl px-4 py-16 space-y-6">
         <ErrorState
            title="Couldn't load scholar profile"
            message="Something went wrong while fetching this profile and career record. Please try again."
         />
         <div className="flex justify-center gap-3">
            <Button
               type="button"
               variant="outline"
               onClick={reset}
               className="rounded-xl border-border-strong text-xs"
            >
               Try Again
            </Button>
            <Button asChild className="rounded-xl text-xs">
               <Link href="/">Back to Home</Link>
            </Button>
         </div>
      </main>
   );
}
