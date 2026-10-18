"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";

const Select = SelectPrimitive.Root;

const SelectGroup = SelectPrimitive.Group;

const SelectValue = SelectPrimitive.Value;

/** Renders the shared Radix-backed select trigger with project styling. */
const SelectTrigger = React.forwardRef<
   React.ElementRef<typeof SelectPrimitive.Trigger>,
   React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
   <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
         "flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-input-field-border bg-input-field-bg px-3.5 py-2 text-left text-sm text-input-field-text shadow-inner outline-none transition-colors focus:border-input-field-focus/60 focus:bg-input-field-bg disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-input-field-placeholder [&>span]:line-clamp-1",
         className
      )}
      {...props}
   >
      {children}
      <SelectPrimitive.Icon asChild>
         <ChevronDown className="h-4 w-4 shrink-0 text-text-tertiary" />
      </SelectPrimitive.Icon>
   </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = React.forwardRef<
   React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
   React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
   <SelectPrimitive.ScrollUpButton
      ref={ref}
      className={cn(
         "flex cursor-default items-center justify-center py-1 text-text-tertiary",
         className
      )}
      {...props}
   >
      <ChevronUp className="h-4 w-4" />
   </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef<
   React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
   React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
   <SelectPrimitive.ScrollDownButton
      ref={ref}
      className={cn(
         "flex cursor-default items-center justify-center py-1 text-text-tertiary",
         className
      )}
      {...props}
   >
      <ChevronDown className="h-4 w-4" />
   </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName =
   SelectPrimitive.ScrollDownButton.displayName;

/** Renders the shared Radix-backed select popover with project styling. */
const SelectContent = React.forwardRef<
   React.ElementRef<typeof SelectPrimitive.Content>,
   React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
   <SelectPrimitive.Portal>
      <SelectPrimitive.Content
         ref={ref}
         position={position}
         sideOffset={4}
         collisionPadding={8}
         className={cn(
            "relative z-50 max-h-[var(--radix-select-content-available-height)] min-w-32 overflow-y-auto overflow-x-hidden rounded-xl border border-border-strong bg-surface-elevated p-1.5 text-text-primary shadow-2xl",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            position === "popper" &&
               "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
            className
         )}
         {...props}
      >
         <SelectScrollUpButton />
         <SelectPrimitive.Viewport
            className={cn(
               "p-0",
               position === "popper" &&
                  "w-full min-w-[var(--radix-select-trigger-width)]"
            )}
         >
            {children}
         </SelectPrimitive.Viewport>
         <SelectScrollDownButton />
      </SelectPrimitive.Content>
   </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
   React.ElementRef<typeof SelectPrimitive.Label>,
   React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
   <SelectPrimitive.Label
      ref={ref}
      className={cn(
         "px-2 py-1 text-label font-semibold uppercase tracking-wider text-text-tertiary",
         className
      )}
      {...props}
   />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = React.forwardRef<
   React.ElementRef<typeof SelectPrimitive.Item>,
   React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
   <SelectPrimitive.Item
      ref={ref}
      className={cn(
         "relative flex w-full cursor-pointer select-none items-center rounded-lg py-1.5 pl-8 pr-3 text-xs font-medium text-text-secondary outline-none transition-colors focus:bg-surface-nested focus:text-white data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
         className
      )}
      {...props}
   >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
         <SelectPrimitive.ItemIndicator>
            <Check className="h-4 w-4 text-emerald-400" />
         </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
   </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
   React.ElementRef<typeof SelectPrimitive.Separator>,
   React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
   <SelectPrimitive.Separator
      ref={ref}
      className={cn("-mx-1 my-1 h-px bg-surface-nested", className)}
      {...props}
   />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
   Select,
   SelectGroup,
   SelectValue,
   SelectTrigger,
   SelectContent,
   SelectLabel,
   SelectItem,
   SelectSeparator,
   SelectScrollUpButton,
   SelectScrollDownButton,
};
