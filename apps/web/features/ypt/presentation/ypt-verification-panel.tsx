"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
   Shield,
   CheckCircle2,
   XCircle,
   AlertTriangle,
   Clock,
   Loader2,
   RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
   AlertDialog,
   AlertDialogAction,
   AlertDialogCancel,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
   getAdminClaimsListAction,
   adminApproveClaimAction,
   adminRejectClaimAction,
   adminRevokeClaimAction,
} from "../api/ypt-claim.actions";
import { YptClaimStatus } from "../domain/ypt-claim-state-machine";

interface ClaimsData {
   claims: any[];
   pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
   };
   counts: { pending: number; verified: number; rejected: number };
}

const EMPTY_CLAIMS: ClaimsData = {
   claims: [],
   pagination: { page: 1, limit: 20, totalCount: 0, totalPages: 1 },
   counts: { pending: 0, verified: 0, rejected: 0 },
};

/**
 * DEV-only YPT identity verification surface, hosted inside the DevBoard.
 * Backed by the dev-guarded YPT claim actions.
 */
export function YptVerificationPanel() {
   const [claimsFilter, setClaimsFilter] = useState<YptClaimStatus | "ALL">(
      "PENDING"
   );
   const [claimsData, setClaimsData] = useState<ClaimsData>(EMPTY_CLAIMS);
   const [isLoading, setIsLoading] = useState(false);
   const [actionInProgress, setActionInProgress] = useState<string | null>(
      null
   );
   const [error, setError] = useState<string | null>(null);

   const [rejectDialogClaim, setRejectDialogClaim] = useState<any | null>(null);
   const [rejectReason, setRejectReason] = useState("");
   const [pendingRevoke, setPendingRevoke] = useState<string | null>(null);

   const loadClaims = async (statusParam?: YptClaimStatus | "ALL") => {
      setIsLoading(true);
      setError(null);
      try {
         const filter =
            statusParam === "ALL" ? undefined : (statusParam as YptClaimStatus);
         const res = await getAdminClaimsListAction({ status: filter });
         if (res.ok) {
            setClaimsData(res.data);
         } else {
            setError(res.message || "Failed to load identity requests.");
         }
      } finally {
         setIsLoading(false);
      }
   };

   useEffect(() => {
      void loadClaims(claimsFilter);
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [claimsFilter]);

   const handleApprove = async (claimId: string) => {
      setActionInProgress(claimId);
      setError(null);
      try {
         const res = await adminApproveClaimAction(claimId);
         if (res.ok) {
            await loadClaims(claimsFilter);
         } else {
            setError(res.message || "Failed to approve claim.");
         }
      } finally {
         setActionInProgress(null);
      }
   };

   const handleRejectSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!rejectDialogClaim || !rejectReason.trim()) return;

      setActionInProgress(rejectDialogClaim.id);
      setError(null);
      try {
         const res = await adminRejectClaimAction(
            rejectDialogClaim.id,
            rejectReason.trim()
         );
         if (res.ok) {
            setRejectDialogClaim(null);
            setRejectReason("");
            await loadClaims(claimsFilter);
         } else {
            setError(res.message || "Failed to reject claim.");
         }
      } finally {
         setActionInProgress(null);
      }
   };

   const handleRevoke = (claimId: string) => {
      setPendingRevoke(claimId);
   };

   const confirmRevoke = async () => {
      if (!pendingRevoke) return;
      const claimId = pendingRevoke;
      setPendingRevoke(null);

      setActionInProgress(claimId);
      setError(null);
      try {
         const res = await adminRevokeClaimAction(
            claimId,
            "Revoked by developer via DevBoard"
         );
         if (res.ok) {
            await loadClaims(claimsFilter);
         } else {
            setError(res.message || "Failed to revoke claim.");
         }
      } finally {
         setActionInProgress(null);
      }
   };

   return (
      <div className="space-y-5">
         {/* Inline error (non-blocking) */}
         {error && (
            <div
               role="alert"
               className="flex items-start gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300"
            >
               <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
               <span>{error}</span>
            </div>
         )}

         {/* Stat Counters (clickable filters) */}
         <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
               type="button"
               onClick={() => setClaimsFilter("PENDING")}
               aria-pressed={claimsFilter === "PENDING"}
               className={`text-left rounded-2xl border p-4 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${
                  claimsFilter === "PENDING"
                     ? "border-amber-500/50 bg-amber-500/10 shadow-lg"
                     : "border-border-default bg-surface-primary hover:bg-surface-elevated"
               }`}
            >
               <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                     Pending Requests
                  </span>
                  <Clock className="h-4 w-4 text-amber-400" />
               </div>
               <div className="text-2xl font-bold font-display text-white mt-2">
                  {claimsData.counts.pending}
               </div>
               <span className="text-meta text-text-tertiary">
                  Awaiting developer review
               </span>
            </button>

            <button
               type="button"
               onClick={() => setClaimsFilter("VERIFIED")}
               aria-pressed={claimsFilter === "VERIFIED"}
               className={`text-left rounded-2xl border p-4 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${
                  claimsFilter === "VERIFIED"
                     ? "border-emerald-500/50 bg-emerald-500/10 shadow-lg"
                     : "border-border-default bg-surface-primary hover:bg-surface-elevated"
               }`}
            >
               <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                     Verified Identities
                  </span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
               </div>
               <div className="text-2xl font-bold font-display text-white mt-2">
                  {claimsData.counts.verified}
               </div>
               <span className="text-meta text-text-tertiary">
                  Active synchronization enabled
               </span>
            </button>

            <button
               type="button"
               onClick={() => setClaimsFilter("REJECTED")}
               aria-pressed={claimsFilter === "REJECTED"}
               className={`text-left rounded-2xl border p-4 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${
                  claimsFilter === "REJECTED"
                     ? "border-rose-500/50 bg-rose-500/10 shadow-lg"
                     : "border-border-default bg-surface-primary hover:bg-surface-elevated"
               }`}
            >
               <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
                     Rejected Requests
                  </span>
                  <XCircle className="h-4 w-4 text-rose-400" />
               </div>
               <div className="text-2xl font-bold font-display text-white mt-2">
                  {claimsData.counts.rejected}
               </div>
               <span className="text-meta text-text-tertiary">
                  Unverified or invalid claims
               </span>
            </button>
         </div>

         {/* Requests List */}
         <div className="rounded-3xl border border-border-default bg-surface-primary p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-border-subtle mb-4">
               <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                     YPT Identity Requests ({claimsFilter})
                  </h2>
                  <p className="text-xs text-text-tertiary mt-0.5">
                     Inspect participant identity claims, verify numeric IDs,
                     and confirm ownership.
                  </p>
               </div>
               <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void loadClaims(claimsFilter)}
                  disabled={isLoading}
                  className="text-xs h-8 border-border-strong bg-surface-elevated text-text-secondary"
               >
                  {isLoading ? (
                     <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                     "Refresh"
                  )}
               </Button>
            </div>

            {isLoading && claimsData.claims.length === 0 ? (
               <div className="py-12 text-center text-xs text-text-tertiary">
                  <Loader2 className="h-6 w-6 animate-spin text-brand-1 mx-auto mb-2" />
                  Loading identity requests...
               </div>
            ) : claimsData.claims.length === 0 ? (
               <div className="py-12 text-center text-xs text-text-tertiary">
                  No identity claims found matching filter: {claimsFilter}.
               </div>
            ) : (
               <div className="space-y-3.5">
                  {claimsData.claims.map((claim) => {
                     const isPending = claim.status === "PENDING";
                     const isVerified = claim.status === "VERIFIED";
                     const isBusy = actionInProgress === claim.id;

                     return (
                        <div
                           key={claim.id}
                           className="rounded-2xl border border-border-subtle bg-surface-elevated/70 p-4 shadow-sm hover:border-border-strong transition-colors"
                        >
                           <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                              {/* Left: User & Selected Identity Details */}
                              <div className="flex items-start gap-3.5 min-w-0">
                                 <div className="relative h-10 w-10 rounded-2xl overflow-hidden bg-surface-primary border border-border-default shrink-0">
                                    {claim.user?.image ? (
                                       <Image
                                          src={claim.user.image}
                                          alt={claim.user.displayName || "User"}
                                          fill
                                          sizes="40px"
                                          className="object-cover"
                                       />
                                    ) : (
                                       <Shield className="h-5 w-5 m-auto text-text-tertiary" />
                                    )}
                                 </div>

                                 <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                       <h3 className="text-sm font-bold text-white">
                                          {claim.user?.displayName ||
                                             claim.user?.name ||
                                             "Participant"}
                                       </h3>
                                       <span className="text-xs text-text-tertiary font-mono">
                                          @{claim.user?.username || "user"}
                                       </span>

                                       {/* State Badge */}
                                       <span
                                          className={`text-label px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                                             isVerified
                                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                                : isPending
                                                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                                                  : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                                          }`}
                                       >
                                          {claim.status}
                                       </span>

                                       <span className="text-label text-text-tertiary font-mono">
                                          Attempt #{claim.attemptsCount}
                                       </span>
                                    </div>

                                    <div className="mt-1.5 text-xs text-text-secondary flex items-center gap-3 flex-wrap">
                                       <span>
                                          Selected:{" "}
                                          <strong className="text-white">
                                             {claim.yptName || "N/A"}
                                          </strong>
                                       </span>
                                       <span>•</span>
                                       <span>
                                          YPT ID:{" "}
                                          <strong className="text-brand-1 font-mono">
                                             {claim.yptId}
                                          </strong>
                                       </span>
                                       <span>•</span>
                                       <span>
                                          Requested:{" "}
                                          {new Date(
                                             claim.createdAt
                                          ).toLocaleDateString()}
                                       </span>
                                    </div>

                                    {/* Warning banner if duplicate */}
                                    {claim.alreadyLinkedToAnother && (
                                       <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-rose-400 font-medium bg-rose-500/10 border border-rose-500/30 px-2.5 py-1 rounded-lg">
                                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                          <span>
                                             This YPT identity is already linked
                                             to another participant.
                                          </span>
                                       </div>
                                    )}

                                    {/* Rejection reason if any */}
                                    {claim.rejectionReason && (
                                       <div className="mt-1.5 text-xs text-rose-300 italic">
                                          Reason: &quot;{claim.rejectionReason}
                                          &quot;
                                       </div>
                                    )}
                                 </div>
                              </div>

                              {/* Right: Actions */}
                              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                                 {isPending && (
                                    <>
                                       <Button
                                          type="button"
                                          variant="gold"
                                          size="sm"
                                          disabled={
                                             isBusy ||
                                             claim.alreadyLinkedToAnother
                                          }
                                          onClick={() =>
                                             handleApprove(claim.id)
                                          }
                                          className="text-xs font-bold gap-1 rounded-xl"
                                       >
                                          {isBusy ? (
                                             <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                             <CheckCircle2 className="h-3.5 w-3.5" />
                                          )}
                                          Confirm Identity
                                       </Button>
                                       <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          disabled={isBusy}
                                          onClick={() => {
                                             setRejectDialogClaim(claim);
                                             setRejectReason("");
                                          }}
                                          className="text-xs font-semibold gap-1 rounded-xl border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                                       >
                                          <XCircle className="h-3.5 w-3.5" />
                                          Reject
                                       </Button>
                                    </>
                                 )}

                                 {isVerified && (
                                    <Button
                                       type="button"
                                       variant="outline"
                                       size="sm"
                                       disabled={isBusy}
                                       onClick={() => handleRevoke(claim.id)}
                                       className="text-xs font-semibold gap-1 rounded-xl border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                                    >
                                       <RotateCcw className="h-3 w-3" />
                                       Revoke Link
                                    </Button>
                                 )}
                              </div>
                           </div>
                        </div>
                     );
                  })}
               </div>
            )}
         </div>

         {/* Revoke Confirmation */}
         <AlertDialog
            open={Boolean(pendingRevoke)}
            onOpenChange={(open) => {
               if (!open) setPendingRevoke(null);
            }}
         >
            <AlertDialogContent>
               <AlertDialogHeader>
                  <AlertDialogTitle>Revoke YPT identity?</AlertDialogTitle>
                  <AlertDialogDescription>
                     This participant&apos;s YPT ID will be unlinked and their
                     study synchronization disabled.
                  </AlertDialogDescription>
               </AlertDialogHeader>
               <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void confirmRevoke()}>
                     Revoke link
                  </AlertDialogAction>
               </AlertDialogFooter>
            </AlertDialogContent>
         </AlertDialog>

         {/* Reject Reason Dialog */}
         <AlertDialog
            open={Boolean(rejectDialogClaim)}
            onOpenChange={(open) => {
               if (!open) {
                  setRejectDialogClaim(null);
                  setRejectReason("");
               }
            }}
         >
            <AlertDialogContent className="border-rose-500/40">
               <AlertDialogHeader>
                  <AlertDialogTitle>Reject YPT Identity Claim</AlertDialogTitle>
                  <AlertDialogDescription>
                     Provide a clear reason for rejecting{" "}
                     <strong className="text-white">
                        {rejectDialogClaim?.yptName || rejectDialogClaim?.yptId}
                     </strong>
                     . The participant will see this feedback.
                  </AlertDialogDescription>
               </AlertDialogHeader>

               <form onSubmit={handleRejectSubmit} className="space-y-3">
                  <Input
                     type="text"
                     value={rejectReason}
                     onChange={(e) => setRejectReason(e.target.value)}
                     placeholder="e.g. YPT numeric ID did not match group roster"
                     className="rounded-xl border-border-default bg-surface-elevated text-xs text-white"
                     required
                     autoFocus
                  />
                  <AlertDialogFooter>
                     <AlertDialogCancel
                        onClick={() => {
                           setRejectDialogClaim(null);
                           setRejectReason("");
                        }}
                     >
                        Cancel
                     </AlertDialogCancel>
                     <Button
                        type="submit"
                        size="sm"
                        disabled={
                           !rejectReason.trim() ||
                           actionInProgress === rejectDialogClaim?.id
                        }
                        className="text-xs rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold"
                     >
                        {actionInProgress === rejectDialogClaim?.id ? (
                           <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                           "Confirm Rejection"
                        )}
                     </Button>
                  </AlertDialogFooter>
               </form>
            </AlertDialogContent>
         </AlertDialog>
      </div>
   );
}
