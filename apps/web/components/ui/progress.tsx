"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
   React.ElementRef<typeof ProgressPrimitive.Root>,
   React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, max = 100, ...props }, ref) => {
   const pct = Math.min(100, Math.max(0, ((value ?? 0) / (max || 100)) * 100));

   return (
      <ProgressPrimitive.Root
         ref={ref}
         value={value}
         max={max}
         className={cn(
            "relative h-2 w-full overflow-hidden rounded-pill bg-surface-nested",
            className
         )}
         {...props}
      >
         <ProgressPrimitive.Indicator
            className="h-full w-full flex-1 bg-brand-1 transition-all"
            style={{ transform: `translateX(-${100 - pct}%)` }}
         />
      </ProgressPrimitive.Root>
   );
});
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
