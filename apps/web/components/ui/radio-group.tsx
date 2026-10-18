"use client";

import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";

import { cn } from "@/lib/utils";

const RadioGroup = React.forwardRef<
   React.ElementRef<typeof RadioGroupPrimitive.Root>,
   React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
   <RadioGroupPrimitive.Root
      ref={ref}
      className={cn("grid gap-2", className)}
      {...props}
   />
));
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

const RadioGroupItem = React.forwardRef<
   React.ElementRef<typeof RadioGroupPrimitive.Item>,
   React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
   <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
         "aspect-square h-4 w-4 rounded-pill border border-radio-border bg-radio-bg text-radio-selected shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-radio-selected",
         className
      )}
      {...props}
   >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
         <span className="h-2 w-2 rounded-pill bg-radio-selected" />
      </RadioGroupPrimitive.Indicator>
   </RadioGroupPrimitive.Item>
));
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

export { RadioGroup, RadioGroupItem };
