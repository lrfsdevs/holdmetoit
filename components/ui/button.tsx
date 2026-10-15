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
               "bg-[#ffffff] text-[#0d0d0d] font-semibold shadow-sm hover:bg-[#e0e0e0] active:scale-[0.98]",
            secondary:
               "border border-[#333333] bg-[#292929] text-[#ffffff] font-medium hover:bg-[#3d3d3d] active:scale-[0.98]",
            outline:
               "border border-[#333333] bg-transparent text-[#ffffff] font-medium hover:bg-[#1c1c1c] active:scale-[0.98]",
            ghost: "text-[#d1d1d1] hover:bg-[#1c1c1c] hover:text-[#ffffff]",
            destructive:
               "border border-[#ef4444]/40 bg-[#401010] text-[#ff5757] font-semibold hover:bg-[#521515] active:scale-[0.98]",
            pill: "rounded-full bg-[#292929] border border-[#333333] text-[#ffffff] hover:bg-[#3d3d3d]",
            gold: "border border-economy-gold/40 bg-economy-gold text-obsidian-bg font-semibold shadow hover:bg-economy-goldLight active:scale-[0.98]",
            admin: "border border-economy-admin/40 bg-economy-admin text-obsidian-bg font-semibold shadow hover:bg-economy-adminHover active:scale-[0.98]",
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
