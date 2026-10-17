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
               "border-transparent bg-obsidian-elevated text-obsidian-text hover:bg-obsidian-nested",
            destructive:
               "border-obsidian-crimson-border/40 bg-obsidian-crimson-bg text-obsidian-crimson-text shadow hover:bg-obsidian-crimson-bg/80",
            outline:
               "border border-obsidian-border text-obsidian-text hover:bg-obsidian-elevated",
            gold: "border border-economy-gold/40 bg-economy-gold/15 text-economy-gold",
            credit:
               "border border-economy-credit/40 bg-economy-credit/15 text-economy-credit",
            debit: "border border-economy-debit/40 bg-economy-debit/15 text-economy-debit",
            refund:
               "border border-economy-refund/40 bg-economy-refund/15 text-economy-refund",
            adjustment:
               "border border-economy-adjustment/40 bg-economy-adjustment/15 text-economy-adjustment",
            admin: "border border-economy-admin/40 bg-economy-admin/15 text-economy-admin",
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
