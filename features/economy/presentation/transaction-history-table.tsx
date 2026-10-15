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
               <span className="inline-flex items-center gap-1 rounded-full bg-[#22c55e]/15 border border-[#22c55e]/30 px-2 py-0.5 text-[11px] font-medium text-[#22c55e]">
                  <ArrowUpRight className="h-3 w-3" />
                  Study Reward
               </span>
            );
         case "CHALLENGE_REWARD":
            return (
               <span className="inline-flex items-center gap-1 rounded-full bg-[#f59e0b]/15 border border-[#f59e0b]/30 px-2 py-0.5 text-[11px] font-medium text-[#f59e0b]">
                  <ArrowUpRight className="h-3 w-3" />
                  Challenge Bonus
               </span>
            );
         case "WAGER_SETTLEMENT":
            return (
               <span className="inline-flex items-center gap-1 rounded-full bg-[#a855f7]/15 border border-[#a855f7]/30 px-2 py-0.5 text-[11px] font-medium text-[#a855f7]">
                  <Coins className="h-3 w-3" />
                  Wager Settlement
               </span>
            );
         case "WAGER_RESERVATION":
            return (
               <span className="inline-flex items-center gap-1 rounded-full bg-[#f59e0b]/15 border border-[#f59e0b]/30 px-2 py-0.5 text-[11px] font-medium text-[#f59e0b]">
                  <Lock className="h-3 w-3" />
                  Wager Reservation
               </span>
            );
         case "TRADE_RESERVATION":
            return (
               <span className="inline-flex items-center gap-1 rounded-full bg-[#f59e0b]/15 border border-[#f59e0b]/30 px-2 py-0.5 text-[11px] font-medium text-[#f59e0b]">
                  <Lock className="h-3 w-3" />
                  Reservation
               </span>
            );
         case "WAGER_REFUND":
         case "TRADE_REFUND":
            return (
               <span className="inline-flex items-center gap-1 rounded-full bg-[#3b82f6]/15 border border-[#3b82f6]/30 px-2 py-0.5 text-[11px] font-medium text-[#3b82f6]">
                  <RotateCcw className="h-3 w-3" />
                  Refund
               </span>
            );
         case "ADMIN_ADJUSTMENT":
            return (
               <span className="inline-flex items-center gap-1 rounded-full bg-[#a855f7]/15 border border-[#a855f7]/30 px-2 py-0.5 text-[11px] font-medium text-[#a855f7]">
                  <ShieldAlert className="h-3 w-3" />
                  Admin Adjustment
               </span>
            );
         case "REVERSAL":
            return (
               <span className="inline-flex items-center gap-1 rounded-full bg-[#ec4899]/15 border border-[#ec4899]/30 px-2 py-0.5 text-[11px] font-medium text-[#ec4899]">
                  <RotateCcw className="h-3 w-3" />
                  Reversal
               </span>
            );
         case "GACHA_PURCHASE":
         case "WAGER_SETTLEMENT":
         case "TRADE_SETTLEMENT":
            return (
               <span className="inline-flex items-center gap-1 rounded-full bg-[#f43f5e]/15 border border-[#f43f5e]/30 px-2 py-0.5 text-[11px] font-medium text-[#f43f5e]">
                  <ArrowDownLeft className="h-3 w-3" />
                  Debit
               </span>
            );
         default:
            return (
               <span className="inline-flex items-center rounded-full bg-[#292929] px-2 py-0.5 text-[11px] font-medium text-[#d1d1d1]">
                  {type}
               </span>
            );
      }
   }

   function renderAmountDelta(tx: TransactionItem) {
      if (tx.totalDelta > 0) {
         return (
            <span className="font-semibold text-[#22c55e] tabular-nums">
               +{tx.totalDelta.toLocaleString()} coins
            </span>
         );
      }
      if (tx.totalDelta < 0) {
         return (
            <span className="font-semibold text-[#f43f5e] tabular-nums">
               {tx.totalDelta.toLocaleString()} coins
            </span>
         );
      }
      if (tx.reservedDelta > 0) {
         return (
            <span className="font-semibold text-[#f59e0b] tabular-nums">
               Locked {tx.reservedDelta.toLocaleString()} coins
            </span>
         );
      }
      if (tx.reservedDelta < 0) {
         return (
            <span className="font-semibold text-[#3b82f6] tabular-nums">
               Unlocked {Math.abs(tx.reservedDelta).toLocaleString()} coins
            </span>
         );
      }
      return <span className="text-[#868686] tabular-nums">0 coins</span>;
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
      <div className="rounded-2xl border border-[#292929] bg-[#141414] p-4 sm:p-6 shadow-xl mt-6">
         {/* Table Header & Filter Tabs */}
         <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#242424] pb-4">
            <div>
               <h3 className="text-base font-semibold text-[#f4f3f6]">
                  Append-Only Currency Ledger
               </h3>
               <p className="text-xs text-[#868686]">
                  Immutable audit log of all coin rewards, debits, and
                  reservations
               </p>
            </div>

            {onFilterChange && (
               <div className="flex flex-wrap gap-1.5 bg-[#0d0d0d] p-1 rounded-xl border border-[#242424]">
                  {filterOptions.map((opt) => (
                     <button
                        key={opt.id}
                        type="button"
                        onClick={() => onFilterChange(opt.id)}
                        className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
                           activeFilter === opt.id
                              ? "bg-[#292929] text-[#f4f3f6] shadow"
                              : "text-[#868686] hover:text-[#d1d1d1]"
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
               <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#292929] bg-[#1c1c1c] text-[#868686] mb-3">
                  <Coins className="h-6 w-6" />
               </div>
               <h4 className="text-sm font-semibold text-[#f4f3f6]">
                  No Transactions Yet
               </h4>
               <p className="text-xs text-[#868686] max-w-sm mt-1">
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
                        <tr className="border-b border-[#242424] text-[#868686]">
                           <th className="pb-3 font-medium">Type</th>
                           <th className="pb-3 font-medium">Description</th>
                           <th className="pb-3 font-medium">Date & Time</th>
                           <th className="pb-3 font-medium text-right">
                              Amount
                           </th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-[#1f1f1f]">
                        {transactions.map((tx) => (
                           <tr
                              key={tx.id}
                              className="hover:bg-[#1a1a1a] transition-colors"
                           >
                              <td className="py-3.5 pr-3">
                                 {renderTypeBadge(tx.type)}
                              </td>
                              <td className="py-3.5 pr-3">
                                 <p className="font-medium text-[#f4f3f6]">
                                    {tx.description}
                                 </p>
                                 {tx.sourceType && (
                                    <span className="text-[10px] text-[#868686]">
                                       Source: {tx.sourceType}
                                    </span>
                                 )}
                              </td>
                              <td className="py-3.5 pr-3 text-[#868686]">
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
                        className="rounded-xl border border-[#242424] bg-[#181818] p-3 flex flex-col gap-2"
                     >
                        <div className="flex items-center justify-between">
                           {renderTypeBadge(tx.type)}
                           <span className="font-mono text-xs font-semibold">
                              {renderAmountDelta(tx)}
                           </span>
                        </div>
                        <p className="text-xs text-[#f4f3f6] font-medium">
                           {tx.description}
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-[#868686] border-t border-[#222222] pt-2">
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
                  <div className="flex items-center justify-between border-t border-[#242424] pt-4 mt-4 text-xs text-[#868686]">
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
                           className="h-7 w-7 p-0 rounded-lg border-[#292929] bg-[#181818]"
                        >
                           <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <span className="px-2 font-medium text-[#d1d1d1]">
                           {pagination.page} / {pagination.totalPages}
                        </span>
                        <Button
                           type="button"
                           variant="outline"
                           size="sm"
                           disabled={pagination.page >= pagination.totalPages}
                           onClick={() => onPageChange(pagination.page + 1)}
                           className="h-7 w-7 p-0 rounded-lg border-[#292929] bg-[#181818]"
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
