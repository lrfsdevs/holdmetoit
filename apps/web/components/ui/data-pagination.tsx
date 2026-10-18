"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DataPaginationProps {
   currentPage: number;
   totalPages: number;
   totalItems?: number;
   pageSize?: number;
   onPageChange: (page: number) => void;
   itemLabel?: string;
   className?: string;
   compact?: boolean;
}

/**
 * Calculates page numbers to display with smart ellipsis for larger ranges.
 */
function getPageNumbers(
   currentPage: number,
   totalPages: number
): (number | "ellipsis")[] {
   if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
   }

   // When near the start
   if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, "ellipsis", totalPages];
   }

   // When near the end
   if (currentPage >= totalPages - 3) {
      return [
         1,
         "ellipsis",
         totalPages - 4,
         totalPages - 3,
         totalPages - 2,
         totalPages - 1,
         totalPages,
      ];
   }

   // In the middle
   return [
      1,
      "ellipsis",
      currentPage - 1,
      currentPage,
      currentPage + 1,
      "ellipsis",
      totalPages,
   ];
}

/** Renders compact or full pagination controls for a bounded result set. */
export function DataPagination({
   currentPage,
   totalPages,
   totalItems,
   pageSize,
   onPageChange,
   itemLabel = "items",
   className,
   compact = false,
}: DataPaginationProps) {
   if (totalPages <= 1) {
      return null;
   }

   const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
   const startItem = pageSize
      ? (safeCurrentPage - 1) * pageSize + 1
      : undefined;
   const endItem =
      pageSize && totalItems !== undefined
         ? Math.min(safeCurrentPage * pageSize, totalItems)
         : undefined;

   const pageNumbers = getPageNumbers(safeCurrentPage, totalPages);

   const handlePrev = () => {
      if (safeCurrentPage > 1) {
         onPageChange(safeCurrentPage - 1);
      }
   };

   const handleNext = () => {
      if (safeCurrentPage < totalPages) {
         onPageChange(safeCurrentPage + 1);
      }
   };

   if (compact) {
      return (
         <nav
            aria-label="Pagination"
            className={cn(
               "flex items-center justify-between gap-2 pt-3 border-t border-border-default text-xs",
               className
            )}
         >
            <span className="text-meta text-text-tertiary">
               {totalItems !== undefined &&
               startItem !== undefined &&
               endItem !== undefined ? (
                  <>
                     <span className="font-semibold text-white">
                        {startItem}–{endItem}
                     </span>{" "}
                     of{" "}
                     <span className="font-semibold text-white">
                        {totalItems}
                     </span>
                  </>
               ) : (
                  <>
                     Page{" "}
                     <span className="font-semibold text-white">
                        {safeCurrentPage}
                     </span>{" "}
                     of{" "}
                     <span className="font-semibold text-white">
                        {totalPages}
                     </span>
                  </>
               )}
            </span>

            <div className="flex items-center gap-1.5">
               <button
                  type="button"
                  onClick={handlePrev}
                  disabled={safeCurrentPage <= 1}
                  aria-label="Previous page"
                  className="inline-flex items-center justify-center h-7 px-2 rounded-lg bg-surface-elevated hover:bg-surface-nested text-white border border-border-strong disabled:opacity-30 disabled:pointer-events-none transition-colors text-meta font-semibold gap-1"
               >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span className="hidden xs:inline">Prev</span>
               </button>

               <span className="px-2 py-0.5 rounded-md bg-surface-nested text-meta font-mono text-text-secondary border border-border-strong">
                  {safeCurrentPage}/{totalPages}
               </span>

               <button
                  type="button"
                  onClick={handleNext}
                  disabled={safeCurrentPage >= totalPages}
                  aria-label="Next page"
                  className="inline-flex items-center justify-center h-7 px-2 rounded-lg bg-surface-elevated hover:bg-surface-nested text-white border border-border-strong disabled:opacity-30 disabled:pointer-events-none transition-colors text-meta font-semibold gap-1"
               >
                  <span className="hidden xs:inline">Next</span>
                  <ChevronRight className="h-3.5 w-3.5" />
               </button>
            </div>
         </nav>
      );
   }

   return (
      <nav
         aria-label="Pagination Navigation"
         className={cn(
            "flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-border-default text-xs",
            className
         )}
      >
         {/* Items Summary */}
         <div className="text-xs text-text-tertiary">
            {totalItems !== undefined &&
            startItem !== undefined &&
            endItem !== undefined ? (
               <span>
                  Showing{" "}
                  <span className="font-semibold text-white">
                     {startItem}–{endItem}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-white">{totalItems}</span>{" "}
                  {itemLabel}
               </span>
            ) : (
               <span>
                  Page{" "}
                  <span className="font-semibold text-white">
                     {safeCurrentPage}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-white">{totalPages}</span>
               </span>
            )}
         </div>

         {/* Pagination Controls */}
         <div className="flex items-center gap-1.5 self-center sm:self-auto">
            <button
               type="button"
               onClick={handlePrev}
               disabled={safeCurrentPage <= 1}
               aria-label="Previous page"
               className="inline-flex items-center justify-center h-8 px-2.5 sm:px-3 rounded-xl bg-surface-elevated hover:bg-surface-nested text-white border border-border-strong disabled:opacity-30 disabled:pointer-events-none transition-colors text-xs font-semibold gap-1"
            >
               <ChevronLeft className="h-4 w-4" />
               <span className="hidden sm:inline">Prev</span>
            </button>

            {/* Mobile Page Indicator */}
            <div className="sm:hidden px-3 py-1 rounded-xl bg-surface-elevated text-xs font-semibold text-white border border-border-strong">
               {safeCurrentPage} / {totalPages}
            </div>

            {/* Desktop Page Numbers */}
            <div className="hidden sm:flex items-center gap-1">
               {pageNumbers.map((p, idx) => {
                  if (p === "ellipsis") {
                     return (
                        <span
                           key={`ellipsis-${idx}`}
                           className="w-8 text-center text-text-tertiary select-none text-xs"
                        >
                           …
                        </span>
                     );
                  }

                  const isActive = p === safeCurrentPage;
                  return (
                     <button
                        key={p}
                        type="button"
                        onClick={() => onPageChange(p)}
                        aria-current={isActive ? "page" : undefined}
                        aria-label={`Page ${p}`}
                        className={cn(
                           "h-8 min-w-[32px] px-2 rounded-xl text-xs font-semibold transition-all border",
                           isActive
                              ? "bg-white text-black border-white shadow-sm"
                              : "bg-surface-elevated text-text-secondary border-border-strong hover:bg-surface-nested hover:text-white"
                        )}
                     >
                        {p}
                     </button>
                  );
               })}
            </div>

            <button
               type="button"
               onClick={handleNext}
               disabled={safeCurrentPage >= totalPages}
               aria-label="Next page"
               className="inline-flex items-center justify-center h-8 px-2.5 sm:px-3 rounded-xl bg-surface-elevated hover:bg-surface-nested text-white border border-border-strong disabled:opacity-30 disabled:pointer-events-none transition-colors text-xs font-semibold gap-1"
            >
               <span className="hidden sm:inline">Next</span>
               <ChevronRight className="h-4 w-4" />
            </button>
         </div>
      </nav>
   );
}
