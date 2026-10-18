import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
   "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
   {
      variants: {
         variant: {
            default:
               "bg-button-primary-bg text-button-primary-text font-semibold shadow-sm hover:bg-button-primary-hover active:scale-[0.98]",
            secondary:
               "border border-button-secondary-border bg-button-secondary-bg text-button-secondary-text font-medium hover:bg-button-secondary-hover active:scale-[0.98]",
            outline:
               "border border-button-outline-border bg-transparent text-button-outline-text font-medium hover:bg-button-outline-hover active:scale-[0.98]",
            ghost: "text-button-ghost-text hover:bg-button-ghost-hover hover:text-button-ghost-text-hover",
            destructive:
               "border border-button-destructive-border/40 bg-button-destructive-bg text-button-destructive-text font-semibold hover:bg-button-destructive-bg active:scale-[0.98]",
            pill: "rounded-full bg-button-secondary-bg border border-button-secondary-border text-button-secondary-text hover:bg-button-secondary-hover",
            gold: "border border-button-brand-border/40 bg-button-brand-bg text-button-brand-text font-semibold shadow hover:bg-button-brand-hover active:scale-[0.98]",
            admin: "border border-button-admin-border/40 bg-button-admin-bg text-button-admin-text font-semibold shadow hover:bg-button-admin-hover active:scale-[0.98]",
         },
         size: {
            default: "h-10 px-4 py-2",
            sm: "h-9 rounded-lg px-3 text-xs",
            lg: "h-11 rounded-xl px-8",
            icon: "h-10 w-10",
         },
      },
      defaultVariants: {
         variant: "default",
         size: "default",
      },
   }
);

export interface ButtonProps
   extends
      React.ButtonHTMLAttributes<HTMLButtonElement>,
      VariantProps<typeof buttonVariants> {
   asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
   ({ className, variant, size, asChild = false, ...props }, ref) => {
      const Comp = asChild ? Slot : "button";
      return (
         <Comp
            className={cn(buttonVariants({ variant, size, className }))}
            ref={ref}
            {...props}
         />
      );
   }
);
Button.displayName = "Button";

export { Button, buttonVariants };
