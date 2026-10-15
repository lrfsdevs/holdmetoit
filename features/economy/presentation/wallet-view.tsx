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
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { YptSettingsCard } from "@/features/ypt/presentation/ypt-settings-card";

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
}

export function WalletView({
   initialSummary,
   initialTransactions = [],
   initialPagination = { page: 1, limit: 20, totalCount: 0, totalPages: 1 },
   isAdmin = false,
   userId = "",
   initialYptId = null,
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
            <Loader2 className="h-8 w-8 animate-spin text-[#f59e0b] mb-3" />
            <h3 className="text-sm font-semibold text-[#f4f3f6]">
               Loading Virtual Wallet...
            </h3>
            <p className="text-xs text-[#868686] mt-1">
               Retrieving balances and transaction ledger.
            </p>
         </div>
      );
   }

   if (error && !summary) {
      return (
         <div className="rounded-2xl border border-[#ef4444]/30 bg-[#141414] p-6 text-center max-w-md mx-auto my-12">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ef4444]/10 text-[#ff5757] mx-auto mb-3">
               <AlertCircle className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-[#f4f3f6]">
               Unable to Load Wallet
            </h3>
            <p className="text-xs text-[#868686] mt-1">{error}</p>
            <Button
               type="button"
               variant="outline"
               size="sm"
               onClick={() => void loadData(1, activeFilter)}
               className="mt-4 gap-1.5 text-xs rounded-xl border-[#333333] bg-[#1c1c1c] text-[#d1d1d1]"
            >
               <RefreshCw className="h-3.5 w-3.5" />
               Retry
            </Button>
         </div>
      );
   }

   return (
      <div className="space-y-6">
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
