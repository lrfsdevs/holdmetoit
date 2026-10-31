"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ErrorState } from "@/components/state/error-state";
import { Button } from "@/components/ui/button";
import { logError, logEvents } from "@/core/observability/logger";

interface AdminUsersErrorProps {
   error: Error & { digest?: string };
   reset: () => void;
}

export default function AdminUsersError({
   error,
   reset,
}: AdminUsersErrorProps) {
   useEffect(() => {
      logError(logEvents.appError, {
         scope: "admin.users.boundary",
         tags: { boundary: "admin-users-error" },
         context: { digest: error.digest ?? "" },
         error,
      });
   }, [error]);

   return (
      <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-4 py-12">
         <ErrorState
            title="User Directory Error"
            message="An unexpected error occurred while loading the user directory. You can retry or return to the admin console."
         />
         <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
               type="button"
               variant="default"
               className="min-h-control-sm"
               onClick={reset}
            >
               Try again
            </Button>
            <Button asChild variant="secondary" className="min-h-control-sm">
               <Link href="/admin">Back to Console</Link>
            </Button>
         </div>
      </div>
   );
}
