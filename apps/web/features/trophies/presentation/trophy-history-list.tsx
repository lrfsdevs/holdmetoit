"use client";

import React from "react";
import Link from "next/link";
import {
   ArrowUp,
   ArrowDown,
   RotateCcw,
   Wrench,
   Trophy,
   ChevronRight,
   Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface TrophyTransactionItem {
   id: string;
   amount: number;
   balanceAfter: number;
   type: string;
   sourceType?: string | null;
   sourceId?: string | null;
   description: string;
   createdAt: string | Date;
}

interface TrophyHistoryListProps {
   transactions: TrophyTransactionItem[];
   pagination?: {
      page: number;
      totalPages: number;
      totalCount: number;
   };
   onPageChange?: (newPage: number) => void;
   className?: string;
}

export function TrophyHistoryList({
   transactions = [],
   pagination,
   onPageChange,
   className = "",
}: TrophyHistoryListProps) {
   if (transactions.length === 0) {
      return (
         <div
            className={`rounded-2xl border border-obsidian-border bg-obsidian-card p-8 text-center shadow-lg ${className}`}
         >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-obsidian-elevated border border-obsidian-borderSubtle text-obsidian-textDim mx-auto mb-3">
               <Trophy className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-semibold text-obsidian-text">
               No Trophy History Yet
            </h4>
            <p className="text-xs text-obsidian-textDim mt-1 max-w-sm mx-auto">
               Complete challenges and secure team victories to earn trophies,
               climb competitive tiers, and unlock prestigous roles.
            </p>
         </div>
      );
   }

   const formatTimestamp = (dateInput: string | Date) => {
      const date = new Date(dateInput);
      return date.toLocaleDateString("en-US", {
         month: "short",
         day: "numeric",
         year: "numeric",
      });
   };

   return (
      <div
         className={`rounded-2xl border border-obsidian-border bg-obsidian-card p-5 shadow-lg backdrop-blur-md ${className}`}
         data-testid="trophy-history-card"
      >
         <div className="flex items-center justify-between pb-3 border-b border-obsidian-borderSubtle mb-3">
            <div>
               <h3 className="text-sm font-semibold text-obsidian-text flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-yellow-400/10 text-yellow-400 font-bold text-xs">
                     🏆
                  </span>
                  Trophy History & Competitive Ledger
               </h3>
               <p className="text-xs text-obsidian-textDim mt-0.5">
                  Auditable record of all rating changes from competitive
                  outcomes.
               </p>
            </div>
            {pagination && (
               <span className="text-xs text-obsidian-textDim font-mono">
                  {pagination.totalCount} entries
               </span>
            )}
         </div>

         <div className="divide-y divide-obsidian-borderSubtle">
            {transactions.map((tx) => {
               const isWin = tx.amount > 0;
               const isLoss = tx.amount < 0;
               const isReversal = tx.type === "REVERSAL";
               const isAdmin = tx.type === "ADMIN_ADJUSTMENT";

               const challengeUrl =
                  tx.sourceType === "CHALLENGE" && tx.sourceId
                     ? `/challenge/${tx.sourceId}`
                     : null;

               return (
                  <div
                     key={tx.id}
                     className="py-3 flex items-center justify-between gap-3 text-xs group transition-colors hover:bg-obsidian-elevated/40 px-2 rounded-lg"
                  >
                     {/* Left: Indicator Icon & Description */}
                     <div className="flex items-center gap-3 min-w-0">
                        <div
                           className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${
                              isReversal
                                 ? "bg-zinc-800 border-zinc-700 text-zinc-300"
                                 : isAdmin
                                   ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                                   : isWin
                                     ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                     : isLoss
                                       ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                                       : "bg-zinc-800 border-zinc-700 text-zinc-400"
                           }`}
                        >
                           {isReversal ? (
                              <RotateCcw className="h-4 w-4" />
                           ) : isAdmin ? (
                              <Wrench className="h-4 w-4" />
                           ) : isWin ? (
                              <ArrowUp className="h-4 w-4" />
                           ) : isLoss ? (
                              <ArrowDown className="h-4 w-4" />
                           ) : (
                              <Trophy className="h-4 w-4" />
                           )}
                        </div>

                        <div className="min-w-0">
                           <div className="font-medium text-obsidian-text truncate flex items-center gap-1.5">
                              <span>{tx.description}</span>
                              {challengeUrl && (
                                 <Link
                                    href={challengeUrl}
                                    className="text-[11px] text-economy-gold hover:underline inline-flex items-center gap-0.5"
                                 >
                                    <span>View Match</span>
                                    <ChevronRight className="h-2.5 w-2.5" />
                                 </Link>
                              )}
                           </div>
                           <div className="text-[11px] text-obsidian-textDim flex items-center gap-2 mt-0.5">
                              <span className="flex items-center gap-1">
                                 <Calendar className="h-3 w-3" />
                                 {formatTimestamp(tx.createdAt)}
                              </span>
                              <span>•</span>
                              <span>
                                 Balance after:{" "}
                                 <strong className="text-obsidian-text font-mono">
                                    {tx.balanceAfter.toLocaleString()}
                                 </strong>
                              </span>
                           </div>
                        </div>
                     </div>

                     {/* Right: Trophy Delta Amount */}
                     <div className="text-right shrink-0">
                        <span
                           className={`font-mono text-sm font-bold ${
                              isWin
                                 ? "text-emerald-400"
                                 : isLoss
                                   ? "text-rose-400"
                                   : "text-obsidian-textMuted"
                           }`}
                        >
                           {tx.amount > 0 ? `+${tx.amount}` : tx.amount} 🏆
                        </span>
                     </div>
                  </div>
               );
            })}
         </div>

         {/* Pagination Footer */}
         {pagination && pagination.totalPages > 1 && onPageChange && (
            <div className="mt-4 pt-3 border-t border-obsidian-borderSubtle flex items-center justify-between text-xs">
               <span className="text-obsidian-textDim">
                  Page {pagination.page} of {pagination.totalPages}
               </span>
               <div className="flex items-center gap-2">
                  <Button
                     type="button"
                     variant="outline"
                     size="sm"
                     disabled={pagination.page <= 1}
                     onClick={() => onPageChange(pagination.page - 1)}
                     className="text-xs h-7 px-2.5 border-obsidian-borderSubtle bg-obsidian-elevated text-obsidian-textMuted"
                  >
                     Previous
                  </Button>
                  <Button
                     type="button"
                     variant="outline"
                     size="sm"
                     disabled={pagination.page >= pagination.totalPages}
                     onClick={() => onPageChange(pagination.page + 1)}
                     className="text-xs h-7 px-2.5 border-obsidian-borderSubtle bg-obsidian-elevated text-obsidian-textMuted"
                  >
                     Next
                  </Button>
               </div>
            </div>
         )}
      </div>
   );
}
