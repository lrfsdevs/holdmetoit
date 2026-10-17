import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

/** Renders the shared textarea control with project styling. */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
   ({ className, ...props }, ref) => (
      <textarea
         ref={ref}
         className={cn(
            "flex w-full rounded-xl border border-[#292929] bg-[#1c1c1c] px-3.5 py-2 text-sm text-[#ffffff] shadow-inner outline-none transition-colors placeholder:text-[#868686] focus:border-[#ffffff]/60 focus:bg-[#222222] disabled:cursor-not-allowed disabled:opacity-50",
            className
         )}
         {...props}
      />
   )
);
Textarea.displayName = "Textarea";

export { Textarea };
