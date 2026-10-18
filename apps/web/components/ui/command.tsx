"use client";

import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

const Command = React.forwardRef<
   React.ElementRef<typeof CommandPrimitive>,
   React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
   <CommandPrimitive
      ref={ref}
      className={cn(
         "flex h-full w-full flex-col overflow-hidden rounded-xl bg-dropdown-bg text-dropdown-text",
         className
      )}
      {...props}
   />
));
Command.displayName = CommandPrimitive.displayName;

const CommandInput = React.forwardRef<
   React.ElementRef<typeof CommandPrimitive.Input>,
   React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
   <div
      className="flex items-center border-b border-dropdown-border px-3"
      cmdk-input-wrapper=""
   >
      <Search className="mr-2 h-4 w-4 shrink-0 text-text-tertiary" />
      <CommandPrimitive.Input
         ref={ref}
         className={cn(
            "flex h-10 w-full bg-transparent py-3 text-xs text-white outline-none placeholder:text-text-tertiary disabled:cursor-not-allowed disabled:opacity-50",
            className
         )}
         {...props}
      />
   </div>
));
CommandInput.displayName = CommandPrimitive.Input.displayName;

const CommandList = React.forwardRef<
   React.ElementRef<typeof CommandPrimitive.List>,
   React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
   <CommandPrimitive.List
      ref={ref}
      className={cn(
         "max-h-64 overflow-y-auto overflow-x-hidden p-1",
         className
      )}
      {...props}
   />
));
CommandList.displayName = CommandPrimitive.List.displayName;

const CommandEmpty = React.forwardRef<
   React.ElementRef<typeof CommandPrimitive.Empty>,
   React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
   <CommandPrimitive.Empty
      ref={ref}
      className="py-6 text-center text-xs text-text-tertiary"
      {...props}
   />
));
CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

const CommandGroup = React.forwardRef<
   React.ElementRef<typeof CommandPrimitive.Group>,
   React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
   <CommandPrimitive.Group
      ref={ref}
      className={cn("overflow-hidden text-text-primary", className)}
      {...props}
   />
));
CommandGroup.displayName = CommandPrimitive.Group.displayName;

const CommandSeparator = React.forwardRef<
   React.ElementRef<typeof CommandPrimitive.Separator>,
   React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
   <CommandPrimitive.Separator
      ref={ref}
      className={cn("-mx-1 h-px bg-dropdown-hover", className)}
      {...props}
   />
));
CommandSeparator.displayName = CommandPrimitive.Separator.displayName;

const CommandItem = React.forwardRef<
   React.ElementRef<typeof CommandPrimitive.Item>,
   React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
   <CommandPrimitive.Item
      ref={ref}
      className={cn(
         "relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2 text-xs text-text-secondary outline-none data-[selected=true]:bg-dropdown-hover data-[selected=true]:text-white data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
         className
      )}
      {...props}
   />
));
CommandItem.displayName = CommandPrimitive.Item.displayName;

export {
   Command,
   CommandInput,
   CommandList,
   CommandEmpty,
   CommandGroup,
   CommandSeparator,
   CommandItem,
};
