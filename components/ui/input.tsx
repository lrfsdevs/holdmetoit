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
               "flex h-11 min-h-[44px] w-full rounded-xl border border-[#292929] bg-[#1c1c1c] px-3.5 py-2 text-sm text-[#ffffff] shadow-inner outline-none transition-colors placeholder:text-[#868686] focus:border-[#ffffff]/60 focus:bg-[#222222] disabled:cursor-not-allowed disabled:opacity-50",
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
