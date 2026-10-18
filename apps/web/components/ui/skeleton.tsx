import * as React from "react";
import { cn } from "@/lib/utils";

/** Renders a loading placeholder; never announced to assistive technology. */
function Skeleton({
   className,
   ...props
}: React.HTMLAttributes<HTMLDivElement>) {
   return (
      <div
         aria-hidden="true"
         className={cn(
            "animate-pulse rounded-control bg-surface-nested",
            className
         )}
         {...props}
      />
   );
}

export { Skeleton };
