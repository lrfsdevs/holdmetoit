import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

/** Renders the shared styled text input while preserving native input props. */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
   ({ className, type, ...props }, ref) => {
      return (
         <input
            type={type}
            className={cn(
               "flex h-11 min-h-control-sm w-full rounded-xl border border-input-field-border bg-input-field-bg px-3.5 py-2 text-sm text-input-field-text shadow-inner outline-none transition-colors placeholder:text-input-field-placeholder focus:border-input-field-focus/60 focus:bg-input-field-bg disabled:cursor-not-allowed disabled:opacity-50",
               className
            )}
            ref={ref}
            {...props}
         />
      );
   }
);
Input.displayName = "Input";

export { Input };
