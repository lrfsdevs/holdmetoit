"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
   CheckCircle2,
   AlertCircle,
   Clock,
   Loader2,
   ShieldCheck,
   Send,
   RefreshCw,
   UserSearch,
   Sparkles,
} from "lucide-react";
import { YptMemberSelector } from "./ypt-member-selector";
import {
   getYptConnectionStatusAction,
   syncYptStudyNowAction,
} from "../api/ypt-connection.actions";
import { submitYptSelectionAction } from "../api/ypt-claim.actions";
import type { YptRosterEntry } from "../data/ypt-claim.repository";
import type { YptConnectionSummary } from "../data/ypt-connection.repository";

interface YptSettingsCardProps {
   initialYptId?: string | null;
}

export function YptSettingsCard({ initialYptId }: YptSettingsCardProps) {
   const [connection, setConnection] = useState<YptConnectionSummary | null>(
      null
   );
   const [isLoadingStatus, setIsLoadingStatus] = useState(false);

   // Member Selection State
   const [selectedMember, setSelectedMember] = useState<YptRosterEntry | null>(
      null
   );
   const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);

   // Study Sync State
   const [isSyncing, setIsSyncing] = useState(false);
   const [syncFeedback, setSyncFeedback] = useState<{
      type: "success" | "error";
      message: string;
   } | null>(null);

   const [actionMessage, setActionMessage] = useState<{
      type: "success" | "error";
      text: string;
   } | null>(null);

   const loadStatus = async () => {
      setIsLoadingStatus(true);
      try {
         const res = await getYptConnectionStatusAction();
         if (res.ok && res.data) {
            setConnection(res.data);
         }
      } finally {
         setIsLoadingStatus(false);
      }
   };

   useEffect(() => {
      void loadStatus();
   }, []);

   // Select Member & Submit Verification Request
   const handleSubmitClaim = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedMember) {
         setActionMessage({
            type: "error",
            text: "Please select your YPT account from the list.",
         });
         return;
      }

      setIsSubmittingClaim(true);
      setActionMessage(null);

      try {
         const res = await submitYptSelectionAction({
            yptUserId: selectedMember.yptUserId,
            yptNickname: selectedMember.nickname,
            groupId: selectedMember.groupIds?.[0]
               ? String(selectedMember.groupIds[0])
               : undefined,
         });

         if (res.ok) {
            setActionMessage({
               type: "success",
               text: "Verification request submitted. A developer will confirm your account shortly.",
            });
            setSelectedMember(null);
            void loadStatus();
         } else {
            setActionMessage({
               type: "error",
               text: res.message || "Failed to submit verification request.",
            });
         }
      } catch (err) {
         setActionMessage({
            type: "error",
            text:
               err instanceof Error
                  ? err.message
                  : "Failed to submit verification request.",
         });
      } finally {
         setIsSubmittingClaim(false);
      }
   };

   // Manual Study Synchronization Handler
   const handleSyncNow = async () => {
      setIsSyncing(true);
      setSyncFeedback(null);

      try {
         const res = await syncYptStudyNowAction();
         if (res.ok) {
            const minutes = Math.floor((res.importedDurationSeconds || 0) / 60);
            setSyncFeedback({
               type: "success",
               message: `Synchronization complete. Study time imported: ${minutes}m. Coins credited: ${res.coinsCredited || 0}.`,
            });
            void loadStatus();
         } else {
            setSyncFeedback({
               type: "error",
               message: res.message || "Study synchronization failed.",
            });
         }
      } catch (err) {
         setSyncFeedback({
            type: "error",
            message:
               err instanceof Error
                  ? err.message
                  : "Network error during sync.",
         });
      } finally {
         setIsSyncing(false);
      }
   };

   const status = connection?.status || "NOT_CONNECTED";
   const isVerified =
      status === "VERIFIED" || Boolean(!connection && initialYptId);
   const isPending =
      status === "PENDING_VERIFICATION" ||
      connection?.activeClaim?.status === "PENDING";
   const isRejected = status === "REJECTED";
   const showSelector = !isVerified && !isPending;

   return (
      <div
         className="rounded-2xl border border-border-default bg-surface-primary p-5 shadow-lg backdrop-blur-md"
         data-testid="ypt-settings-card"
      >
         {/* Card Header */}
         <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-border-subtle">
            <div>
               <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-1/10 text-brand-1 font-bold text-xs">
                     Y
                  </span>
                  Yeolpumta (YPT) Study Integration
               </h3>
               <p className="text-xs text-text-tertiary mt-1">
                  Link your Yeolpumta account for automatic study
                  synchronization and coin rewards.
               </p>
            </div>

            {/* Current Status Badge */}
            <div className="shrink-0">
               {isLoadingStatus ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-text-tertiary px-2.5 py-1 rounded-full bg-surface-elevated border border-border-subtle">
                     <Loader2 className="h-3 w-3 animate-spin text-brand-1" />
                     Checking status...
                  </span>
               ) : isVerified ? (
                  <span
                     data-testid="ypt-verified-badge"
                     className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                  >
                     <CheckCircle2 className="h-3.5 w-3.5" />✓ YPT Verified
                  </span>
               ) : isPending ? (
                  <span
                     data-testid="ypt-pending-badge"
                     className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 animate-pulse"
                  >
                     <Clock className="h-3.5 w-3.5" />
                     Verification Pending
                  </span>
               ) : isRejected ? (
                  <span
                     data-testid="ypt-rejected-badge"
                     className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-400 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30"
                  >
                     <AlertCircle className="h-3.5 w-3.5" />
                     Verification Rejected
                  </span>
               ) : (
                  <span
                     data-testid="ypt-unlinked-badge"
                     className="inline-flex items-center gap-1.5 text-xs font-medium text-text-tertiary px-3 py-1 rounded-full bg-surface-elevated border border-border-subtle"
                  >
                     Not linked
                  </span>
               )}
            </div>
         </div>

         {/* Body Content */}
         <div className="mt-4 space-y-4">
            {/* 1. STATE: VERIFIED */}
            {isVerified && (
               <div className="space-y-3">
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                     <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-emerald-500/15 border-emerald-500/30 text-emerald-400">
                           <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div>
                           <h4 className="text-sm font-bold text-white flex items-center gap-2">
                              <span>
                                 {connection?.yptNickname ||
                                    "Verified Participant"}
                              </span>
                              <span className="text-meta font-mono font-medium text-emerald-400">
                                 YPT ID: {connection?.yptUserId || initialYptId}
                              </span>
                           </h4>
                           <p className="text-xs mt-0.5 text-emerald-300/80">
                              Study synchronization is active. Your verified
                              Yeolpumta hours credit virtual coin rewards and
                              count toward your challenge.
                           </p>
                           {connection?.lastSyncedAt && (
                              <p className="text-meta text-text-tertiary mt-1 flex items-center gap-1">
                                 <Clock className="h-3 w-3" />
                                 Last synchronized:{" "}
                                 {new Date(
                                    connection.lastSyncedAt
                                 ).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                 })}
                              </p>
                           )}
                        </div>
                     </div>

                     <div className="flex items-center gap-2 shrink-0">
                        <Button
                           type="button"
                           variant="gold"
                           size="sm"
                           onClick={handleSyncNow}
                           disabled={isSyncing}
                           className="rounded-xl text-xs font-bold gap-1.5 shadow-md"
                        >
                           {isSyncing ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                           ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                           )}
                           {isSyncing ? "Synchronizing..." : "Refresh my hours"}
                        </Button>
                     </div>
                  </div>

                  {/* Sync Feedback Message */}
                  {syncFeedback && (
                     <div
                        className={`rounded-xl p-3 text-xs flex items-center gap-2 ${
                           syncFeedback.type === "success"
                              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                              : "bg-rose-500/10 border border-rose-500/30 text-rose-400"
                        }`}
                     >
                        {syncFeedback.type === "success" ? (
                           <Sparkles className="h-4 w-4 shrink-0 text-brand-1" />
                        ) : (
                           <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                        )}
                        <span>{syncFeedback.message}</span>
                     </div>
                  )}
               </div>
            )}

            {/* 2. STATE: PENDING VERIFICATION */}
            {isPending && !isVerified && (
               <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                  <div className="flex items-start gap-3">
                     <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                        <Clock className="h-5 w-5 animate-spin" />
                     </div>
                     <div className="flex-1">
                        <h4 className="text-sm font-bold text-white">
                           Verification Pending
                        </h4>
                        <p className="text-xs text-amber-200/90 mt-1">
                           Waiting for a developer to confirm this identity:
                        </p>
                        <div className="mt-2.5 rounded-lg border border-amber-500/20 bg-black/40 p-2.5 flex items-center justify-between text-xs">
                           <div>
                              <span className="text-label text-text-tertiary block">
                                 Selected Identity
                              </span>
                              <strong className="text-white">
                                 {connection?.activeClaim?.yptName ||
                                    connection?.yptNickname ||
                                    "Community Member"}
                              </strong>
                           </div>
                           <div className="text-right">
                              <span className="text-label text-text-tertiary block">
                                 YPT ID
                              </span>
                              <span className="font-mono font-bold text-brand-1">
                                 {connection?.activeClaim?.yptId ||
                                    connection?.yptUserId}
                              </span>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            )}

            {/* 3. STATE: REJECTED */}
            {isRejected && (
               <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
                  <div className="flex items-start gap-3">
                     <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400">
                        <AlertCircle className="h-5 w-5" />
                     </div>
                     <div className="flex-1">
                        <h4 className="text-sm font-bold text-rose-300">
                           Verification Rejected
                        </h4>
                        <p className="text-xs text-rose-200/80 mt-1">
                           Your selected YPT identity could not be verified
                           {connection?.activeClaim?.rejectionReason
                              ? `: "${connection.activeClaim.rejectionReason}"`
                              : "."}
                        </p>
                        <p className="text-xs text-text-tertiary mt-1">
                           Please select your correct account from the group
                           member list below.
                        </p>
                     </div>
                  </div>
               </div>
            )}

            {/* 4. STATE: SELECT IDENTITY (not verified / not pending) */}
            {showSelector && (
               <div className="space-y-4">
                  <div className="rounded-xl border border-border-subtle bg-surface-elevated/40 p-4">
                     <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-1/10 border border-brand-1/20 text-brand-1">
                           <UserSearch className="h-5 w-5" />
                        </div>
                        <div>
                           <h4 className="text-sm font-bold text-white">
                              Find your Yeolpumta account
                           </h4>
                           <p className="text-xs text-text-tertiary mt-1">
                              Choose your account from the group member list
                              below. A developer verifies every request before
                              your hours are credited.
                           </p>
                        </div>
                     </div>
                  </div>

                  <form onSubmit={handleSubmitClaim} className="space-y-3">
                     <YptMemberSelector
                        selectedMember={selectedMember}
                        onSelectMember={(m) => {
                           setSelectedMember(m);
                           setActionMessage(null);
                        }}
                        disabled={isSubmittingClaim}
                     />

                     <div className="flex justify-end">
                        <Button
                           type="submit"
                           variant="gold"
                           size="sm"
                           disabled={isSubmittingClaim || !selectedMember}
                           className="rounded-xl text-xs font-bold gap-1.5 shadow-md"
                        >
                           {isSubmittingClaim ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                           ) : (
                              <Send className="h-3.5 w-3.5" />
                           )}
                           Request Verification
                        </Button>
                     </div>
                  </form>
               </div>
            )}

            {/* General Action Notification */}
            {actionMessage && (
               <div
                  className={`flex items-center gap-2 rounded-xl p-3 text-xs ${
                     actionMessage.type === "success"
                        ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                        : "bg-rose-500/10 border border-rose-500/30 text-rose-400"
                  }`}
               >
                  {actionMessage.type === "success" ? (
                     <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                     <AlertCircle className="h-4 w-4 shrink-0" />
                  )}
                  <span>{actionMessage.text}</span>
               </div>
            )}
         </div>
      </div>
   );
}
