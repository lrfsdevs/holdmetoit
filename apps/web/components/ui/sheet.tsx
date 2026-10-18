"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
   React.ElementRef<typeof SheetPrimitive.Overlay>,
   React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
   <SheetPrimitive.Overlay
      ref={ref}
      className={cn(
         "fixed inset-0 z-50 bg-overlay-backdrop backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
         className
      )}
      {...props}
   />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetVariants = cva(
   "fixed z-50 flex flex-col gap-4 bg-modal-bg p-6 text-text-primary shadow-2xl transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
   {
      variants: {
         side: {
            top: "inset-x-0 top-0 border-b border-border-default data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
            bottom:
               "inset-x-0 bottom-0 border-t border-border-default data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
            left: "inset-y-0 left-0 h-full w-3/4 max-w-md border-r border-border-default data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
            right: "inset-y-0 right-0 h-full w-full max-w-md border-l border-border-default data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
         },
      },
      defaultVariants: { side: "right" },
   }
);

/** Renders the shared side-drawer panel (portalled, focus-trapped). */
const SheetContent = React.forwardRef<
   React.ElementRef<typeof SheetPrimitive.Content>,
   React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> &
      VariantProps<typeof sheetVariants>
>(({ side = "right", className, children, ...props }, ref) => (
   <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
         ref={ref}
         className={cn(sheetVariants({ side }), className)}
         {...props}
      >
         {children}
         <SheetPrimitive.Close
            aria-label="Close drawer"
            className="absolute right-4 top-4 rounded-lg p-1 text-text-tertiary transition-colors hover:bg-surface-nested hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
         >
            <X className="h-4 w-4" />
         </SheetPrimitive.Close>
      </SheetPrimitive.Content>
   </SheetPortal>
));
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({
   className,
   ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
   <div className={cn("flex flex-col gap-1.5", className)} {...props} />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({
   className,
   ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
   <div
      className={cn(
         "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
         className
      )}
      {...props}
   />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
   React.ElementRef<typeof SheetPrimitive.Title>,
   React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
   <SheetPrimitive.Title
      ref={ref}
      className={cn("text-base font-bold text-white", className)}
      {...props}
   />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
   React.ElementRef<typeof SheetPrimitive.Description>,
   React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
   <SheetPrimitive.Description
      ref={ref}
      className={cn("text-xs leading-relaxed text-text-tertiary", className)}
      {...props}
   />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
   Sheet,
   SheetPortal,
   SheetOverlay,
   SheetTrigger,
   SheetClose,
   SheetContent,
   SheetHeader,
   SheetFooter,
   SheetTitle,
   SheetDescription,
};
