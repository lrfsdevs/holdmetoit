"use client";

import * as React from "react";
import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import { Check, ChevronRight, Circle } from "lucide-react";

import { cn } from "@/lib/utils";

const ContextMenu = ContextMenuPrimitive.Root;

const ContextMenuTrigger = ContextMenuPrimitive.Trigger;

const ContextMenuGroup = ContextMenuPrimitive.Group;

const ContextMenuPortal = ContextMenuPrimitive.Portal;

const ContextMenuSub = ContextMenuPrimitive.Sub;

const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup;

const ContextMenuSubTrigger = React.forwardRef<
   React.ElementRef<typeof ContextMenuPrimitive.SubTrigger>,
   React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubTrigger> & {
      inset?: boolean;
   }
>(({ className, inset, children, ...props }, ref) => (
   <ContextMenuPrimitive.SubTrigger
      ref={ref}
      className={cn(
         "flex cursor-default select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-secondary outline-none transition-colors focus:bg-surface-nested focus:text-white data-[state=open]:bg-surface-nested data-[state=open]:text-white [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0",
         inset && "pl-8",
         className
      )}
      {...props}
   >
      {children}
      <ChevronRight className="ml-auto" />
   </ContextMenuPrimitive.SubTrigger>
));
ContextMenuSubTrigger.displayName = ContextMenuPrimitive.SubTrigger.displayName;

const ContextMenuSubContent = React.forwardRef<
   React.ElementRef<typeof ContextMenuPrimitive.SubContent>,
   React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
   <ContextMenuPrimitive.SubContent
      ref={ref}
      className={cn(
         "z-50 min-w-32 overflow-hidden rounded-xl border border-border-strong bg-surface-elevated p-1.5 text-text-primary shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-context-menu-content-transform-origin]",
         className
      )}
      {...props}
   />
));
ContextMenuSubContent.displayName = ContextMenuPrimitive.SubContent.displayName;

const ContextMenuContent = React.forwardRef<
   React.ElementRef<typeof ContextMenuPrimitive.Content>,
   React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(({ className, children, ...props }, ref) => {
   const [mountedNode, setMountedNode] = React.useState<HTMLDivElement | null>(
      null
   );

   React.useEffect(() => {
      if (!mountedNode) {
         return;
      }

      const handleScroll = (event: Event) => {
         if (
            !mountedNode.isConnected ||
            mountedNode.getAttribute("data-state") !== "open"
         ) {
            return;
         }
         if (event.target && mountedNode.contains(event.target as Node)) {
            return;
         }
         // Ignore native horizontal/vertical scroll inside form fields (inputs, textareas, selects)
         if (
            event.target instanceof HTMLElement &&
            (event.target.tagName === "INPUT" ||
               event.target.tagName === "TEXTAREA" ||
               event.target.tagName === "SELECT" ||
               event.target.isContentEditable)
         ) {
            return;
         }
         // Dismiss context menu on external container or window scroll
         mountedNode.dispatchEvent(
            new KeyboardEvent("keydown", {
               key: "Escape",
               bubbles: true,
               cancelable: true,
            })
         );
      };

      const handleResize = () => {
         if (
            !mountedNode.isConnected ||
            mountedNode.getAttribute("data-state") !== "open"
         ) {
            return;
         }
         // Dismiss context menu on window resize or resolution change
         mountedNode.dispatchEvent(
            new KeyboardEvent("keydown", {
               key: "Escape",
               bubbles: true,
               cancelable: true,
            })
         );
      };

      window.addEventListener("scroll", handleScroll, {
         capture: true,
         passive: true,
      });
      window.addEventListener("resize", handleResize, { passive: true });

      return () => {
         window.removeEventListener("scroll", handleScroll, { capture: true });
         window.removeEventListener("resize", handleResize);
      };
   }, [mountedNode]);

   return (
      <ContextMenuPrimitive.Portal>
         <ContextMenuPrimitive.Content
            ref={(node) => {
               setMountedNode(node);
               if (typeof ref === "function") {
                  ref(node);
               } else if (ref) {
                  (
                     ref as React.MutableRefObject<HTMLDivElement | null>
                  ).current = node;
               }
            }}
            collisionPadding={8}
            className={cn(
               "z-50 min-w-dropdown-min overflow-y-auto overflow-x-hidden rounded-xl border border-border-strong bg-surface-elevated p-1.5 text-text-primary shadow-2xl",
               "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-context-menu-content-transform-origin]",
               className
            )}
            {...props}
         />
      </ContextMenuPrimitive.Portal>
   );
});
ContextMenuContent.displayName = ContextMenuPrimitive.Content.displayName;

