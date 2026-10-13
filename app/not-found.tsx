import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function RootNotFound() {
   return (
      <main className="mx-auto flex min-h-[calc(100vh-80px)] max-w-lg flex-col items-center justify-center p-4">
         <div
            className="w-full rounded-3xl border border-[#262626] bg-[#141414] p-8 text-center shadow-lg"
            role="status"
         >
            <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#22c55e]">
               404 Error
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#ffffff]">
               Page Not Found
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[#868686]">
               The study hall, challenge, or page you are looking for does not
               exist or may have moved.
            </p>
            <div className="mt-6 flex justify-center">
               <Button asChild variant="secondary" className="min-h-[44px]">
                  <Link href="/">Return to Study Lounge</Link>
               </Button>
            </div>
         </div>
      </main>
   );
}
