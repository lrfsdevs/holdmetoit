"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
      <Dialog
         open={isOpen}
         onOpenChange={(open) => {
            if (!open) onClose();
         }}
      >
         <DialogContent className="max-w-lg rounded-2xl border-border-default bg-surface-primary text-text-primary p-6">
            <div className="flex items-center gap-2.5 mb-4">
               <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-feedback-success/30 bg-feedback-success/10 text-feedback-success">
                  <ShieldCheck className="h-5 w-5" />
               </div>
               <div>
                  <h3 className="text-base font-semibold text-text-primary">
                     Wallet & Ledger Reconciliation
                  </h3>
                  <p className="text-xs text-text-tertiary">
                     Mathematical integrity audit comparing wallet accounting
                     totals to append-only ledger deltas.
                  </p>
               </div>
            </div>

            <div className="space-y-4">
               {loading ? (
                  <div className="flex flex-col items-center justify-center py-10">
                     <Loader2 className="h-7 w-7 animate-spin text-brand-1 mb-2" />
                     <p className="text-xs text-text-tertiary">
                        Auditing wallet balance against ledger transactions...
                     </p>
                  </div>
               ) : error ? (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive">
                     {error}
                  </div>
               ) : report ? (
                  <>
                     {/* Audit Banner */}
                     <div
                        className={`rounded-xl p-4 flex items-center gap-3 border ${
                           report.isReconciled
                              ? "bg-feedback-success/10 border-feedback-success/30 text-feedback-success"
                              : "bg-destructive/10 border-destructive/30 text-destructive"
                        }`}
                     >
                        {report.isReconciled ? (
                           <CheckCircle2 className="h-5 w-5 shrink-0 text-feedback-success" />
                        ) : (
                           <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
                        )}
                        <div>
                           <p className="text-xs font-semibold">
                              {report.isReconciled
                                 ? "100% Invariant Compliant — All Balances Match"
                                 : "Accounting Discrepancies Detected"}
                           </p>
                           <p className="text-meta opacity-80 mt-0.5">
                              {report.isReconciled
                                 ? "Wallet balance, reserved commitments, and ledger deltas are in exact mathematical alignment."
                                 : `${report.discrepancies.length} discrepancy item(s) found during ledger reconciliation.`}
                           </p>
                        </div>
                     </div>

                     {/* Breakdown Grid */}
                     <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="rounded-xl border border-border-subtle bg-surface-tertiary p-3">
                           <span className="text-text-tertiary">
                              Wallet Total Balance
                           </span>
                           <p className="font-mono text-base font-bold text-text-primary mt-1">
                              {report.walletTotal.toLocaleString()} coins
                           </p>
                           <span className="text-label text-text-tertiary">
                              Ledger delta:{" "}
                              {report.ledgerTotal.toLocaleString()}
                           </span>
                        </div>

                        <div className="rounded-xl border border-border-subtle bg-surface-tertiary p-3">
                           <span className="text-text-tertiary">
                              Reserved Balance
                           </span>
                           <p className="font-mono text-base font-bold text-text-primary mt-1">
                              {report.walletReserved.toLocaleString()} coins
                           </p>
                           <span className="text-label text-text-tertiary">
                              Ledger delta:{" "}
                              {report.ledgerReserved.toLocaleString()}
                           </span>
                        </div>
                     </div>

                     {/* Discrepancies List (if any) */}
                     {report.discrepancies.length > 0 && (
                        <div className="space-y-2">
                           <h4 className="text-xs font-semibold text-destructive">
                              Audit Discrepancies:
                           </h4>
                           <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                              {report.discrepancies.map((d, idx) => (
                                 <div
                                    key={idx}
                                    className="rounded-lg border border-border-strong bg-surface-tertiary p-2.5 text-meta"
                                 >
                                    <span className="font-bold text-brand-2">
                                       {d.code}:
                                    </span>{" "}
                                    <span className="text-text-secondary">
                                       {d.message}
                                    </span>
                                 </div>
                              ))}
                           </div>
                        </div>
                     )}
                  </>
               ) : null}

               <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
                  <Button
                     type="button"
                     variant="outline"
                     size="sm"
                     onClick={runAudit}
                     disabled={loading}
                     className="text-xs rounded-xl border-border-strong bg-surface-elevated text-text-secondary hover:text-text-primary"
                  >
                     Re-Run Audit
                  </Button>
                  <Button
                     type="button"
                     size="sm"
                     onClick={onClose}
                     className="text-xs rounded-xl bg-surface-nested hover:bg-border-strong text-text-primary"
                  >
                     Close
                  </Button>
               </div>
            </div>
         </DialogContent>
      </Dialog>
   );
}
