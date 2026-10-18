import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
   "relative w-full rounded-card border p-4 [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:h-4 [&>svg]:w-4 [&>svg~*]:pl-7",
   {
      variants: {
         variant: {
            default:
               "bg-surface-elevated border-border-default text-text-primary",
            destructive:
               "bg-feedback-error-bg border-feedback-error/40 text-feedback-error-text",
            success:
               "bg-feedback-success-bg border-feedback-success/40 text-feedback-success-text",
            warning:
               "bg-feedback-warning-bg border-feedback-warning/40 text-feedback-warning-text",
            info: "bg-feedback-info-bg border-feedback-info/40 text-feedback-info-text",
         },
      },
      defaultVariants: {
         variant: "default",
      },
   }
);

const Alert = React.forwardRef<
   HTMLDivElement,
   React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
   <div
      ref={ref}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
   />
));
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<
   HTMLParagraphElement,
   React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
   <h5
      ref={ref}
      className={cn(
         "mb-1 text-body font-semibold leading-none tracking-tight",
         className
      )}
      {...props}
   />
));
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<
   HTMLParagraphElement,
   React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
   <div
      ref={ref}
      className={cn(
         "text-meta text-text-tertiary [&_p]:leading-relaxed",
         className
      )}
      {...props}
   />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
