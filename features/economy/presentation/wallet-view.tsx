"use client";

import React, { useState, useEffect } from "react";
import { WalletSummaryCard } from "./wallet-summary-card";
import {
   TransactionHistoryTable,
   type TransactionItem,
} from "./transaction-history-table";
import { AdminAdjustmentDialog } from "./admin-adjustment-dialog";
import { ReconciliationDialog } from "./reconciliation-dialog";
import {
   getWalletSummaryAction,
   getTransactionHistoryAction,
} from "../api/wallet.actions";
import type { WalletSummary } from "../domain/wallet-accounting";
import { Loader2, AlertCircle, RefreshCw, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { YptSettingsCard } from "@/features/ypt/presentation/ypt-settings-card";
import { TrophyRoleBadge } from "@/features/trophies/presentation/trophy-role-badge";

export interface WalletViewProps {
   initialSummary?: WalletSummary | null;
   initialTransactions?: TransactionItem[];
   initialPagination?: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
   };
   isAdmin?: boolean;
   userId?: string;
   initialYptId?: string | null;
   userTrophies?: number | null;
}

export function WalletView({
   initialSummary,
   initialTransactions = [],
   initialPagination = { page: 1, limit: 20, totalCount: 0, totalPages: 1 },
   isAdmin = false,
   userId = "",
   initialYptId = null,
   userTrophies = null,
}: WalletViewProps) {
   const [summary, setSummary] = useState<WalletSummary | null>(
      initialSummary ?? null
   );
   const [transactions, setTransactions] =
      useState<TransactionItem[]>(initialTransactions);
   const [pagination, setPagination] = useState(initialPagination);
   const [activeFilter, setActiveFilter] = useState("ALL");
   const [loading, setLoading] = useState(!initialSummary);
   const [error, setError] = useState<string | null>(null);

   const [isAdminAdjustOpen, setIsAdminAdjustOpen] = useState(false);
   const [isReconcileOpen, setIsReconcileOpen] = useState(false);

   const loadData = React.useCallback(async (page: number, filter: string) => {
      setLoading(true);
      setError(null);
      try {
         const typeParam = filter === "ALL" ? undefined : filter;
         const [summaryRes, historyRes] = await Promise.all([
            getWalletSummaryAction(),
            getTransactionHistoryAction({
               page,
               limit: 20,
               type: typeParam as any,
            }),
         ]);

         if (summaryRes.ok) {
            setSummary(summaryRes.data);
         } else {
            setError(summaryRes.message);
         }

         if (historyRes.ok) {
            setTransactions(historyRes.data.transactions as any);
            setPagination(historyRes.data.pagination);
         }
      } catch (err) {
         setError(
            err instanceof Error ? err.message : "Failed to load wallet data."
         );
      } finally {
         setLoading(false);
      }
   }, []);

   useEffect(() => {
      if (!initialSummary) {
         void loadData(1, activeFilter);
      }
   }, [initialSummary, activeFilter, loadData]);

   const handlePageChange = (newPage: number) => {
      void loadData(newPage, activeFilter);
   };

   const handleFilterChange = (newFilter: string) => {
      setActiveFilter(newFilter);
      void loadData(1, newFilter);
   };

   if (loading && !summary) {
      return (
         <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6">
            <Loader2 className="h-8 w-8 animate-spin text-economy-gold mb-3" />
            <h3 className="text-sm font-semibold text-obsidian-text">
               Loading Virtual Wallet...
            </h3>
            <p className="text-xs text-obsidian-textDim mt-1">
               Retrieving balances and transaction ledger.
            </p>
         </div>
      );
   }

   if (error && !summary) {
      return (
         <div className="rounded-2xl border border-destructive/30 bg-obsidian-card p-6 text-center max-w-md mx-auto my-12">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive mx-auto mb-3">
               <AlertCircle className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-obsidian-text">
               Unable to Load Wallet
            </h3>
            <p className="text-xs text-obsidian-textDim mt-1">{error}</p>
            <Button
               type="button"
               variant="outline"
               size="sm"
               onClick={() => void loadData(1, activeFilter)}
               className="mt-4 gap-1.5 text-xs rounded-xl border-obsidian-borderHighlight bg-obsidian-elevated text-obsidian-textMuted hover:text-obsidian-text"
            >
               <RefreshCw className="h-3.5 w-3.5" />
               Retry
            </Button>
         </div>
      );
   }

   return (
      <div className="space-y-6">
         {typeof userTrophies === "number" && (
            <div className="flex items-center justify-between rounded-2xl border border-obsidian-border bg-obsidian-card px-4 py-3 text-xs shadow-md">
               <div className="flex items-center gap-2.5">
                  <span className="text-obsidian-textDim text-[11px] font-medium">
                     Competitive Rating:
                  </span>
                  <TrophyRoleBadge trophies={userTrophies} size="sm" />
               </div>
               <Link
                  href="/leaderboard"
                  className="text-xs text-economy-gold hover:underline flex items-center gap-1 font-medium"
               >
                  <span>Leaderboard</span>
                  <ExternalLink className="h-3 w-3" />
               </Link>
            </div>
         )}

         {summary && (
            <WalletSummaryCard
               summary={summary}
               isAdmin={isAdmin}
               onOpenReconcile={() => setIsReconcileOpen(true)}
               onOpenAdminAdjust={() => setIsAdminAdjustOpen(true)}
            />
         )}

         <YptSettingsCard initialYptId={initialYptId} />

         <TransactionHistoryTable
            transactions={transactions}
            pagination={pagination}
            onPageChange={handlePageChange}
            activeFilter={activeFilter}
            onFilterChange={handleFilterChange}
         />

         {/* Admin Adjustment Modal */}
         <AdminAdjustmentDialog
            isOpen={isAdminAdjustOpen}
            onClose={() => setIsAdminAdjustOpen(false)}
            defaultUserId={userId}
            onSuccess={() => void loadData(1, activeFilter)}
         />

         {/* Audit & Reconciliation Modal */}
         <ReconciliationDialog
            isOpen={isReconcileOpen}
            onClose={() => setIsReconcileOpen(false)}
            targetUserId={userId}
         />
      </div>
   );
}
