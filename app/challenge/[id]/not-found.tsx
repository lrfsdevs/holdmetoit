import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Renders the not-found state for an unavailable challenge. */
export default function ChallengeNotFound() {
   return (
      <main className="mx-auto flex min-h-[calc(100vh-140px)] max-w-lg flex-col items-center justify-center p-4">
         <div
            className="w-full rounded-3xl border border-[#262626] bg-[#141414] p-8 text-center shadow-lg"
            role="status"
         >
            <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#22c55e]">
               404 Not Found
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#ffffff]">
               Challenge Not Found
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[#868686]">
               We couldn&apos;t locate this study challenge in our records. It
               may not exist, might have concluded, or could still be in draft
               setup.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
               <Button asChild variant="default" className="min-h-[44px]">
                  <Link href="/challenges">Browse Challenges</Link>
               </Button>
               <Button asChild variant="secondary" className="min-h-[44px]">
                  <Link href="/">Return to Lounge</Link>
               </Button>
            </div>
         </div>
      </main>
   );
}
