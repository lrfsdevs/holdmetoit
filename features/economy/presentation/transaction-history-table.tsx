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
               <span className="inline-flex items-center gap-1 rounded-full bg-economy-credit/15 border border-economy-credit/30 px-2 py-0.5 text-[11px] font-medium text-economy-credit">
                  <ArrowUpRight className="h-3 w-3" />
                  Study Reward
               </span>
            );
         case "CHALLENGE_REWARD":
            return (
               <span className="inline-flex items-center gap-1 rounded-full bg-economy-gold/15 border border-economy-gold/30 px-2 py-0.5 text-[11px] font-medium text-economy-gold">
                  <ArrowUpRight className="h-3 w-3" />
                  Challenge Bonus
               </span>
            );
         case "WAGER_SETTLEMENT":
            return (
               <span className="inline-flex items-center gap-1 rounded-full bg-economy-adjustment/15 border border-economy-adjustment/30 px-2 py-0.5 text-[11px] font-medium text-economy-adjustment">
                  <Coins className="h-3 w-3" />
                  Wager Settlement
               </span>
            );
         case "WAGER_RESERVATION":
            return (
               <span className="inline-flex items-center gap-1 rounded-full bg-economy-reserved/15 border border-economy-reserved/30 px-2 py-0.5 text-[11px] font-medium text-economy-reserved">
                  <Lock className="h-3 w-3" />
                  Wager Reservation
               </span>
            );
         case "TRADE_RESERVATION":
            return (
               <span className="inline-flex items-center gap-1 rounded-full bg-economy-reserved/15 border border-economy-reserved/30 px-2 py-0.5 text-[11px] font-medium text-economy-reserved">
                  <Lock className="h-3 w-3" />
                  Reservation
               </span>
            );
         case "WAGER_REFUND":
         case "TRADE_REFUND":
            return (
               <span className="inline-flex items-center gap-1 rounded-full bg-economy-refund/15 border border-economy-refund/30 px-2 py-0.5 text-[11px] font-medium text-economy-refund">
                  <RotateCcw className="h-3 w-3" />
                  Refund
               </span>
            );
         case "ADMIN_ADJUSTMENT":
            return (
               <span className="inline-flex items-center gap-1 rounded-full bg-economy-adjustment/15 border border-economy-adjustment/30 px-2 py-0.5 text-[11px] font-medium text-economy-adjustment">
                  <ShieldAlert className="h-3 w-3" />
                  Admin Adjustment
               </span>
            );
         case "REVERSAL":
            return (
               <span className="inline-flex items-center gap-1 rounded-full bg-economy-reversal/15 border border-economy-reversal/30 px-2 py-0.5 text-[11px] font-medium text-economy-reversal">
                  <RotateCcw className="h-3 w-3" />
                  Reversal
               </span>
            );
         case "GACHA_PURCHASE":
         case "TRADE_SETTLEMENT":
            return (
               <span className="inline-flex items-center gap-1 rounded-full bg-economy-debit/15 border border-economy-debit/30 px-2 py-0.5 text-[11px] font-medium text-economy-debit">
                  <ArrowDownLeft className="h-3 w-3" />
                  Debit
               </span>
            );
         default:
            return (
               <span className="inline-flex items-center rounded-full bg-obsidian-nested px-2 py-0.5 text-[11px] font-medium text-obsidian-textMuted">
                  {type}
               </span>
            );
      }
   }

   function renderAmountDelta(tx: TransactionItem) {
      if (tx.totalDelta > 0) {
         return (
            <span className="font-semibold text-economy-credit tabular-nums">
               +{tx.totalDelta.toLocaleString()} coins
            </span>
         );
      }
      if (tx.totalDelta < 0) {
         return (
            <span className="font-semibold text-economy-debit tabular-nums">
               {tx.totalDelta.toLocaleString()} coins
            </span>
         );
      }
      if (tx.reservedDelta > 0) {
         return (
            <span className="font-semibold text-economy-gold tabular-nums">
               Locked {tx.reservedDelta.toLocaleString()} coins
            </span>
         );
      }
      if (tx.reservedDelta < 0) {
         return (
            <span className="font-semibold text-economy-refund tabular-nums">
               Unlocked {Math.abs(tx.reservedDelta).toLocaleString()} coins
            </span>
         );
      }
      return (
         <span className="text-obsidian-textDim tabular-nums">0 coins</span>
      );
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
      <div className="rounded-2xl border border-obsidian-border bg-obsidian-card p-4 sm:p-6 shadow-xl mt-6">
         {/* Table Header & Filter Tabs */}
         <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-obsidian-borderSubtle pb-4">
            <div>
               <h3 className="text-base font-semibold text-obsidian-text">
                  Append-Only Currency Ledger
               </h3>
               <p className="text-xs text-obsidian-textDim">
                  Immutable audit log of all coin rewards, debits, and
                  reservations
               </p>
            </div>

            {onFilterChange && (
               <div className="flex flex-wrap gap-1.5 bg-obsidian-bg p-1 rounded-xl border border-obsidian-borderSubtle">
                  {filterOptions.map((opt) => (
                     <button
                        key={opt.id}
                        type="button"
                        onClick={() => onFilterChange(opt.id)}
                        className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
                           activeFilter === opt.id
                              ? "bg-obsidian-nested text-obsidian-text shadow"
                              : "text-obsidian-textDim hover:text-obsidian-textMuted"
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
               <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-obsidian-border bg-obsidian-elevated text-obsidian-textDim mb-3">
                  <Coins className="h-6 w-6" />
               </div>
               <h4 className="text-sm font-semibold text-obsidian-text">
                  No Transactions Yet
               </h4>
               <p className="text-xs text-obsidian-textDim max-w-sm mt-1">
                  Log study time during any active challenge to earn coins at
                  100 coins per hour. Every credit will be recorded here
                  automatically.
               </p>
            </div>
         ) : (
            <>
               {/* Desktop View (Table >= 640px) */}
               <div className="hidden sm:block overflow-x-auto mt-4">
                  <table className="w-full text-left text-xs">
                     <thead>
                        <tr className="border-b border-obsidian-borderSubtle text-obsidian-textDim">
                           <th className="pb-3 font-medium">Type</th>
                           <th className="pb-3 font-medium">Description</th>
                           <th className="pb-3 font-medium">Date & Time</th>
                           <th className="pb-3 font-medium text-right">
                              Amount
                           </th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-obsidian-subtle">
                        {transactions.map((tx) => (
                           <tr
                              key={tx.id}
                              className="hover:bg-obsidian-cardHover transition-colors"
                           >
                              <td className="py-3.5 pr-3">
                                 {renderTypeBadge(tx.type)}
                              </td>
                              <td className="py-3.5 pr-3">
                                 <p className="font-medium text-obsidian-text">
                                    {tx.description}
                                 </p>
                                 {tx.sourceType && (
                                    <span className="text-[10px] text-obsidian-textDim">
                                       Source: {tx.sourceType}
                                    </span>
                                 )}
                              </td>
                              <td className="py-3.5 pr-3 text-obsidian-textDim">
                                 {formatDate(tx.createdAt)}
                              </td>
                              <td className="py-3.5 text-right font-mono">
                                 {renderAmountDelta(tx)}
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>

               {/* Mobile View (Cards < 640px to eliminate horizontal overflow) */}
               <div className="sm:hidden space-y-2.5 mt-4">
                  {transactions.map((tx) => (
                     <div
                        key={tx.id}
                        className="rounded-xl border border-obsidian-borderSubtle bg-obsidian-subtle p-3 flex flex-col gap-2"
                     >
                        <div className="flex items-center justify-between">
                           {renderTypeBadge(tx.type)}
                           <span className="font-mono text-xs font-semibold">
                              {renderAmountDelta(tx)}
                           </span>
                        </div>
                        <p className="text-xs text-obsidian-text font-medium">
                           {tx.description}
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-obsidian-textDim border-t border-obsidian-borderSubtle pt-2">
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
                  <div className="flex items-center justify-between border-t border-obsidian-borderSubtle pt-4 mt-4 text-xs text-obsidian-textDim">
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
                           className="h-7 w-7 p-0 rounded-lg border-obsidian-border bg-obsidian-subtle"
                        >
                           <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <span className="px-2 font-medium text-obsidian-textMuted">
                           {pagination.page} / {pagination.totalPages}
                        </span>
                        <Button
                           type="button"
                           variant="outline"
                           size="sm"
                           disabled={pagination.page >= pagination.totalPages}
                           onClick={() => onPageChange(pagination.page + 1)}
                           className="h-7 w-7 p-0 rounded-lg border-obsidian-border bg-obsidian-subtle"
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
