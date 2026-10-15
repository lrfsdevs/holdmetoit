"use client";

import React from "react";
import { CoinsIcon } from "./coins-icon";
import { SECONDS_PER_COIN } from "../domain/economy-constants";
import type { WalletSummary } from "../domain/wallet-accounting";
import { ShieldCheck, ArrowUpRight, ArrowDownLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface WalletSummaryCardProps {
   summary: WalletSummary;
   isAdmin?: boolean;
   onOpenReconcile?: () => void;
   onOpenAdminAdjust?: () => void;
}

export function WalletSummaryCard({
   summary,
   isAdmin,
   onOpenReconcile,
   onOpenAdminAdjust,
}: WalletSummaryCardProps) {
   const progressPercent = Math.min(
      100,
      Math.round((summary.rewardProgressSeconds / SECONDS_PER_COIN) * 100)
   );

   return (
      <div className="rounded-2xl border border-[#292929] bg-[#141414] p-4 sm:p-6 shadow-xl relative overflow-hidden">
         {/* Subtle ambient gold radial background glow */}
         <div className="absolute top-0 right-0 w-72 h-72 bg-[#f59e0b]/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

         <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#242424] pb-5">
            <div className="flex items-center gap-3">
               <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#f59e0b]/30 bg-[#f59e0b]/10 text-[#f59e0b] shadow-inner">
                  <CoinsIcon className="h-6 w-6" />
               </div>
               <div>
                  <h2 className="text-base sm:text-lg font-semibold tracking-tight text-[#f4f3f6]">
                     Virtual Coin Wallet
                  </h2>
                  <p className="text-xs text-[#868686]">
                     Base reward: 100 coins per eligible study hour (1 coin /
                     36s)
                  </p>
               </div>
            </div>

            <div className="flex items-center gap-2">
               {onOpenReconcile && (
                  <Button
                     type="button"
                     variant="outline"
                     size="sm"
                     onClick={onOpenReconcile}
                     className="h-8 rounded-full border-[#333333] bg-[#1c1c1c] hover:bg-[#252525] text-xs text-[#d1d1d1] hover:text-[#f4f3f6] gap-1.5"
                  >
                     <ShieldCheck className="h-3.5 w-3.5 text-[#22c55e]" />
                     <span>Audit & Reconcile</span>
                  </Button>
               )}

               {isAdmin && onOpenAdminAdjust && (
                  <Button
                     type="button"
                     variant="outline"
                     size="sm"
                     onClick={onOpenAdminAdjust}
                     className="h-8 rounded-full border-[#e08a32]/40 bg-[#e08a32]/10 hover:bg-[#e08a32]/20 text-xs text-[#e08a32] hover:text-[#f5a742] gap-1.5"
                  >
                     <span>Admin Adjust</span>
                  </Button>
               )}
            </div>
         </div>

         {/* Metric Grid */}
         <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-5">
            {/* Available Balance */}
            <div className="rounded-xl border border-[#f59e0b]/25 bg-gradient-to-b from-[#1c1c1c] to-[#161616] p-4 flex flex-col justify-between">
               <div className="flex items-center justify-between text-xs text-[#868686]">
                  <span>Available Coins</span>
                  <span className="text-[10px] uppercase font-bold text-[#f59e0b] bg-[#f59e0b]/10 px-1.5 py-0.5 rounded">
                     Spendable
                  </span>
               </div>
               <div className="mt-2 flex items-baseline gap-1.5">
                  <span
                     data-testid="available-coins-value"
                     className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#f59e0b] tabular-nums"
                  >
                     {summary.availableBalance.toLocaleString()}
                  </span>
                  <span className="text-xs text-[#f59e0b]/70 font-medium">
                     coins
                  </span>
               </div>
               <p className="text-[11px] text-[#868686] mt-2">
                  Total minus reserved commitments
               </p>
            </div>

            {/* Reserved Balance */}
            <div className="rounded-xl border border-[#292929] bg-[#181818] p-4 flex flex-col justify-between">
               <div className="flex items-center justify-between text-xs text-[#868686]">
                  <span>Reserved Funds</span>
                  <Lock className="h-3.5 w-3.5 text-[#868686]" />
               </div>
               <div className="mt-2 flex items-baseline gap-1.5">
                  <span
                     data-testid="reserved-coins-value"
                     className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#d1d1d1] tabular-nums"
                  >
                     {summary.reservedBalance.toLocaleString()}
                  </span>
                  <span className="text-xs text-[#868686] font-medium">
                     coins
                  </span>
               </div>
               <p className="text-[11px] text-[#868686] mt-2">
                  Locked for pending wagers & trades
               </p>
            </div>

            {/* Lifetime Earned */}
            <div className="rounded-xl border border-[#292929] bg-[#181818] p-4 flex flex-col justify-between">
               <div className="flex items-center justify-between text-xs text-[#868686]">
                  <span>Lifetime Earned</span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-[#22c55e]" />
               </div>
               <div className="mt-2 flex items-baseline gap-1.5">
                  <span
                     data-testid="lifetime-earned-value"
                     className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#22c55e] tabular-nums"
                  >
                     {summary.lifetimeEarned.toLocaleString()}
                  </span>
                  <span className="text-xs text-[#22c55e]/70 font-medium">
                     coins
                  </span>
               </div>
               <p className="text-[11px] text-[#868686] mt-2">
                  Total study rewards & credits
               </p>
            </div>

            {/* Lifetime Spent */}
            <div className="rounded-xl border border-[#292929] bg-[#181818] p-4 flex flex-col justify-between">
               <div className="flex items-center justify-between text-xs text-[#868686]">
                  <span>Lifetime Spent</span>
                  <ArrowDownLeft className="h-3.5 w-3.5 text-[#f43f5e]" />
               </div>
               <div className="mt-2 flex items-baseline gap-1.5">
                  <span
                     data-testid="lifetime-spent-value"
                     className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#f43f5e] tabular-nums"
                  >
                     {summary.lifetimeSpent.toLocaleString()}
                  </span>
                  <span className="text-xs text-[#f43f5e]/70 font-medium">
                     coins
                  </span>
               </div>
               <p className="text-[11px] text-[#868686] mt-2">
                  Total debits & settlements
               </p>
            </div>
         </div>

         {/* Fractional Progress Meter */}
         <div className="mt-5 rounded-xl border border-[#242424] bg-[#1a1a1a] p-3 sm:p-4">
            <div className="flex items-center justify-between text-xs">
               <span className="font-medium text-[#d1d1d1]">
                  Progress Toward Next Whole Coin
               </span>
               <span className="text-[#f59e0b] font-semibold tabular-nums">
                  {summary.rewardProgressSeconds}s / {SECONDS_PER_COIN}s (
                  {progressPercent}%)
               </span>
            </div>
            <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#0d0d0d] border border-[#292929]">
               <div
                  className="h-full bg-gradient-to-r from-[#f59e0b] to-[#fbbf24] transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
               />
            </div>
            <p className="text-[11px] text-[#868686] mt-2">
               Fractional study time is strictly preserved across short
               sessions. When you reach 36 cumulative seconds, 1 coin is
               automatically credited.
            </p>
         </div>
      </div>
   );
}
