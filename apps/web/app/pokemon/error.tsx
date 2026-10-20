"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ErrorState } from "@/components/state/error-state";
import { Button } from "@/components/ui/button";
import { logError, logEvents } from "@/core/observability/logger";

interface PokemonErrorProps {
   error: Error & { digest?: string };
   reset: () => void;
}

/** Renders recovery actions when the Pokémon system fails to load (Law L9). */
export default function PokemonError({ error, reset }: PokemonErrorProps) {
   useEffect(() => {
      logError(logEvents.appError, {
         scope: "pokemon.boundary",
         tags: { boundary: "pokemon-error" },
         context: { digest: error.digest ?? "" },
         error,
      });
   }, [error]);

   return (
      <div className="min-h-[calc(100vh-4rem)] bg-surface-page text-text-primary flex items-center justify-center p-4">
         <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-4 py-12 text-center">
            <ErrorState
               title="Pokémon System Unavailable"
               message={
                  error.message ||
                  "Something went wrong while loading the Pokédex or companion collection. You can retry or return to challenges."
               }
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
                  <Link href="/challenges">Return to Challenges</Link>
               </Button>
            </div>
         </div>
      </div>
   );
}
