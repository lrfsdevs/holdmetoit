"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
   Sheet,
   SheetContent,
   SheetHeader,
   SheetTitle,
   SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/ui/user-avatar";
import { AdminAdjustmentDialog } from "@/features/economy/presentation/admin-adjustment-dialog";
import { AdminTrophyAdjustmentDialog } from "@/features/trophies/presentation/admin-trophy-adjustment-dialog";
import {
   updateUserRoleAction,
   getUserAuditLogsAction,
} from "../api/user-directory.actions";
import type {
   AdminRosterRole,
   AdminUserRosterItem,
} from "../domain/user-directory.types";
import type { AuditEvent } from "@/features/audit/domain/audit-log";
import {
   Shield,
   ShieldAlert,
   Copy,
   Check,
   ExternalLink,
   Coins,
   Trophy,
   RefreshCw,
   Clock,
   Loader2,
   Activity,
   AlertCircle,
   CheckCircle2,
} from "lucide-react";

export interface UserInspectorSheetProps {
   isOpen: boolean;
   onClose: () => void;
   user: AdminUserRosterItem | null;
   currentAdminId?: string;
   onUserUpdated?: () => void;
}

export function UserInspectorSheet({
   isOpen,
   onClose,
   user,
   currentAdminId,
   onUserUpdated,
}: UserInspectorSheetProps) {
   // Dialog states
   const [isCoinDialogOpen, setIsCoinDialogOpen] = useState(false);
   const [isTrophyDialogOpen, setIsTrophyDialogOpen] = useState(false);

   // Role assignment form state
   const [selectedRole, setSelectedRole] = useState<AdminRosterRole>("USER");
   const [roleReason, setRoleReason] = useState("");
   const [roleFeedback, setRoleFeedback] = useState<{
      type: "success" | "error";
      message: string;
   } | null>(null);
   const [isRolePending, startRoleTransition] = useTransition();

   // Avatar sync state
   const [isSyncingAvatar, setIsSyncingAvatar] = useState(false);
   const [avatarSyncFeedback, setAvatarSyncFeedback] = useState<string | null>(
      null
   );

   // Snowflake copy state
   const [hasCopiedSnowflake, setHasCopiedSnowflake] = useState(false);

   // Audit logs
   const [auditLogs, setAuditLogs] = useState<AuditEvent[]>([]);
   const [isLoadingLogs, setIsLoadingLogs] = useState(false);

   useEffect(() => {
      if (user) {
         setSelectedRole(user.role);
         setRoleReason("");
         setRoleFeedback(null);
         setAvatarSyncFeedback(null);
         setHasCopiedSnowflake(false);

         // Load user audit trail
         setIsLoadingLogs(true);
         getUserAuditLogsAction({ targetUserId: user.id, limit: 8 })
            .then((res) => {
               if (res.ok && res.data) {
                  setAuditLogs(res.data);
               } else {
                  setAuditLogs([]);
               }
            })
            .catch(() => setAuditLogs([]))
            .finally(() => setIsLoadingLogs(false));
      }
   }, [user, isOpen]);

   if (!user) return null;

   const isSelf = currentAdminId ? currentAdminId === user.id : false;

   const handleCopySnowflake = async () => {
      if (!user.discordId) return;
      try {
         await navigator.clipboard.writeText(user.discordId);
         setHasCopiedSnowflake(true);
         setTimeout(() => setHasCopiedSnowflake(false), 2000);
      } catch {
         // Fallback
      }
   };

   const handleSyncAvatar = async () => {
      if (!user.discordId && !user.id) return;
      setIsSyncingAvatar(true);
      setAvatarSyncFeedback(null);
      try {
         const res = await fetch("/api/users/sync-avatar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
               userId: user.id,
               discordId: user.discordId ?? undefined,
            }),
         });
         if (res.ok) {
            setAvatarSyncFeedback("Avatar synced with Discord CDN.");
            onUserUpdated?.();
         } else {
            setAvatarSyncFeedback("Failed to sync avatar.");
         }
      } catch {
         setAvatarSyncFeedback("Network error syncing avatar.");
      } finally {
         setIsSyncingAvatar(false);
         setTimeout(() => setAvatarSyncFeedback(null), 3000);
      }
   };

   const handleRoleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      setRoleFeedback(null);

      if (isSelf && selectedRole !== "ADMIN") {
         setRoleFeedback({
            type: "error",
            message:
               "Self-demotion protection: You cannot remove your own admin privileges.",
         });
         return;
      }

      if (!roleReason.trim() || roleReason.trim().length < 3) {
         setRoleFeedback({
            type: "error",
            message: "Mandatory audit reason must be at least 3 characters.",
         });
         return;
      }

      startRoleTransition(async () => {
         const res = await updateUserRoleAction({
            targetUserId: user.id,
            newRole: selectedRole,
            reason: roleReason.trim(),
         });

         if (res.ok) {
            setRoleFeedback({
               type: "success",
               message: `Role successfully updated to ${selectedRole}.`,
            });
            setRoleReason("");
            onUserUpdated?.();
            // Refresh logs
            getUserAuditLogsAction({ targetUserId: user.id, limit: 8 }).then(
               (logRes) => {
                  if (logRes.ok && logRes.data) setAuditLogs(logRes.data);
               }
            );
         } else {
            setRoleFeedback({
               type: "error",
               message: res.message || "Failed to update user role.",
            });
         }
      });
   };

   return (
      <>
         <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent
               side="right"
               className="w-full sm:max-w-xl overflow-y-auto bg-surface-primary border-l border-border-default p-6 space-y-6"
            >
               <SheetHeader className="space-y-1.5 pb-4 border-b border-border-subtle">
                  <div className="flex items-center justify-between gap-3">
                     <SheetTitle className="text-lg font-bold font-display text-white">
                        User Account Inspector
                     </SheetTitle>
                     <Button
                        asChild
                        variant="secondary"
                        size="sm"
                        className="h-8 gap-1.5 text-xs text-text-secondary hover:text-white"
                     >
                        <Link href={`/profile/${user.id}`} target="_blank">
                           <span>Profile</span>
                           <ExternalLink className="h-3 w-3" />
                        </Link>
                     </Button>
                  </div>
                  <SheetDescription className="text-xs text-text-tertiary">
                     Inspect registered credentials, study history, and host
                     moderation actions.
                  </SheetDescription>
               </SheetHeader>

               {/* User Identity Card */}
               <div className="flex items-start gap-4 rounded-2xl border border-border-subtle bg-surface-elevated p-4">
                  <UserAvatar
                     src={user.image}
                     name={user.name}
                     discordId={user.discordId}
                     userId={user.id}
                     size="lg"
                     className="ring-2 ring-border-default"
                  />
                  <div className="flex-1 min-w-0">
                     <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-white truncate text-base">
                           {user.name}
                        </h3>
                        <span className="text-label text-text-tertiary font-mono">
                           @{user.discordTag}
                        </span>
                     </div>

                     {user.discordId ? (
                        <div className="mt-1 flex items-center gap-1.5">
                           <button
                              type="button"
                              onClick={handleCopySnowflake}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface-page border border-border-subtle text-label font-mono text-text-secondary hover:text-white hover:border-brand-1/40 transition-colors"
                              title="Copy Discord Snowflake ID"
                           >
                              {hasCopiedSnowflake ? (
                                 <Check className="h-3 w-3 text-emerald-400" />
                              ) : (
                                 <Copy className="h-3 w-3 text-text-tertiary" />
                              )}
                              <span>{user.discordId}</span>
                           </button>
                        </div>
                     ) : (
                        <p className="text-label text-text-tertiary mt-1">
                           No Discord Snowflake ID linked
                        </p>
                     )}

                     <p className="text-label text-text-tertiary mt-1.5">
                        Registered on{" "}
                        {new Date(user.createdAt).toLocaleDateString()}
                     </p>
                  </div>
               </div>

               {/* Quick Stats Grid */}
               <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="rounded-xl border border-border-subtle bg-surface-elevated p-3">
                     <span className="text-text-tertiary block text-label">
                        Role
                     </span>
                     <span className="font-bold text-white uppercase text-xs mt-0.5 block">
                        {user.role}
                     </span>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-surface-elevated p-3">
                     <span className="text-text-tertiary block text-label">
                        Lifetime
                     </span>
                     <span className="font-bold text-emerald-400 font-mono text-xs mt-0.5 block">
                        {user.lifetimeStudyHours}h
                     </span>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-surface-elevated p-3">
                     <span className="text-text-tertiary block text-label">
                        Rank
                     </span>
                     <span className="font-bold text-amber-400 text-xs mt-0.5 block truncate">
                        {user.trophies} 🏆 {user.trophyRank}
                     </span>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-surface-elevated p-3">
                     <span className="text-text-tertiary block text-label">
                        Wallet
                     </span>
                     <span className="font-bold text-amber-300 font-mono text-xs mt-0.5 block">
                        {user.walletBalance} 🪙
                     </span>
                  </div>
               </div>

               {/* Quick Action Tools */}
               <div className="rounded-2xl border border-border-subtle bg-surface-elevated p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                     <Shield className="h-3.5 w-3.5 text-brand-1" />
                     Administrative Tools
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                     <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsCoinDialogOpen(true)}
                        className="h-9 text-xs justify-start gap-2 bg-surface-page hover:bg-surface-elevated"
                     >
                        <Coins className="h-3.5 w-3.5 text-amber-400" />
                        <span>Adjust Coins</span>
                     </Button>

                     <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsTrophyDialogOpen(true)}
                        className="h-9 text-xs justify-start gap-2 bg-surface-page hover:bg-surface-elevated"
                     >
                        <Trophy className="h-3.5 w-3.5 text-brand-1" />
                        <span>Adjust Trophies</span>
                     </Button>

                     <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleSyncAvatar}
                        disabled={isSyncingAvatar || !user.discordId}
                        className="h-9 text-xs justify-start gap-2 bg-surface-page hover:bg-surface-elevated"
                     >
                        <RefreshCw
                           className={`h-3.5 w-3.5 text-sky-400 ${
                              isSyncingAvatar ? "animate-spin" : ""
                           }`}
                        />
                        <span>Sync Avatar</span>
                     </Button>
                  </div>

                  {avatarSyncFeedback && (
                     <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg">
                        {avatarSyncFeedback}
                     </p>
                  )}
               </div>

               {/* Role Assignment Form */}
               <div className="rounded-2xl border border-border-subtle bg-surface-elevated p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                     <Activity className="h-3.5 w-3.5 text-amber-400" />
                     Role Assignment & Permissions
                  </h4>

                  {isSelf && (
                     <div className="flex items-center gap-2 p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs">
                        <ShieldAlert className="h-4 w-4 shrink-0" />
                        <span>
                           You are inspecting your own active session. Demoting
                           your own admin permissions is guarded and blocked.
                        </span>
                     </div>
                  )}

                  <form onSubmit={handleRoleSubmit} className="space-y-3">
                     <div className="space-y-1.5">
                        <Label
                           htmlFor="role-select"
                           className="text-xs text-text-secondary"
                        >
                           Target Role
                        </Label>
                        <select
                           id="role-select"
                           value={selectedRole}
                           onChange={(e) =>
                              setSelectedRole(e.target.value as AdminRosterRole)
                           }
                           disabled={isRolePending || isSelf}
                           className="w-full h-9 rounded-xl border border-border-default bg-surface-page px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-1 disabled:opacity-50"
                        >
                           <option value="USER">
                              USER (Regular Participant)
                           </option>
                           <option value="HOST">
                              HOST (Challenge Creator & Referee)
                           </option>
                           <option value="ADMIN">
                              ADMIN (Full Platform Authority)
                           </option>
                        </select>
                     </div>

                     <div className="space-y-1.5">
                        <Label
                           htmlFor="role-reason"
                           className="text-xs text-text-secondary"
                        >
                           Mandatory Audit Reason
                        </Label>
                        <Textarea
                           id="role-reason"
                           value={roleReason}
                           onChange={(e) => setRoleReason(e.target.value)}
                           placeholder="Explain why this user role is being changed (logged to audit trail)..."
                           disabled={isRolePending || isSelf}
                           className="min-h-[70px] text-xs bg-surface-page border-border-default resize-none"
                        />
                     </div>

                     {roleFeedback && (
                        <div
                           className={`flex items-center gap-2 p-2.5 rounded-xl text-xs ${
                              roleFeedback.type === "success"
                                 ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                 : "border border-rose-500/30 bg-rose-500/10 text-rose-300"
                           }`}
                        >
                           {roleFeedback.type === "success" ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0" />
                           ) : (
                              <AlertCircle className="h-4 w-4 shrink-0" />
                           )}
                           <span>{roleFeedback.message}</span>
                        </div>
                     )}

                     <Button
                        type="submit"
                        size="sm"
                        disabled={
                           isRolePending ||
                           isSelf ||
                           selectedRole === user.role ||
                           roleReason.trim().length < 3
                        }
                        className="w-full h-9 text-xs"
                     >
                        {isRolePending ? (
                           <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                              Applying Role Change...
                           </>
                        ) : (
                           "Apply Role Change"
                        )}
                     </Button>
                  </form>
               </div>

               {/* Activity Audit Trail */}
               <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center justify-between">
                     <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-text-tertiary" />
                        Recent Activity & Audit Trail
                     </span>
                     <span className="text-label font-normal text-text-tertiary">
                        Latest 8 events
                     </span>
                  </h4>

                  {isLoadingLogs ? (
                     <div className="p-4 text-center text-xs text-text-tertiary animate-pulse bg-surface-elevated rounded-2xl">
                        Loading user audit trail...
                     </div>
                  ) : auditLogs.length === 0 ? (
                     <div className="p-4 text-center text-xs text-text-tertiary bg-surface-elevated rounded-2xl border border-border-subtle">
                        No recent audited actions recorded for this member.
                     </div>
                  ) : (
                     <div className="space-y-2">
                        {auditLogs.map((log) => (
                           <div
                              key={log.id}
                              className="rounded-xl border border-border-subtle bg-surface-elevated p-3 text-xs space-y-1"
                           >
                              <div className="flex items-center justify-between gap-2">
                                 <span className="font-semibold text-text-primary text-label">
                                    {log.actionType}
                                 </span>
                                 <span className="text-meta text-text-tertiary font-mono">
                                    {new Date(log.timestamp).toLocaleString()}
                                 </span>
                              </div>
                              <p className="text-label text-text-secondary">
                                 By{" "}
                                 <strong className="text-white">
                                    {log.actorDisplayName || log.actorUsername}
                                 </strong>
                                 {log.auditReason && (
                                    <span className="text-text-tertiary">
                                       {" "}
                                       — &ldquo;{log.auditReason}&rdquo;
                                    </span>
                                 )}
                              </p>
                           </div>
                        ))}
                     </div>
                  )}
               </div>
            </SheetContent>
         </Sheet>

         {/* Sub-Dialogs for Coins and Trophies */}
         <AdminAdjustmentDialog
            isOpen={isCoinDialogOpen}
            onClose={() => setIsCoinDialogOpen(false)}
            defaultUserId={user.id}
            onSuccess={() => {
               setIsCoinDialogOpen(false);
               onUserUpdated?.();
            }}
         />

         <AdminTrophyAdjustmentDialog
            isOpen={isTrophyDialogOpen}
            onClose={() => setIsTrophyDialogOpen(false)}
            targetUser={{
               id: user.id,
               displayName: user.name,
               username: user.discordTag,
               currentTrophies: user.trophies,
            }}
            onSuccess={() => {
               setIsTrophyDialogOpen(false);
               onUserUpdated?.();
            }}
         />
      </>
   );
}
