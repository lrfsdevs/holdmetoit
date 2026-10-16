"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
   Shield,
   UserCheck,
   Trophy,
   Coins,
   Calendar,
   FileText,
   CheckCircle2,
   XCircle,
   AlertTriangle,
   Clock,
   Loader2,
   RotateCcw,
   Wrench,
   ExternalLink,
   Search,
   Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
   getAdminClaimsListAction,
   adminApproveClaimAction,
   adminRejectClaimAction,
   adminRevokeClaimAction,
} from "@/features/ypt/api/ypt-claim.actions";
import {
   getTrophyLeaderboardAction,
   getUserTrophyHistoryAction,
} from "@/features/trophies/api/trophy.actions";
import { AdminTrophyAdjustmentDialog } from "@/features/trophies/presentation/admin-trophy-adjustment-dialog";
import { TrophyRoleBadge } from "@/features/trophies/presentation/trophy-role-badge";
import { YptClaimStatus } from "@/features/ypt/domain/ypt-claim-state-machine";

export function AdminConsoleView() {
   const [activeTab, setActiveTab] = useState<
      "ypt" | "trophies" | "challenges"
   >("ypt");

   // YPT Claims State
   const [claimsFilter, setClaimsFilter] = useState<YptClaimStatus | "ALL">(
      "PENDING"
   );
   const [claimsData, setClaimsData] = useState<{
      claims: any[];
      pagination: any;
      counts: { pending: number; verified: number; rejected: number };
   }>({
      claims: [],
      pagination: { page: 1, limit: 20, totalCount: 0, totalPages: 1 },
      counts: { pending: 0, verified: 0, rejected: 0 },
   });
   const [isLoadingClaims, setIsLoadingClaims] = useState(false);
   const [actionInProgress, setActionInProgress] = useState<string | null>(
      null
   );

   // Reject Modal State
   const [rejectDialogClaim, setRejectDialogClaim] = useState<any | null>(null);
   const [rejectReason, setRejectReason] = useState("");

   // Trophy State
   const [leaderboardEntries, setLeaderboardEntries] = useState<any[]>([]);
   const [selectedAdjustUser, setSelectedAdjustUser] = useState<any | null>(
      null
   );
   const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
   const [trophySearchQuery, setTrophySearchQuery] = useState("");

   const loadClaims = async (statusParam?: YptClaimStatus | "ALL") => {
      setIsLoadingClaims(true);
      try {
         const filter =
            statusParam === "ALL" ? undefined : (statusParam as YptClaimStatus);
         const res = await getAdminClaimsListAction({ status: filter });
         if (res.ok && res.data) {
            setClaimsData(res.data);
         }
      } finally {
         setIsLoadingClaims(false);
      }
   };

   const loadTrophies = async () => {
      const res = await getTrophyLeaderboardAction({ limit: 50 });
      if (res.ok && res.data) {
         setLeaderboardEntries(res.data.entries);
      }
   };

   useEffect(() => {
      if (activeTab === "ypt") {
         void loadClaims(claimsFilter);
      } else if (activeTab === "trophies") {
         void loadTrophies();
      }
   }, [activeTab, claimsFilter]);

   const handleApprove = async (claimId: string) => {
      setActionInProgress(claimId);
      try {
         const res = await adminApproveClaimAction(claimId);
         if (res.ok) {
            await loadClaims(claimsFilter);
         } else {
            alert(res.message || "Failed to approve claim.");
         }
      } finally {
         setActionInProgress(null);
      }
   };

   const handleRejectSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!rejectDialogClaim || !rejectReason.trim()) return;

      setActionInProgress(rejectDialogClaim.id);
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
            alert(res.message || "Failed to reject claim.");
         }
      } finally {
         setActionInProgress(null);
      }
   };

   const handleRevoke = async (claimId: string) => {
      if (
         !confirm(
            "Are you sure you want to revoke this verified YPT identity? The participant's YPT ID will be unlinked."
         )
      ) {
         return;
      }

      setActionInProgress(claimId);
      try {
         const res = await adminRevokeClaimAction(
            claimId,
            "Revoked by administrator via Host Console"
         );
         if (res.ok) {
            await loadClaims(claimsFilter);
         } else {
            alert(res.message || "Failed to revoke claim.");
         }
      } finally {
         setActionInProgress(null);
      }
   };

   return (
      <div className="space-y-6">
         {/* Top Hero Bar */}
         <div className="rounded-3xl border border-obsidian-border bg-obsidian-card p-6 shadow-xl backdrop-blur-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
               <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                     <Shield className="h-6 w-6" />
                  </div>
                  <div>
                     <h1 className="text-xl sm:text-2xl font-bold font-display text-white tracking-tight">
                        Host Administration Console
                     </h1>
                     <p className="text-xs text-obsidian-textDim mt-0.5">
                        Manage verified YPT identity claims, competitive trophy
                        ratings, and study operations.
                     </p>
                  </div>
               </div>

               {/* Navigation Tabs */}
               <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-obsidian-elevated border border-obsidian-borderSubtle">
                  <button
                     type="button"
                     onClick={() => setActiveTab("ypt")}
                     className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                        activeTab === "ypt"
                           ? "bg-economy-gold text-black shadow-md"
                           : "text-obsidian-textMuted hover:text-white"
                     }`}
                  >
                     <UserCheck className="h-3.5 w-3.5" />
                     <span>YPT Verification</span>
                     {claimsData.counts.pending > 0 && (
                        <span className="ml-1 rounded-full bg-rose-500 text-white px-1.5 py-0.2 text-[10px] font-bold">
                           {claimsData.counts.pending}
                        </span>
                     )}
                  </button>

                  <button
                     type="button"
                     onClick={() => setActiveTab("trophies")}
                     className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                        activeTab === "trophies"
                           ? "bg-economy-gold text-black shadow-md"
                           : "text-obsidian-textMuted hover:text-white"
                     }`}
                  >
                     <Trophy className="h-3.5 w-3.5" />
                     <span>Trophy Management</span>
                  </button>

                  <Link
                     href="/challenges"
                     className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-obsidian-textMuted hover:text-white transition-colors"
                  >
                     <Calendar className="h-3.5 w-3.5" />
                     <span>Challenges</span>
                     <ExternalLink className="h-3 w-3" />
                  </Link>
               </div>
            </div>
         </div>

         {/* ------------------------------------------------------------- */}
         {/* TAB 1: YPT VERIFICATION */}
         {/* ------------------------------------------------------------- */}
         {activeTab === "ypt" && (
            <div className="space-y-5">
               {/* Stat Counters */}
               <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div
                     onClick={() => setClaimsFilter("PENDING")}
                     className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                        claimsFilter === "PENDING"
                           ? "border-amber-500/50 bg-amber-500/10 shadow-lg"
                           : "border-obsidian-border bg-obsidian-card hover:bg-obsidian-elevated"
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
                     <span className="text-[11px] text-obsidian-textDim">
                        Awaiting administrator review
                     </span>
                  </div>

                  <div
                     onClick={() => setClaimsFilter("VERIFIED")}
                     className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                        claimsFilter === "VERIFIED"
                           ? "border-emerald-500/50 bg-emerald-500/10 shadow-lg"
                           : "border-obsidian-border bg-obsidian-card hover:bg-obsidian-elevated"
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
                     <span className="text-[11px] text-obsidian-textDim">
                        Active synchronization enabled
                     </span>
                  </div>

                  <div
                     onClick={() => setClaimsFilter("REJECTED")}
                     className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                        claimsFilter === "REJECTED"
                           ? "border-rose-500/50 bg-rose-500/10 shadow-lg"
                           : "border-obsidian-border bg-obsidian-card hover:bg-obsidian-elevated"
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
                     <span className="text-[11px] text-obsidian-textDim">
                        Unverified or invalid claims
                     </span>
                  </div>
               </div>

               {/* Requests List */}
               <div className="rounded-3xl border border-obsidian-border bg-obsidian-card p-6 shadow-xl">
                  <div className="flex items-center justify-between pb-4 border-b border-obsidian-borderSubtle mb-4">
                     <div>
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                           YPT Identity Requests ({claimsFilter})
                        </h2>
                        <p className="text-xs text-obsidian-textDim mt-0.5">
                           Inspect participant identity claims, verify numeric
                           IDs, and confirm ownership.
                        </p>
                     </div>
                     <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void loadClaims(claimsFilter)}
                        disabled={isLoadingClaims}
                        className="text-xs h-8 border-obsidian-borderHighlight bg-obsidian-elevated text-obsidian-textMuted"
                     >
                        {isLoadingClaims ? (
                           <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                           "Refresh"
                        )}
                     </Button>
                  </div>

                  {isLoadingClaims && claimsData.claims.length === 0 ? (
                     <div className="py-12 text-center text-xs text-obsidian-textDim">
                        <Loader2 className="h-6 w-6 animate-spin text-economy-gold mx-auto mb-2" />
                        Loading identity requests...
                     </div>
                  ) : claimsData.claims.length === 0 ? (
                     <div className="py-12 text-center text-xs text-obsidian-textDim">
                        No identity claims found matching filter: {claimsFilter}
                        .
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
                                 className="rounded-2xl border border-obsidian-borderSubtle bg-obsidian-elevated/70 p-4 shadow-sm hover:border-obsidian-borderHighlight transition-colors"
                              >
                                 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    {/* Left: User & Selected Identity Details */}
                                    <div className="flex items-start gap-3.5 min-w-0">
                                       <div className="relative h-10 w-10 rounded-2xl overflow-hidden bg-obsidian-card border border-obsidian-border shrink-0">
                                          {claim.user?.image ? (
                                             <Image
                                                src={claim.user.image}
                                                alt={
                                                   claim.user.displayName ||
                                                   "User"
                                                }
                                                fill
                                                sizes="40px"
                                                className="object-cover"
                                             />
                                          ) : (
                                             <Shield className="h-5 w-5 m-auto text-obsidian-textDim" />
                                          )}
                                       </div>

                                       <div className="min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                             <h3 className="text-sm font-bold text-white">
                                                {claim.user?.displayName ||
                                                   claim.user?.name ||
                                                   "Participant"}
                                             </h3>
                                             <span className="text-xs text-obsidian-textDim font-mono">
                                                @
                                                {claim.user?.username || "user"}
                                             </span>

                                             {/* State Badge */}
                                             <span
                                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                                                   isVerified
                                                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                                      : isPending
                                                        ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                                                        : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                                                }`}
                                             >
                                                {claim.status}
                                             </span>

                                             <span className="text-[10px] text-obsidian-textDim font-mono">
                                                Attempt #{claim.attemptsCount}
                                             </span>
                                          </div>

                                          <div className="mt-1.5 text-xs text-obsidian-textMuted flex items-center gap-3 flex-wrap">
                                             <span>
                                                Selected:{" "}
                                                <strong className="text-white">
                                                   {claim.yptName || "N/A"}
                                                </strong>
                                             </span>
                                             <span>•</span>
                                             <span>
                                                YPT ID:{" "}
                                                <strong className="text-economy-gold font-mono">
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
                                                   This YPT identity is already
                                                   linked to another
                                                   participant.
                                                </span>
                                             </div>
                                          )}

                                          {/* Rejection reason if any */}
                                          {claim.rejectionReason && (
                                             <div className="mt-1.5 text-xs text-rose-300 italic">
                                                Reason: &quot;
                                                {claim.rejectionReason}&quot;
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
                                             onClick={() =>
                                                handleRevoke(claim.id)
                                             }
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
            </div>
         )}

         {/* ------------------------------------------------------------- */}
         {/* TAB 2: TROPHY MANAGEMENT */}
         {/* ------------------------------------------------------------- */}
         {activeTab === "trophies" && (
            <div className="space-y-5">
               {/* Centralized Config Overview */}
               <div className="rounded-3xl border border-obsidian-border bg-obsidian-card p-6 shadow-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-obsidian-borderSubtle">
                     <div>
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                           <Trophy className="h-4 w-4 text-economy-gold" />
                           Trophy System Configuration
                        </h2>
                        <p className="text-xs text-obsidian-textDim mt-0.5">
                           Deterministic Clash of Clans style competitive
                           progression values.
                        </p>
                     </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                     <div className="rounded-xl border border-obsidian-borderSubtle bg-obsidian-elevated p-3">
                        <span className="text-obsidian-textDim block">
                           Win Reward Base
                        </span>
                        <strong className="text-base font-bold text-emerald-400 font-mono">
                           +25 🏆
                        </strong>
                     </div>
                     <div className="rounded-xl border border-obsidian-borderSubtle bg-obsidian-elevated p-3">
                        <span className="text-obsidian-textDim block">
                           Loss Penalty Base
                        </span>
                        <strong className="text-base font-bold text-rose-400 font-mono">
                           -15 🏆
                        </strong>
                     </div>
                     <div className="rounded-xl border border-obsidian-borderSubtle bg-obsidian-elevated p-3">
                        <span className="text-obsidian-textDim block">
                           Draw / Cancelled
                        </span>
                        <strong className="text-base font-bold text-obsidian-text font-mono">
                           0 🏆
                        </strong>
                     </div>
                     <div className="rounded-xl border border-obsidian-borderSubtle bg-obsidian-elevated p-3">
                        <span className="text-obsidian-textDim block">
                           Rating Floor
                        </span>
                        <strong className="text-base font-bold text-yellow-400 font-mono">
                           0 (No Negative)
                        </strong>
                     </div>
                  </div>
               </div>

               {/* Standings & Admin Adjustment Table */}
               <div className="rounded-3xl border border-obsidian-border bg-obsidian-card p-6 shadow-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-obsidian-borderSubtle mb-4">
                     <div>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                           Participant Standings & Ratings
                        </h3>
                        <p className="text-xs text-obsidian-textDim mt-0.5">
                           Audited manual adjustments may be issued for
                           tournament corrections.
                        </p>
                     </div>

                     {/* Search User Input */}
                     <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-obsidian-textDim" />
                        <Input
                           type="text"
                           placeholder="Filter participants..."
                           value={trophySearchQuery}
                           onChange={(e) =>
                              setTrophySearchQuery(e.target.value)
                           }
                           className="rounded-xl border-obsidian-border bg-obsidian-elevated pl-8 text-xs text-white"
                        />
                     </div>
                  </div>

                  <div className="divide-y divide-obsidian-borderSubtle">
                     {leaderboardEntries
                        .filter((u) => {
                           if (!trophySearchQuery.trim()) return true;
                           const q = trophySearchQuery.toLowerCase();
                           return (
                              u.displayName.toLowerCase().includes(q) ||
                              u.username.toLowerCase().includes(q)
                           );
                        })
                        .map((u) => (
                           <div
                              key={u.userId}
                              className="py-3 flex items-center justify-between gap-3 text-xs"
                           >
                              <div className="flex items-center gap-3 min-w-0">
                                 <span className="font-mono text-xs font-bold text-obsidian-textDim w-6 text-center">
                                    #{u.rank}
                                 </span>
                                 <div className="truncate">
                                    <span className="font-bold text-white">
                                       {u.displayName}
                                    </span>
                                    <span className="text-obsidian-textDim pl-1.5 font-mono">
                                       (@{u.username})
                                    </span>
                                 </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                 <TrophyRoleBadge
                                    trophies={u.trophyBalance}
                                    size="sm"
                                 />
                                 <span className="hidden sm:inline font-mono text-obsidian-textDim">
                                    {u.wins}W / {u.losses}L ({u.winRate}%)
                                 </span>
                                 <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                       setSelectedAdjustUser({
                                          id: u.userId,
                                          displayName: u.displayName,
                                          username: u.username,
                                          currentTrophies: u.trophyBalance,
                                       });
                                       setIsAdjustModalOpen(true);
                                    }}
                                    className="text-xs h-7 px-2 border-obsidian-borderHighlight bg-obsidian-elevated text-obsidian-textMuted hover:text-white"
                                 >
                                    <Wrench className="h-3 w-3 mr-1" />
                                    Adjust
                                 </Button>
                              </div>
                           </div>
                        ))}
                  </div>
               </div>
            </div>
         )}

         {/* Reject Reason Dialog */}
         {rejectDialogClaim && (
            <div
               className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
               role="dialog"
               aria-modal="true"
            >
               <div className="relative w-full max-w-md rounded-3xl border border-rose-500/40 bg-obsidian-card p-6 shadow-2xl backdrop-blur-xl">
                  <h3 className="text-sm font-bold text-white">
                     Reject YPT Identity Claim
                  </h3>
                  <p className="text-xs text-obsidian-textDim mt-1">
                     Provide a clear reason for rejecting{" "}
                     <strong className="text-white">
                        {rejectDialogClaim.yptName || rejectDialogClaim.yptId}
                     </strong>
                     . The participant will see this feedback.
                  </p>

                  <form
                     onSubmit={handleRejectSubmit}
                     className="mt-4 space-y-3"
                  >
                     <Input
                        type="text"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="e.g. YPT numeric ID did not match group roster"
                        className="rounded-xl border-obsidian-border bg-obsidian-elevated text-xs text-white"
                        required
                        autoFocus
                     />

                     <div className="flex items-center justify-end gap-2 pt-2">
                        <Button
                           type="button"
                           variant="outline"
                           size="sm"
                           onClick={() => setRejectDialogClaim(null)}
                           className="text-xs rounded-xl border-obsidian-borderSubtle bg-obsidian-elevated"
                        >
                           Cancel
                        </Button>
                        <Button
                           type="submit"
                           size="sm"
                           disabled={
                              !rejectReason.trim() ||
                              actionInProgress === rejectDialogClaim.id
                           }
                           className="text-xs rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold"
                        >
                           {actionInProgress === rejectDialogClaim.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                           ) : (
                              "Confirm Rejection"
                           )}
                        </Button>
                     </div>
                  </form>
               </div>
            </div>
         )}

         {/* Admin Trophy Adjustment Dialog */}
         {isAdjustModalOpen && selectedAdjustUser && (
            <AdminTrophyAdjustmentDialog
               isOpen={isAdjustModalOpen}
               onClose={() => {
                  setIsAdjustModalOpen(false);
                  setSelectedAdjustUser(null);
               }}
               targetUser={selectedAdjustUser}
               onSuccess={() => void loadTrophies()}
            />
         )}
      </div>
   );
}
