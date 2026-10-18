import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Renders the root not-found state with navigation back to the lounge. */
export default function RootNotFound() {
   return (
      <main className="mx-auto flex min-h-[calc(100vh-80px)] max-w-lg flex-col items-center justify-center p-4">
         <div
            className="w-full rounded-3xl border border-border-default bg-surface-primary p-8 text-center shadow-lg"
            role="status"
         >
            <p className="font-mono text-xs font-semibold uppercase tracking-widest text-feedback-success">
               404 Error
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
               Page Not Found
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-text-tertiary">
               The study hall, challenge, or page you are looking for does not
               exist or may have moved.
            </p>
            <div className="mt-6 flex justify-center">
               <Button asChild variant="secondary" className="min-h-control-sm">
                  <Link href="/">Return to Study Lounge</Link>
               </Button>
            </div>
         </div>
      </main>
   );
}
