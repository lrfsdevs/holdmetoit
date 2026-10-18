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
      <div className="rounded-2xl border border-border-default bg-surface-primary p-4 sm:p-6 shadow-xl relative overflow-hidden">
         {/* Subtle ambient gold radial background glow */}
         <div className="absolute top-0 right-0 w-72 h-72 bg-brand-1/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

         <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-5">
            <div className="flex items-center gap-3">
               <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand-1/30 bg-brand-1/10 text-brand-1 shadow-inner">
                  <CoinsIcon className="h-6 w-6" />
               </div>
               <div>
                  <h2 className="text-base sm:text-lg font-semibold tracking-tight text-text-primary">
                     Virtual Coin Wallet
                  </h2>
                  <p className="text-xs text-text-tertiary">
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
                     className="h-8 rounded-full border-border-strong bg-surface-elevated hover:bg-surface-nested text-xs text-text-secondary hover:text-text-primary gap-1.5"
                  >
                     <ShieldCheck className="h-3.5 w-3.5 text-feedback-success" />
                     <span>Audit & Reconcile</span>
                  </Button>
               )}

               {isAdmin && onOpenAdminAdjust && (
                  <Button
                     type="button"
                     variant="outline"
                     size="sm"
                     onClick={onOpenAdminAdjust}
                     className="h-8 rounded-full border-brand-2/40 bg-brand-2/10 hover:bg-brand-2/20 text-xs text-brand-2 hover:text-brand-2-hover gap-1.5"
                  >
                     <span>Admin Adjust</span>
                  </Button>
               )}
            </div>
         </div>

         {/* Metric Grid */}
         <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-5">
            {/* Available Balance */}
            <div className="rounded-xl border border-brand-1/25 bg-gradient-to-b from-surface-elevated to-surface-primary p-4 flex flex-col justify-between">
               <div className="flex items-center justify-between text-xs text-text-tertiary">
                  <span>Available Coins</span>
                  <span className="text-label uppercase font-bold text-brand-1 bg-brand-1/10 px-1.5 py-0.5 rounded">
                     Spendable
                  </span>
               </div>
               <div className="mt-2 flex items-baseline gap-1.5">
                  <span
                     data-testid="available-coins-value"
                     className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-brand-1 tabular-nums"
                  >
                     {summary.availableBalance.toLocaleString()}
                  </span>
                  <span className="text-xs text-brand-1/70 font-medium">
                     coins
                  </span>
               </div>
               <p className="text-meta text-text-tertiary mt-2">
                  Total minus reserved commitments
               </p>
            </div>

            {/* Reserved Balance */}
            <div className="rounded-xl border border-border-default bg-surface-secondary p-4 flex flex-col justify-between">
               <div className="flex items-center justify-between text-xs text-text-tertiary">
                  <span>Reserved Funds</span>
                  <Lock className="h-3.5 w-3.5 text-text-tertiary" />
               </div>
               <div className="mt-2 flex items-baseline gap-1.5">
                  <span
                     data-testid="reserved-coins-value"
                     className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text-secondary tabular-nums"
                  >
                     {summary.reservedBalance.toLocaleString()}
                  </span>
                  <span className="text-xs text-text-tertiary font-medium">
                     coins
                  </span>
               </div>
               <p className="text-meta text-text-tertiary mt-2">
                  Locked for pending wagers & trades
               </p>
            </div>

            {/* Lifetime Earned */}
            <div className="rounded-xl border border-border-default bg-surface-secondary p-4 flex flex-col justify-between">
               <div className="flex items-center justify-between text-xs text-text-tertiary">
                  <span>Lifetime Earned</span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-feedback-success" />
               </div>
               <div className="mt-2 flex items-baseline gap-1.5">
                  <span
                     data-testid="lifetime-earned-value"
                     className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-feedback-success tabular-nums"
                  >
                     {summary.lifetimeEarned.toLocaleString()}
                  </span>
                  <span className="text-xs text-feedback-success/70 font-medium">
                     coins
                  </span>
               </div>
               <p className="text-meta text-text-tertiary mt-2">
                  Total study rewards & credits
               </p>
            </div>

            {/* Lifetime Spent */}
            <div className="rounded-xl border border-border-default bg-surface-secondary p-4 flex flex-col justify-between">
               <div className="flex items-center justify-between text-xs text-text-tertiary">
                  <span>Lifetime Spent</span>
                  <ArrowDownLeft className="h-3.5 w-3.5 text-brand-3" />
               </div>
               <div className="mt-2 flex items-baseline gap-1.5">
                  <span
                     data-testid="lifetime-spent-value"
                     className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-brand-3 tabular-nums"
                  >
                     {summary.lifetimeSpent.toLocaleString()}
                  </span>
                  <span className="text-xs text-brand-3/70 font-medium">
                     coins
                  </span>
               </div>
               <p className="text-meta text-text-tertiary mt-2">
                  Total debits & settlements
               </p>
            </div>
         </div>

         {/* Fractional Progress Meter */}
         <div className="mt-5 rounded-xl border border-border-subtle bg-surface-tertiary p-3 sm:p-4">
            <div className="flex items-center justify-between text-xs">
               <span className="font-medium text-text-secondary">
                  Progress Toward Next Whole Coin
               </span>
               <span className="text-brand-1 font-semibold tabular-nums">
                  {summary.rewardProgressSeconds}s / {SECONDS_PER_COIN}s (
                  {progressPercent}%)
               </span>
            </div>
            <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-surface-page border border-border-default">
               <div
                  className="h-full bg-gradient-to-r from-brand-1 to-brand-1-light transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
               />
            </div>
            <p className="text-meta text-text-tertiary mt-2">
               Fractional study time is strictly preserved across short
               sessions. When you reach 36 cumulative seconds, 1 coin is
               automatically credited.
            </p>
         </div>
      </div>
   );
}
