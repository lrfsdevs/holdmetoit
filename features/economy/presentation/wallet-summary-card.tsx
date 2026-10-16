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
      <div className="rounded-2xl border border-obsidian-border bg-obsidian-card p-4 sm:p-6 shadow-xl relative overflow-hidden">
         {/* Subtle ambient gold radial background glow */}
         <div className="absolute top-0 right-0 w-72 h-72 bg-economy-gold/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

         <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-obsidian-borderSubtle pb-5">
            <div className="flex items-center gap-3">
               <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-economy-gold/30 bg-economy-gold/10 text-economy-gold shadow-inner">
                  <CoinsIcon className="h-6 w-6" />
               </div>
               <div>
                  <h2 className="text-base sm:text-lg font-semibold tracking-tight text-obsidian-text">
                     Virtual Coin Wallet
                  </h2>
                  <p className="text-xs text-obsidian-textDim">
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
                     className="h-8 rounded-full border-obsidian-borderHighlight bg-obsidian-elevated hover:bg-obsidian-nested text-xs text-obsidian-textMuted hover:text-obsidian-text gap-1.5"
                  >
                     <ShieldCheck className="h-3.5 w-3.5 text-economy-credit" />
                     <span>Audit & Reconcile</span>
                  </Button>
               )}

               {isAdmin && onOpenAdminAdjust && (
                  <Button
                     type="button"
                     variant="outline"
                     size="sm"
                     onClick={onOpenAdminAdjust}
                     className="h-8 rounded-full border-economy-admin/40 bg-economy-admin/10 hover:bg-economy-admin/20 text-xs text-economy-admin hover:text-economy-adminHover gap-1.5"
                  >
                     <span>Admin Adjust</span>
                  </Button>
               )}
            </div>
         </div>

         {/* Metric Grid */}
         <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-5">
            {/* Available Balance */}
            <div className="rounded-xl border border-economy-gold/25 bg-gradient-to-b from-obsidian-elevated to-obsidian-card p-4 flex flex-col justify-between">
               <div className="flex items-center justify-between text-xs text-obsidian-textDim">
                  <span>Available Coins</span>
                  <span className="text-[10px] uppercase font-bold text-economy-gold bg-economy-gold/10 px-1.5 py-0.5 rounded">
                     Spendable
                  </span>
               </div>
               <div className="mt-2 flex items-baseline gap-1.5">
                  <span
                     data-testid="available-coins-value"
                     className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-economy-gold tabular-nums"
                  >
                     {summary.availableBalance.toLocaleString()}
                  </span>
                  <span className="text-xs text-economy-gold/70 font-medium">
                     coins
                  </span>
               </div>
               <p className="text-[11px] text-obsidian-textDim mt-2">
                  Total minus reserved commitments
               </p>
            </div>

            {/* Reserved Balance */}
            <div className="rounded-xl border border-obsidian-border bg-obsidian-subtle p-4 flex flex-col justify-between">
               <div className="flex items-center justify-between text-xs text-obsidian-textDim">
                  <span>Reserved Funds</span>
                  <Lock className="h-3.5 w-3.5 text-obsidian-textDim" />
               </div>
               <div className="mt-2 flex items-baseline gap-1.5">
                  <span
                     data-testid="reserved-coins-value"
                     className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-obsidian-textMuted tabular-nums"
                  >
                     {summary.reservedBalance.toLocaleString()}
                  </span>
                  <span className="text-xs text-obsidian-textDim font-medium">
                     coins
                  </span>
               </div>
               <p className="text-[11px] text-obsidian-textDim mt-2">
                  Locked for pending wagers & trades
               </p>
            </div>

            {/* Lifetime Earned */}
            <div className="rounded-xl border border-obsidian-border bg-obsidian-subtle p-4 flex flex-col justify-between">
               <div className="flex items-center justify-between text-xs text-obsidian-textDim">
                  <span>Lifetime Earned</span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-economy-credit" />
               </div>
               <div className="mt-2 flex items-baseline gap-1.5">
                  <span
                     data-testid="lifetime-earned-value"
                     className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-economy-credit tabular-nums"
                  >
                     {summary.lifetimeEarned.toLocaleString()}
                  </span>
                  <span className="text-xs text-economy-credit/70 font-medium">
                     coins
                  </span>
               </div>
               <p className="text-[11px] text-obsidian-textDim mt-2">
                  Total study rewards & credits
               </p>
            </div>

            {/* Lifetime Spent */}
            <div className="rounded-xl border border-obsidian-border bg-obsidian-subtle p-4 flex flex-col justify-between">
               <div className="flex items-center justify-between text-xs text-obsidian-textDim">
                  <span>Lifetime Spent</span>
                  <ArrowDownLeft className="h-3.5 w-3.5 text-economy-debit" />
               </div>
               <div className="mt-2 flex items-baseline gap-1.5">
                  <span
                     data-testid="lifetime-spent-value"
                     className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-economy-debit tabular-nums"
                  >
                     {summary.lifetimeSpent.toLocaleString()}
                  </span>
                  <span className="text-xs text-economy-debit/70 font-medium">
                     coins
                  </span>
               </div>
               <p className="text-[11px] text-obsidian-textDim mt-2">
                  Total debits & settlements
               </p>
            </div>
         </div>

         {/* Fractional Progress Meter */}
         <div className="mt-5 rounded-xl border border-obsidian-borderSubtle bg-obsidian-cardHover p-3 sm:p-4">
            <div className="flex items-center justify-between text-xs">
               <span className="font-medium text-obsidian-textMuted">
                  Progress Toward Next Whole Coin
               </span>
               <span className="text-economy-gold font-semibold tabular-nums">
                  {summary.rewardProgressSeconds}s / {SECONDS_PER_COIN}s (
                  {progressPercent}%)
               </span>
            </div>
            <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-obsidian-bg border border-obsidian-border">
               <div
                  className="h-full bg-gradient-to-r from-economy-gold to-economy-goldLight transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
               />
            </div>
            <p className="text-[11px] text-obsidian-textDim mt-2">
               Fractional study time is strictly preserved across short
               sessions. When you reach 36 cumulative seconds, 1 coin is
               automatically credited.
            </p>
         </div>
      </div>
   );
}
