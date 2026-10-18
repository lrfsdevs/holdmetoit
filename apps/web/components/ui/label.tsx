"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";

import { cn } from "@/lib/utils";

const Label = React.forwardRef<
   React.ElementRef<typeof LabelPrimitive.Root>,
   React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
   <LabelPrimitive.Root
      ref={ref}
      className={cn(
         "text-meta font-medium leading-none text-text-secondary peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
         className
      )}
      {...props}
   />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
