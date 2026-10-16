"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
   CheckCircle2,
   AlertCircle,
   Clock,
   Loader2,
   ShieldCheck,
   RotateCcw,
   Send,
   Link2,
   RefreshCw,
   KeyRound,
   ChevronRight,
   LogOut,
   Sparkles,
} from "lucide-react";
import { YptMemberSelector } from "./ypt-member-selector";
import {
   getYptConnectionStatusAction,
   connectYptAccountAction,
   submitYptSelectionAction,
   syncYptStudyNowAction,
   disconnectYptAccountAction,
} from "../api/ypt-connection.actions";
import type { YptRealGroupMemberItem } from "../data/ypt-connection.repository";
import type { YptConnectionSummary } from "../data/ypt-connection.repository";

interface YptSettingsCardProps {
   initialYptId?: string | null;
}

export function YptSettingsCard({ initialYptId }: YptSettingsCardProps) {
   const [connection, setConnection] = useState<YptConnectionSummary | null>(
      null
   );
   const [isLoadingStatus, setIsLoadingStatus] = useState(false);

   // Connection Form Modal / Toggle State
   const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
   const [email, setEmail] = useState("");
   const [password, setPassword] = useState("");
   const [isConnecting, setIsConnecting] = useState(false);

   // Member Selection State
   const [selectedMember, setSelectedMember] =
      useState<YptRealGroupMemberItem | null>(null);
   const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);

   // Study Sync State
   const [isSyncing, setIsSyncing] = useState(false);
   const [syncFeedback, setSyncFeedback] = useState<{
      type: "success" | "error";
      message: string;
      coinsCredited?: number;
      importedMinutes?: number;
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

   // 1. Connect YPT credentials handler
   const handleConnectAccount = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsConnecting(true);
      setActionMessage(null);

      try {
         const res = await connectYptAccountAction({ email, password });
         if (res.ok && res.data) {
            setActionMessage({
               type: "success",
               text: `Connected to Yeolpumta as ${res.data.yptNickname || res.data.yptUserId}! ${
                  res.data.status === "VERIFIED"
                     ? "Study synchronization is now active."
                     : "Now select your group identity below."
               }`,
            });
            setIsConnectModalOpen(false);
            setPassword("");
            void loadStatus();
         } else {
            setPassword("");
            setActionMessage({
               type: "error",
               text: res.message || "Failed to authenticate with Yeolpumta.",
            });
         }
      } catch (err) {
         setPassword("");
         setActionMessage({
            type: "error",
            text: err instanceof Error ? err.message : "Connection failed.",
         });
      } finally {
         setIsConnecting(false);
      }
   };

   // 2. Select Member & Submit Verification Claim
   const handleSubmitClaim = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedMember) {
         setActionMessage({
            type: "error",
            text: "Please select your YPT identity from the list.",
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

         if (res.ok && res.data) {
            setActionMessage({
               type: "success",
               text: "Verification request submitted! Waiting for an administrator to confirm.",
            });
            void loadStatus();
         } else {
            setActionMessage({
               type: "error",
               text: res.message || "Failed to submit verification claim.",
            });
         }
      } catch (err) {
         setActionMessage({
            type: "error",
            text:
               err instanceof Error ? err.message : "Failed to submit claim.",
         });
      } finally {
         setIsSubmittingClaim(false);
      }
   };

   // 3. Manual Study Synchronization Handler
   const handleSyncNow = async () => {
      setIsSyncing(true);
      setSyncFeedback(null);

      try {
         const res = await syncYptStudyNowAction();
         if (res.ok) {
            const minutes = Math.floor((res.importedDurationSeconds || 0) / 60);
            setSyncFeedback({
               type: "success",
               message: `Synchronization Complete. Study time imported: ${minutes}m. Coins credited: ${res.coinsCredited || 0}.`,
               coinsCredited: res.coinsCredited,
               importedMinutes: minutes,
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

   // 4. Disconnect Handler
   const handleDisconnect = async () => {
      if (
         !confirm(
            "Are you sure you want to disconnect your Yeolpumta integration?"
         )
      ) {
         return;
      }
      try {
         await disconnectYptAccountAction();
         setActionMessage({
            type: "success",
            text: "Yeolpumta account disconnected.",
         });
         void loadStatus();
      } catch (err) {
         setActionMessage({
            type: "error",
            text: "Failed to disconnect.",
         });
      }
   };

   const status = connection?.status || "NOT_CONNECTED";
   const isVerified =
      status === "VERIFIED" || Boolean(!connection && initialYptId);
   const isPending =
      status === "PENDING_VERIFICATION" ||
      connection?.activeClaim?.status === "PENDING";
   const isConnected = status === "CONNECTED";
   const isRejected = status === "REJECTED";
   const isSyncError = status === "SYNC_ERROR";
   const isReauthRequired = status === "REAUTHENTICATION_REQUIRED";

   return (
      <div
         className="rounded-2xl border border-obsidian-border bg-obsidian-card p-5 shadow-lg backdrop-blur-md"
         data-testid="ypt-settings-card"
      >
         {/* Card Header */}
         <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-obsidian-borderSubtle">
            <div>
               <h3 className="text-sm font-semibold text-obsidian-text flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-economy-gold/10 text-economy-gold font-bold text-xs">
                     Y
                  </span>
                  Yeolpumta (YPT) Study Integration
               </h3>
               <p className="text-xs text-obsidian-textDim mt-1">
                  Connect your Yeolpumta ID for companion bot synchronization
                  and automated coin rewards.
               </p>
            </div>

            {/* Current Status Badge */}
            <div className="shrink-0">
               {isLoadingStatus ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-obsidian-textDim px-2.5 py-1 rounded-full bg-obsidian-elevated border border-obsidian-borderSubtle">
                     <Loader2 className="h-3 w-3 animate-spin text-economy-gold" />
                     Checking status...
                  </span>
               ) : isVerified ? (
                  <span
                     data-testid="ypt-verified-badge"
                     className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${
                        connection?.hasSavedSession
                           ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                           : "text-amber-400 bg-amber-500/10 border-amber-500/30"
                     }`}
                  >
                     {connection?.hasSavedSession ? (
                        <>
                           <CheckCircle2 className="h-3.5 w-3.5" />✓ YPT
                           Verified
                        </>
                     ) : (
                        <>
                           <Clock className="h-3.5 w-3.5" />
                           Verified • Session Inactive
                        </>
                     )}
                  </span>
               ) : isPending ? (
                  <span
                     data-testid="ypt-pending-badge"
                     className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 animate-pulse"
                  >
                     <Clock className="h-3.5 w-3.5" />
                     Verification Pending
                  </span>
               ) : isConnected ? (
                  <span
                     data-testid="ypt-connected-badge"
                     className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30"
                  >
                     <Link2 className="h-3.5 w-3.5" />
                     YPT Connected
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
                     data-testid="ypt-unconnected-badge"
                     className="inline-flex items-center gap-1.5 text-xs font-medium text-obsidian-textDim px-3 py-1 rounded-full bg-obsidian-elevated border border-obsidian-borderSubtle"
                  >
                     Not connected
                  </span>
               )}
            </div>
         </div>

         {/* Body Content */}
         <div className="mt-4 space-y-4">
            {/* 1. STATE: VERIFIED */}
            {isVerified && (
               <div className="space-y-3">
                  <div
                     className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        connection?.hasSavedSession
                           ? "border-emerald-500/30 bg-emerald-500/5"
                           : "border-amber-500/30 bg-amber-500/5"
                     }`}
                  >
                     <div className="flex items-start gap-3">
                        <div
                           className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                              connection?.hasSavedSession
                                 ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                                 : "bg-amber-500/15 border-amber-500/30 text-amber-400"
                           }`}
                        >
                           {connection?.hasSavedSession ? (
                              <ShieldCheck className="h-5 w-5" />
                           ) : (
                              <KeyRound className="h-5 w-5" />
                           )}
                        </div>
                        <div>
                           <h4 className="text-sm font-bold text-white flex items-center gap-2">
                              <span>
                                 {connection?.yptNickname ||
                                    "Verified Participant"}
                              </span>
                              <span
                                 className={`text-[11px] font-mono font-medium ${
                                    connection?.hasSavedSession
                                       ? "text-emerald-400"
                                       : "text-amber-400"
                                 }`}
                              >
                                 YPT ID: {connection?.yptUserId || initialYptId}
                              </span>
                           </h4>
                           <p
                              className={`text-xs mt-0.5 ${
                                 connection?.hasSavedSession
                                    ? "text-emerald-300/80"
                                    : "text-amber-300/90"
                              }`}
                           >
                              {connection?.hasSavedSession
                                 ? "Study synchronization is active. Authorized YPT sessions automatically credit virtual coin rewards and calculate progress."
                                 : "Identity verified, but Yeolpumta session is not connected. Connect your YPT account credentials below to activate automated study synchronization and coin rewards."}
                           </p>
                           {connection?.lastSyncedAt &&
                              connection?.hasSavedSession && (
                                 <p className="text-[11px] text-obsidian-textDim mt-1 flex items-center gap-1">
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

                     {/* Actions: Sync Now + Manage */}
                     <div className="flex items-center gap-2 shrink-0">
                        {connection?.hasSavedSession ? (
                           <>
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
                                 {isSyncing ? "Synchronizing..." : "Sync Now"}
                              </Button>

                              <Button
                                 type="button"
                                 variant="outline"
                                 size="sm"
                                 onClick={() => setIsConnectModalOpen(true)}
                                 className="rounded-xl text-xs border-obsidian-borderHighlight bg-obsidian-elevated text-obsidian-textMuted hover:text-white"
                              >
                                 Manage Connection
                              </Button>
                           </>
                        ) : (
                           <Button
                              type="button"
                              variant="gold"
                              size="sm"
                              onClick={() => setIsConnectModalOpen(true)}
                              className="rounded-xl text-xs font-bold gap-1.5 shadow-md"
                           >
                              <KeyRound className="h-3.5 w-3.5" />
                              Connect YPT Session
                           </Button>
                        )}
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
                           <Sparkles className="h-4 w-4 shrink-0 text-economy-gold" />
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
                           Waiting for an administrator to confirm this
                           identity:
                        </p>
                        <div className="mt-2.5 rounded-lg border border-amber-500/20 bg-black/40 p-2.5 flex items-center justify-between text-xs">
                           <div>
                              <span className="text-[10px] text-obsidian-textDim block">
                                 Selected Identity
                              </span>
                              <strong className="text-white">
                                 {connection?.activeClaim?.yptName ||
                                    connection?.yptNickname ||
                                    "Community Member"}
                              </strong>
                           </div>
                           <div className="text-right">
                              <span className="text-[10px] text-obsidian-textDim block">
                                 YPT ID
                              </span>
                              <span className="font-mono font-bold text-economy-gold">
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
                        <p className="text-xs text-obsidian-textDim mt-1">
                           Please select your correct identity from the group
                           member list below.
                        </p>
                     </div>
                  </div>
               </div>
            )}

            {/* 4. STATE: REAUTHENTICATION REQUIRED */}
            {isReauthRequired && (
               <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                     <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />
                     <div>
                        <h4 className="text-xs font-bold text-white">
                           Session Reauthentication Required
                        </h4>
                        <p className="text-[11px] text-amber-200/80">
                           Your Yeolpumta session has expired. Re-authenticate
                           to resume study-hour synchronization.
                        </p>
                     </div>
                  </div>
                  <Button
                     type="button"
                     variant="gold"
                     size="sm"
                     onClick={() => setIsConnectModalOpen(true)}
                     className="rounded-xl text-xs font-bold shrink-0"
                  >
                     Reconnect YPT
                  </Button>
               </div>
            )}

            {/* 5. STATE: NOT CONNECTED (Phase 3 Clean Interface) */}
            {!isVerified && !isPending && !isConnected && !isRejected && (
               <div className="rounded-xl border border-obsidian-borderSubtle bg-obsidian-elevated/40 p-6 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-economy-gold/10 border border-economy-gold/20 text-economy-gold mb-3">
                     <KeyRound className="h-6 w-6" />
                  </div>
                  <h4 className="text-sm font-bold text-white">
                     Connect Yeolpumta Account
                  </h4>
                  <p className="text-xs text-obsidian-textDim max-w-md mx-auto mt-1.5">
                     Connect your personal YPT account to automatically
                     synchronize verified study time with HoldMeToIt and earn
                     virtual coins.
                  </p>
                  <Button
                     type="button"
                     variant="gold"
                     size="sm"
                     onClick={() => setIsConnectModalOpen(true)}
                     className="mt-4 rounded-xl text-xs font-bold gap-2 px-5 py-2 shadow-lg"
                  >
                     <Link2 className="h-3.5 w-3.5" />
                     Connect YPT
                  </Button>
               </div>
            )}

            {/* 6. STATE: CONNECTED — Member Selection Workflow (Phase 5) */}
            {(isConnected || isRejected) && !isPending && (
               <div className="space-y-4 pt-2">
                  <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5 flex items-center justify-between text-xs">
                     <div>
                        <span className="text-[10px] text-blue-300/70 block">
                           Authenticated YPT Account
                        </span>
                        <strong className="text-white">
                           {connection?.yptNickname || "Yeolpumta User"}
                        </strong>
                        <span className="text-blue-300/80 font-mono pl-2">
                           (ID: {connection?.yptUserId})
                        </span>
                     </div>
                     <span className="text-[11px] text-blue-400 font-medium">
                        ✓ Connected via ypt-js
                     </span>
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

            {/* 7. CONNECT MODAL / POPUP FORM */}
            {isConnectModalOpen && (
               <div className="rounded-xl border border-economy-gold/30 bg-[#161616] p-4.5 mt-3 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-3 border-b border-obsidian-borderSubtle mb-3">
                     <div className="flex items-center gap-2">
                        <KeyRound className="h-4 w-4 text-economy-gold" />
                        <h4 className="text-xs font-bold text-white">
                           Connect to Yeolpumta (via ypt-js)
                        </h4>
                     </div>
                     <button
                        type="button"
                        onClick={() => setIsConnectModalOpen(false)}
                        className="text-xs text-obsidian-textDim hover:text-white"
                     >
                        ✕
                     </button>
                  </div>

                  <form onSubmit={handleConnectAccount} className="space-y-3">
                     <div>
                        <label className="text-[11px] font-semibold text-obsidian-textMuted block mb-1">
                           Yeolpumta Email
                        </label>
                        <Input
                           type="email"
                           value={email}
                           onChange={(e) => setEmail(e.target.value)}
                           placeholder="your-ypt-email@example.com"
                           required
                           className="rounded-xl border-obsidian-border bg-obsidian-elevated text-xs text-white placeholder:text-obsidian-textDim"
                        />
                     </div>

                     <div>
                        <label className="text-[11px] font-semibold text-obsidian-textMuted block mb-1">
                           Yeolpumta Password
                        </label>
                        <Input
                           type="password"
                           value={password}
                           onChange={(e) => setPassword(e.target.value)}
                           placeholder="••••••••"
                           required
                           className="rounded-xl border-obsidian-border bg-obsidian-elevated text-xs text-white placeholder:text-obsidian-textDim"
                        />
                     </div>

                     <div className="rounded-lg bg-obsidian-card/60 p-2 text-[10px] text-obsidian-textDim border border-obsidian-borderSubtle">
                        🛡️ <strong>Security Guarantee:</strong> Your credentials
                        are processed securely on the server exclusively to
                        authenticate with Yeolpumta&apos;s official API and are
                        never stored or logged in plaintext. An AES-256-GCM
                        encrypted refresh token is persisted to maintain
                        synchronization.
                     </div>

                     <div className="flex items-center justify-between pt-1">
                        {connection?.hasSavedSession && (
                           <button
                              type="button"
                              onClick={handleDisconnect}
                              className="text-xs text-rose-400 hover:underline flex items-center gap-1 font-medium"
                           >
                              <LogOut className="h-3 w-3" />
                              Disconnect Account
                           </button>
                        )}
                        <div className="flex items-center gap-2 ml-auto">
                           <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setIsConnectModalOpen(false)}
                              className="rounded-xl text-xs border-obsidian-borderHighlight"
                           >
                              Cancel
                           </Button>
                           <Button
                              type="submit"
                              variant="gold"
                              size="sm"
                              disabled={isConnecting || !email || !password}
                              className="rounded-xl text-xs font-bold gap-1.5"
                           >
                              {isConnecting ? (
                                 <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                 <Link2 className="h-3 w-3" />
                              )}
                              Connect Account
                           </Button>
                        </div>
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
