"use client";

import React from "react";
import {
   ArrowDownLeft,
   ArrowUpRight,
   Lock,
   RotateCcw,
   ShieldAlert,
   Coins,
   ChevronLeft,
   ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@/components/ui/table";

export interface TransactionItem {
   id: string;
   type: string;
   amount: number;
   totalDelta: number;
   reservedDelta: number;
   sourceType?: string | null;
   sourceId?: string | null;
   description: string;
   createdAt: string | Date;
}

export interface TransactionHistoryTableProps {
   transactions: TransactionItem[];
   pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
   };
   onPageChange: (newPage: number) => void;
   activeFilter?: string;
   onFilterChange?: (filter: string) => void;
}

export function TransactionHistoryTable({
   transactions,
   pagination,
   onPageChange,
   activeFilter = "ALL",
   onFilterChange,
}: TransactionHistoryTableProps) {
   const filterOptions = [
      { id: "ALL", label: "All Transactions" },
      { id: "STUDY_REWARD", label: "Study Rewards" },
      { id: "CHALLENGE_REWARD", label: "Challenge Rewards" },
      { id: "WAGER_RESERVATION", label: "Wager Stakes" },
      { id: "WAGER_SETTLEMENT", label: "Wager Results" },
      { id: "ADMIN_ADJUSTMENT", label: "Admin Adjustments" },
   ];

   function renderTypeBadge(type: string) {
      switch (type) {
         case "STUDY_REWARD":
            return (
               <span className="inline-flex items-center gap-1 rounded-full bg-feedback-success/15 border border-feedback-success/30 px-2 py-0.5 text-meta font-medium text-feedback-success">
                  <ArrowUpRight className="h-3 w-3" />
                  Study Reward
               </span>
            );
         case "CHALLENGE_REWARD":
            return (
               <span className="inline-flex items-center gap-1 rounded-full bg-brand-1/15 border border-brand-1/30 px-2 py-0.5 text-meta font-medium text-brand-1">
                  <ArrowUpRight className="h-3 w-3" />
                  Challenge Bonus
               </span>
            );
         case "WAGER_SETTLEMENT":
            return (
               <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 border border-accent/30 px-2 py-0.5 text-meta font-medium text-accent">
                  <Coins className="h-3 w-3" />
                  Wager Settlement
               </span>
            );
         case "WAGER_RESERVATION":
            return (
               <span className="inline-flex items-center gap-1 rounded-full bg-brand-1/15 border border-brand-1/30 px-2 py-0.5 text-meta font-medium text-brand-1">
                  <Lock className="h-3 w-3" />
                  Wager Reservation
               </span>
            );
         case "TRADE_RESERVATION":
            return (
               <span className="inline-flex items-center gap-1 rounded-full bg-brand-1/15 border border-brand-1/30 px-2 py-0.5 text-meta font-medium text-brand-1">
                  <Lock className="h-3 w-3" />
                  Reservation
               </span>
            );
         case "WAGER_REFUND":
         case "TRADE_REFUND":
            return (
               <span className="inline-flex items-center gap-1 rounded-full bg-feedback-info/15 border border-feedback-info/30 px-2 py-0.5 text-meta font-medium text-feedback-info">
                  <RotateCcw className="h-3 w-3" />
                  Refund
               </span>
            );
         case "ADMIN_ADJUSTMENT":
            return (
               <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 border border-accent/30 px-2 py-0.5 text-meta font-medium text-accent">
                  <ShieldAlert className="h-3 w-3" />
                  Admin Adjustment
               </span>
            );
         case "REVERSAL":
            return (
               <span className="inline-flex items-center gap-1 rounded-full bg-brand-3/15 border border-brand-3/30 px-2 py-0.5 text-meta font-medium text-brand-3">
                  <RotateCcw className="h-3 w-3" />
                  Reversal
               </span>
            );
         case "GACHA_PURCHASE":
         case "TRADE_SETTLEMENT":
            return (
               <span className="inline-flex items-center gap-1 rounded-full bg-brand-3/15 border border-brand-3/30 px-2 py-0.5 text-meta font-medium text-brand-3">
                  <ArrowDownLeft className="h-3 w-3" />
                  Debit
               </span>
            );
         default:
            return (
               <span className="inline-flex items-center rounded-full bg-surface-nested px-2 py-0.5 text-meta font-medium text-text-secondary">
                  {type}
               </span>
            );
      }
   }

   function renderAmountDelta(tx: TransactionItem) {
      if (tx.totalDelta > 0) {
         return (
            <span className="font-semibold text-feedback-success tabular-nums">
               +{tx.totalDelta.toLocaleString()} coins
            </span>
         );
      }
      if (tx.totalDelta < 0) {
         return (
            <span className="font-semibold text-brand-3 tabular-nums">
               {tx.totalDelta.toLocaleString()} coins
            </span>
         );
      }
      if (tx.reservedDelta > 0) {
         return (
            <span className="font-semibold text-brand-1 tabular-nums">
               Locked {tx.reservedDelta.toLocaleString()} coins
            </span>
         );
      }
      if (tx.reservedDelta < 0) {
         return (
            <span className="font-semibold text-feedback-info tabular-nums">
               Unlocked {Math.abs(tx.reservedDelta).toLocaleString()} coins
            </span>
         );
      }
      return <span className="text-text-tertiary tabular-nums">0 coins</span>;
   }

   function formatDate(dateInput: string | Date) {
      const date =
         typeof dateInput === "string" ? new Date(dateInput) : dateInput;
      return date.toLocaleDateString("en-US", {
         month: "short",
         day: "numeric",
         year: "numeric",
         hour: "2-digit",
         minute: "2-digit",
      });
   }

   return (
      <div className="rounded-2xl border border-border-default bg-surface-primary p-4 sm:p-6 shadow-xl mt-6">
         {/* Table Header & Filter Tabs */}
         <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-4">
            <div>
               <h3 className="text-base font-semibold text-text-primary">
                  Append-Only Currency Ledger
               </h3>
               <p className="text-xs text-text-tertiary">
                  Immutable audit log of all coin rewards, debits, and
                  reservations
               </p>
            </div>

            {onFilterChange && (
               <div className="flex flex-wrap gap-1.5 bg-surface-page p-1 rounded-xl border border-border-subtle">
                  {filterOptions.map((opt) => (
                     <button
                        key={opt.id}
                        type="button"
                        onClick={() => onFilterChange(opt.id)}
                        className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
                           activeFilter === opt.id
                              ? "bg-surface-nested text-text-primary shadow"
                              : "text-text-tertiary hover:text-text-secondary"
                        }`}
                     >
                        {opt.label}
                     </button>
                  ))}
               </div>
            )}
         </div>

         {/* Zero-State (Empty State) */}
         {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
               <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border-default bg-surface-elevated text-text-tertiary mb-3">
                  <Coins className="h-6 w-6" />
               </div>
               <h4 className="text-sm font-semibold text-text-primary">
                  No Transactions Yet
               </h4>
               <p className="text-xs text-text-tertiary max-w-sm mt-1">
                  Log study time during any active challenge to earn coins at
                  100 coins per hour. Every credit will be recorded here
                  automatically.
               </p>
            </div>
         ) : (
            <>
               {/* Desktop View (Table >= 640px) */}
               <div className="hidden sm:block overflow-x-auto mt-4">
                  <Table className="w-full text-left text-xs">
                     <TableHeader>
                        <TableRow className="border-b border-border-subtle text-text-tertiary">
                           <TableHead className="pb-3 font-medium">
                              Type
                           </TableHead>
                           <TableHead className="pb-3 font-medium">
                              Description
                           </TableHead>
                           <TableHead className="pb-3 font-medium">
                              Date & Time
                           </TableHead>
                           <TableHead className="pb-3 font-medium text-right">
                              Amount
                           </TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody className="divide-y divide-surface-secondary">
                        {transactions.map((tx) => (
                           <TableRow
                              key={tx.id}
                              className="hover:bg-surface-tertiary transition-colors"
                           >
                              <TableCell className="py-3.5 pr-3">
                                 {renderTypeBadge(tx.type)}
                              </TableCell>
                              <TableCell className="py-3.5 pr-3">
                                 <p className="font-medium text-text-primary">
                                    {tx.description}
                                 </p>
                                 {tx.sourceType && (
                                    <span className="text-label text-text-tertiary">
                                       Source: {tx.sourceType}
                                    </span>
                                 )}
                              </TableCell>
                              <TableCell className="py-3.5 pr-3 text-text-tertiary">
                                 {formatDate(tx.createdAt)}
                              </TableCell>
                              <TableCell className="py-3.5 text-right font-mono">
                                 {renderAmountDelta(tx)}
                              </TableCell>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </div>

               {/* Mobile View (Cards < 640px to eliminate horizontal overflow) */}
               <div className="sm:hidden space-y-2.5 mt-4">
                  {transactions.map((tx) => (
                     <div
                        key={tx.id}
                        className="rounded-xl border border-border-subtle bg-surface-secondary p-3 flex flex-col gap-2"
                     >
                        <div className="flex items-center justify-between">
                           {renderTypeBadge(tx.type)}
                           <span className="font-mono text-xs font-semibold">
                              {renderAmountDelta(tx)}
                           </span>
                        </div>
                        <p className="text-xs text-text-primary font-medium">
                           {tx.description}
                        </p>
                        <div className="flex items-center justify-between text-label text-text-tertiary border-t border-border-subtle pt-2">
                           <span>
                              {tx.sourceType ? `Source: ${tx.sourceType}` : ""}
                           </span>
                           <span>{formatDate(tx.createdAt)}</span>
                        </div>
                     </div>
                  ))}
               </div>

               {/* Pagination Controls */}
               {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-border-subtle pt-4 mt-4 text-xs text-text-tertiary">
                     <span>
                        Showing {transactions.length} of {pagination.totalCount}{" "}
                        entries
                     </span>
                     <div className="flex items-center gap-1.5">
                        <Button
                           type="button"
                           variant="outline"
                           size="sm"
                           disabled={pagination.page <= 1}
                           onClick={() => onPageChange(pagination.page - 1)}
                           className="h-7 w-7 p-0 rounded-lg border-border-default bg-surface-secondary"
                        >
                           <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <span className="px-2 font-medium text-text-secondary">
                           {pagination.page} / {pagination.totalPages}
                        </span>
                        <Button
                           type="button"
                           variant="outline"
                           size="sm"
                           disabled={pagination.page >= pagination.totalPages}
                           onClick={() => onPageChange(pagination.page + 1)}
                           className="h-7 w-7 p-0 rounded-lg border-border-default bg-surface-secondary"
                        >
                           <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                     </div>
                  </div>
               )}
            </>
         )}
      </div>
   );
}
