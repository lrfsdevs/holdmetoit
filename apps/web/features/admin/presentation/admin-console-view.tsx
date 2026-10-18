"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
   Shield,
   Trophy,
   Calendar,
   ExternalLink,
   Search,
   Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getTrophyLeaderboardAction } from "@/features/trophies/api/trophy.actions";
import { AdminTrophyAdjustmentDialog } from "@/features/trophies/presentation/admin-trophy-adjustment-dialog";
import { TrophyRoleBadge } from "@/features/trophies/presentation/trophy-role-badge";

/**
 * Host console for competitive trophy management and audited adjustments.
 * (YPT identity verification lives in the DEV-only DevBoard.)
 */
export function AdminConsoleView() {
   // Trophy State
   const [leaderboardEntries, setLeaderboardEntries] = useState<any[]>([]);
   const [selectedAdjustUser, setSelectedAdjustUser] = useState<any | null>(
      null
   );
   const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
   const [trophySearchQuery, setTrophySearchQuery] = useState("");

   const loadTrophies = async () => {
      const res = await getTrophyLeaderboardAction({ limit: 50 });
      if (res.ok && res.data) {
         setLeaderboardEntries(res.data.entries);
      }
   };

   useEffect(() => {
      void loadTrophies();
   }, []);

   return (
      <div className="space-y-6">
         {/* Top Hero Bar */}
         <div className="rounded-3xl border border-border-default bg-surface-primary p-6 shadow-xl backdrop-blur-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
               <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                     <Shield className="h-6 w-6" />
                  </div>
                  <div>
                     <h1 className="text-xl sm:text-2xl font-bold font-display text-white tracking-tight">
                        Host Administration Console
                     </h1>
                     <p className="text-xs text-text-tertiary mt-0.5">
                        Manage competitive trophy ratings and study operations.
                     </p>
                  </div>
               </div>

               <Link
                  href="/challenges"
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-text-secondary hover:text-white transition-colors"
               >
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Challenges</span>
                  <ExternalLink className="h-3 w-3" />
               </Link>
            </div>
         </div>

         {/* Trophy Management */}
         <div className="space-y-5">
            {/* Centralized Config Overview */}
            <div className="rounded-3xl border border-border-default bg-surface-primary p-6 shadow-xl">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
                  <div>
                     <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-brand-1" />
                        Trophy System Configuration
                     </h2>
                     <p className="text-xs text-text-tertiary mt-0.5">
                        Deterministic Clash of Clans style competitive
                        progression values.
                     </p>
                  </div>
               </div>

               <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-xl border border-border-subtle bg-surface-elevated p-3">
                     <span className="text-text-tertiary block">
                        Win Reward Base
                     </span>
                     <strong className="text-base font-bold text-emerald-400 font-mono">
                        +25 🏆
                     </strong>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-surface-elevated p-3">
                     <span className="text-text-tertiary block">
                        Loss Penalty Base
                     </span>
                     <strong className="text-base font-bold text-rose-400 font-mono">
                        -15 🏆
                     </strong>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-surface-elevated p-3">
                     <span className="text-text-tertiary block">
                        Draw / Cancelled
                     </span>
                     <strong className="text-base font-bold text-text-primary font-mono">
                        0 🏆
                     </strong>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-surface-elevated p-3">
                     <span className="text-text-tertiary block">
                        Rating Floor
                     </span>
                     <strong className="text-base font-bold text-yellow-400 font-mono">
                        0 (No Negative)
                     </strong>
                  </div>
               </div>
            </div>

            {/* Standings & Admin Adjustment Table */}
            <div className="rounded-3xl border border-border-default bg-surface-primary p-6 shadow-xl">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle mb-4">
                  <div>
                     <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                        Participant Standings & Ratings
                     </h3>
                     <p className="text-xs text-text-tertiary mt-0.5">
                        Audited manual adjustments may be issued for tournament
                        corrections.
                     </p>
                  </div>

                  {/* Search User Input */}
                  <div className="relative w-full sm:w-64">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
                     <Input
                        type="text"
                        placeholder="Filter participants..."
                        value={trophySearchQuery}
                        onChange={(e) => setTrophySearchQuery(e.target.value)}
                        className="rounded-xl border-border-default bg-surface-elevated pl-8 text-xs text-white"
                     />
                  </div>
               </div>

               <div className="divide-y divide-border-subtle">
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
                              <span className="font-mono text-xs font-bold text-text-tertiary w-6 text-center">
                                 #{u.rank}
                              </span>
                              <div className="truncate">
                                 <span className="font-bold text-white">
                                    {u.displayName}
                                 </span>
                                 <span className="text-text-tertiary pl-1.5 font-mono">
                                    (@{u.username})
                                 </span>
                              </div>
                           </div>

                           <div className="flex items-center gap-3 shrink-0">
                              <TrophyRoleBadge
                                 trophies={u.trophyBalance}
                                 size="sm"
                              />
                              <span className="hidden sm:inline font-mono text-text-tertiary">
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
                                 className="text-xs h-7 px-2 border-border-strong bg-surface-elevated text-text-secondary hover:text-white"
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
