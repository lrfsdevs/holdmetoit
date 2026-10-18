"use client";

import { useState } from "react";
import Image from "next/image";

/** Renders a challenge card image with a stable fallback state. */
export function ChallengeCardImage({
   src,
   title,
}: {
   src: string | null;
   title: string;
}) {
   const [status, setStatus] = useState<"loading" | "loaded" | "error">(
      "loading"
   );
   const [attempt, setAttempt] = useState(0);

   return (
      <div className="relative h-36 w-full overflow-hidden bg-gradient-to-br from-surface-nested to-surface-elevated">
         {src && status === "loading" && (
            <div
               role="status"
               aria-label={`Loading image for ${title}`}
               className="absolute inset-0 animate-pulse bg-surface-nested motion-reduce:animate-none"
            />
         )}
         {src && status !== "error" && (
            <Image
               key={attempt}
               src={src}
               alt={title}
               fill
               unoptimized
               sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px"
               onLoad={() => setStatus("loaded")}
               onError={() => setStatus("error")}
               className={`object-cover object-center group-hover:scale-105 transition-transform duration-500 motion-reduce:transition-none ${status === "loaded" ? "opacity-80" : "opacity-0"}`}
            />
         )}
         <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface-elevated via-transparent to-transparent" />
         {src && status === "error" && (
            <div
               role="status"
               className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-3 text-xs text-text-secondary"
            >
               <span>Image unavailable.</span>
               <button
                  type="button"
                  onClick={() => {
                     setAttempt((previous) => previous + 1);
                     setStatus("loading");
                  }}
                  className="min-h-control-sm rounded-md px-3 font-medium underline underline-offset-4 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
               >
                  Retry image
               </button>
            </div>
         )}
      </div>
   );
}
