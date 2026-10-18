import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

/** Renders the shared textarea control with project styling. */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
   ({ className, ...props }, ref) => (
      <textarea
         ref={ref}
         className={cn(
            "flex w-full rounded-xl border border-input-field-border bg-input-field-bg px-3.5 py-2 text-sm text-input-field-text shadow-inner outline-none transition-colors placeholder:text-input-field-placeholder focus:border-input-field-focus/60 focus:bg-input-field-bg disabled:cursor-not-allowed disabled:opacity-50",
            className
         )}
         {...props}
      />
   )
);
Textarea.displayName = "Textarea";

export { Textarea };