const ContextMenuItem = React.forwardRef<
   React.ElementRef<typeof ContextMenuPrimitive.Item>,
   React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> & {
      inset?: boolean;
   }
>(({ className, inset, ...props }, ref) => (
   <ContextMenuPrimitive.Item
      ref={ref}
      className={cn(
         "relative flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary outline-none transition-colors focus:bg-surface-nested focus:text-white data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-3.5 [&>svg]:shrink-0",
         inset && "pl-8",
         className
      )}
      {...props}
   />
));
ContextMenuItem.displayName = ContextMenuPrimitive.Item.displayName;

const ContextMenuCheckboxItem = React.forwardRef<
   React.ElementRef<typeof ContextMenuPrimitive.CheckboxItem>,
   React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
   <ContextMenuPrimitive.CheckboxItem
      ref={ref}
      className={cn(
         "relative flex cursor-pointer select-none items-center rounded-lg py-1.5 pl-8 pr-2 text-xs font-medium text-text-secondary outline-none transition-colors focus:bg-surface-nested focus:text-white data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
         className
      )}
      checked={checked}
      {...props}
   >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
         <ContextMenuPrimitive.ItemIndicator>
            <Check className="h-4 w-4 text-emerald-400" />
         </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
   </ContextMenuPrimitive.CheckboxItem>
));
ContextMenuCheckboxItem.displayName =
   ContextMenuPrimitive.CheckboxItem.displayName;

const ContextMenuRadioItem = React.forwardRef<
   React.ElementRef<typeof ContextMenuPrimitive.RadioItem>,
   React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
   <ContextMenuPrimitive.RadioItem
      ref={ref}
      className={cn(
         "relative flex cursor-pointer select-none items-center rounded-lg py-1.5 pl-8 pr-2 text-xs font-medium text-text-secondary outline-none transition-colors focus:bg-surface-nested focus:text-white data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
         className
      )}
      {...props}
   >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
         <ContextMenuPrimitive.ItemIndicator>
            <Circle className="h-2 w-2 fill-current" />
         </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
   </ContextMenuPrimitive.RadioItem>
));
ContextMenuRadioItem.displayName = ContextMenuPrimitive.RadioItem.displayName;

const ContextMenuLabel = React.forwardRef<
   React.ElementRef<typeof ContextMenuPrimitive.Label>,
   React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Label> & {
      inset?: boolean;
   }
>(({ className, inset, ...props }, ref) => (
   <ContextMenuPrimitive.Label
      ref={ref}
      className={cn(
         "px-3 py-1 text-label font-semibold uppercase tracking-wider text-text-tertiary",
         inset && "pl-8",
         className
      )}
      {...props}
   />
));
ContextMenuLabel.displayName = ContextMenuPrimitive.Label.displayName;

const ContextMenuSeparator = React.forwardRef<
   React.ElementRef<typeof ContextMenuPrimitive.Separator>,
   React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
   <ContextMenuPrimitive.Separator
      ref={ref}
      className={cn("-mx-1 my-1 h-px bg-surface-nested", className)}
      {...props}
   />
));
ContextMenuSeparator.displayName = ContextMenuPrimitive.Separator.displayName;

const ContextMenuShortcut = ({
   className,
   ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
   return (
      <span
         className={cn(
            "ml-auto text-xs tracking-widest text-text-tertiary",
            className
         )}
         {...props}
      />
   );
};
ContextMenuShortcut.displayName = "ContextMenuShortcut";

export {
   ContextMenu,
   ContextMenuTrigger,
   ContextMenuContent,
   ContextMenuItem,
   ContextMenuCheckboxItem,
   ContextMenuRadioItem,
   ContextMenuLabel,
   ContextMenuSeparator,
   ContextMenuShortcut,
   ContextMenuGroup,
   ContextMenuPortal,
   ContextMenuSub,
   ContextMenuSubContent,
   ContextMenuSubTrigger,
   ContextMenuRadioGroup,
};
