"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { reconcileWalletAction } from "../api/wallet.actions";
import type { ReconciliationReport } from "../domain/reconciliation";
import {
   CheckCircle2,
   AlertTriangle,
   ShieldCheck,
   Loader2,
   X,
} from "lucide-react";

export interface ReconciliationDialogProps {
   isOpen: boolean;
   onClose: () => void;
   targetUserId?: string;
}

export function ReconciliationDialog({
   isOpen,
   onClose,
   targetUserId,
}: ReconciliationDialogProps) {
   const [report, setReport] = useState<ReconciliationReport | null>(null);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);

   const runAudit = React.useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
         const res = await reconcileWalletAction({ targetUserId });
         if (res.ok) {
            setReport(res.data);
         } else {
            setError(res.message);
         }
      } catch (err) {
         setError(err instanceof Error ? err.message : "Failed to run audit.");
      } finally {
         setLoading(false);
      }
   }, [targetUserId]);

   useEffect(() => {
      if (isOpen) {
         void runAudit();
      }
   }, [isOpen, runAudit]);

   useEffect(() => {
      if (!isOpen) return;
      const handleKeyDown = (e: KeyboardEvent) => {
         if (e.key === "Escape" && !loading) {
            onClose();
         }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
   }, [isOpen, loading, onClose]);

   if (!isOpen) return null;

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
         <div className="relative w-full max-w-lg rounded-2xl border border-[#292929] bg-[#141414] text-[#f4f3f6] p-6 shadow-2xl">
            <button
               type="button"
               onClick={onClose}
               disabled={loading}
               className="absolute top-4 right-4 text-[#868686] hover:text-[#f4f3f6] transition-colors"
            >
               <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
               <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#22c55e]/30 bg-[#22c55e]/10 text-[#22c55e]">
                  <ShieldCheck className="h-5 w-5" />
               </div>
               <div>
                  <h3 className="text-base font-semibold text-[#f4f3f6]">
                     Wallet & Ledger Reconciliation
                  </h3>
                  <p className="text-xs text-[#868686]">
                     Mathematical integrity audit comparing wallet accounting
                     totals to append-only ledger deltas.
                  </p>
               </div>
            </div>

            <div className="space-y-4">
               {loading ? (
                  <div className="flex flex-col items-center justify-center py-10">
                     <Loader2 className="h-7 w-7 animate-spin text-[#f59e0b] mb-2" />
                     <p className="text-xs text-[#868686]">
                        Auditing wallet balance against ledger transactions...
                     </p>
                  </div>
               ) : error ? (
                  <div className="rounded-xl border border-[#ef4444]/30 bg-[#ef4444]/10 p-4 text-xs text-[#ff5757]">
                     {error}
                  </div>
               ) : report ? (
                  <>
                     {/* Audit Banner */}
                     <div
                        className={`rounded-xl p-4 flex items-center gap-3 border ${
                           report.isReconciled
                              ? "bg-[#22c55e]/10 border-[#22c55e]/30 text-[#85ff93]"
                              : "bg-[#ef4444]/10 border-[#ef4444]/30 text-[#ff5757]"
                        }`}
                     >
                        {report.isReconciled ? (
                           <CheckCircle2 className="h-5 w-5 shrink-0 text-[#22c55e]" />
                        ) : (
                           <AlertTriangle className="h-5 w-5 shrink-0 text-[#ef4444]" />
                        )}
                        <div>
                           <p className="text-xs font-semibold">
                              {report.isReconciled
                                 ? "100% Invariant Compliant — All Balances Match"
                                 : "Accounting Discrepancies Detected"}
                           </p>
                           <p className="text-[11px] opacity-80 mt-0.5">
                              {report.isReconciled
                                 ? "Wallet balance, reserved commitments, and ledger deltas are in exact mathematical alignment."
                                 : `${report.discrepancies.length} discrepancy item(s) found during ledger reconciliation.`}
                           </p>
                        </div>
                     </div>

                     {/* Breakdown Grid */}
                     <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="rounded-xl border border-[#242424] bg-[#1a1a1a] p-3">
                           <span className="text-[#868686]">
                              Wallet Total Balance
                           </span>
                           <p className="font-mono text-base font-bold text-[#f4f3f6] mt-1">
                              {report.walletTotal.toLocaleString()} coins
                           </p>
                           <span className="text-[10px] text-[#868686]">
                              Ledger delta:{" "}
                              {report.ledgerTotal.toLocaleString()}
                           </span>
                        </div>

                        <div className="rounded-xl border border-[#242424] bg-[#1a1a1a] p-3">
                           <span className="text-[#868686]">
                              Reserved Balance
                           </span>
                           <p className="font-mono text-base font-bold text-[#f4f3f6] mt-1">
                              {report.walletReserved.toLocaleString()} coins
                           </p>
                           <span className="text-[10px] text-[#868686]">
                              Ledger delta:{" "}
                              {report.ledgerReserved.toLocaleString()}
                           </span>
                        </div>
                     </div>

                     {/* Discrepancies List (if any) */}
                     {report.discrepancies.length > 0 && (
                        <div className="space-y-2">
                           <h4 className="text-xs font-semibold text-[#ff5757]">
                              Audit Discrepancies:
                           </h4>
                           <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                              {report.discrepancies.map((d, idx) => (
                                 <div
                                    key={idx}
                                    className="rounded-lg border border-[#333333] bg-[#1a1a1a] p-2.5 text-[11px]"
                                 >
                                    <span className="font-bold text-[#e08a32]">
                                       {d.code}:
                                    </span>{" "}
                                    <span className="text-[#d1d1d1]">
                                       {d.message}
                                    </span>
                                 </div>
                              ))}
                           </div>
                        </div>
                     )}
                  </>
               ) : null}

               <div className="flex justify-end gap-2 pt-2 border-t border-[#242424]">
                  <Button
                     type="button"
                     variant="outline"
                     size="sm"
                     onClick={runAudit}
                     disabled={loading}
                     className="text-xs rounded-xl border-[#333333] bg-[#1c1c1c] text-[#d1d1d1]"
                  >
                     Re-Run Audit
                  </Button>
                  <Button
                     type="button"
                     size="sm"
                     onClick={onClose}
                     className="text-xs rounded-xl bg-[#292929] hover:bg-[#333333] text-[#f4f3f6]"
                  >
                     Close
                  </Button>
               </div>
            </div>
         </div>
      </div>
   );
}
