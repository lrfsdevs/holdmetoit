import * as React from "react";

import { cn } from "@/lib/utils";

/** Renders the shared table element. Wrapping/overflow stays at the call site. */
const Table = React.forwardRef<
   HTMLTableElement,
   React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
   <table
      ref={ref}
      className={cn("w-full caption-bottom text-xs", className)}
      {...props}
   />
));
Table.displayName = "Table";

const TableHeader = React.forwardRef<
   HTMLTableSectionElement,
   React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
   <thead ref={ref} className={cn(className)} {...props} />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
   HTMLTableSectionElement,
   React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
   <tbody ref={ref} className={cn(className)} {...props} />
));
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<
   HTMLTableSectionElement,
   React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
   <tfoot ref={ref} className={cn(className)} {...props} />
));
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<
   HTMLTableRowElement,
   React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
   <tr ref={ref} className={cn("transition-colors", className)} {...props} />
));
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<
   HTMLTableCellElement,
   React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
   <th
      ref={ref}
      className={cn("text-left align-middle", className)}
      {...props}
   />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<
   HTMLTableCellElement,
   React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
   <td ref={ref} className={cn("align-middle", className)} {...props} />
));
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<
   HTMLTableCaptionElement,
   React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
   <caption
      ref={ref}
      className={cn("mt-4 text-xs text-text-tertiary", className)}
      {...props}
   />
));
TableCaption.displayName = "TableCaption";

export {
   Table,
   TableHeader,
   TableBody,
   TableFooter,
   TableHead,
   TableRow,
   TableCell,
   TableCaption,
};
