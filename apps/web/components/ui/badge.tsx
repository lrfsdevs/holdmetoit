import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
   "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
   {
      variants: {
         variant: {
            default:
               "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
            secondary:
               "border-transparent bg-badge-bg text-badge-text hover:bg-surface-nested",
            destructive:
               "border-badge-error-border/40 bg-badge-error-bg text-badge-error-text shadow hover:bg-badge-error-bg/80",
            outline:
               "border border-badge-border text-badge-text hover:bg-surface-elevated",
            gold: "border border-badge-brand-border/40 bg-badge-brand-bg/15 text-badge-brand-text",
            credit:
               "border border-badge-success-border/40 bg-badge-success-bg/15 text-badge-success-text",
            debit: "border border-badge-rose-border/40 bg-badge-rose-bg/15 text-badge-rose-text",
            refund:
               "border border-badge-info-border/40 bg-badge-info-bg/15 text-badge-info-text",
            adjustment:
               "border border-badge-accent-border/40 bg-badge-accent-bg/15 text-badge-accent-text",
            admin: "border border-badge-admin-border/40 bg-badge-admin-bg/15 text-badge-admin-text",
         },
      },
      defaultVariants: {
         variant: "default",
      },
   }
);

export interface BadgeProps
   extends
      React.HTMLAttributes<HTMLDivElement>,
      VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
   return (
      <div className={cn(badgeVariants({ variant }), className)} {...props} />
   );
}

export { Badge, badgeVariants };
