"use client";

import React, {
   useState,
   useTransition,
   useEffect,
   useCallback,
   useId,
} from "react";
import Link from "next/link";
import {
   Users,
   Swords,
   UserX,
   Link2,
   Search,
   ExternalLink,
   Copy,
   Check,
   Shield,
   RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/ui/user-avatar";
import { DataPagination } from "@/components/ui/data-pagination";
import { EmptyState } from "@/components/state/empty-state";
import { fetchAdminUserRosterAction } from "../api/user-directory.actions";
import { UserInspectorSheet } from "./user-inspector-sheet";
import type {
   AdminEnrollmentFilter,
   AdminRosterRole,
   AdminUserRosterItem,
   AdminUserRosterResult,
   AdminUserSortBy,
   AdminYptFilter,
   UserDirectoryQuery,
} from "../domain/user-directory.types";

export interface UserDirectoryViewProps {
   initialData: AdminUserRosterResult;
   currentAdminId?: string;
}

function formatRelativeTime(dateString: string): string {
   const now = new Date();
   const date = new Date(dateString);
   const diffMs = now.getTime() - date.getTime();
   const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

   if (diffDays <= 0) return "today";
   if (diffDays === 1) return "yesterday";
   if (diffDays < 30) return `${diffDays}d ago`;
   const diffMonths = Math.floor(diffDays / 30);
   if (diffMonths < 12) return `${diffMonths}mo ago`;
   const diffYears = Math.floor(diffDays / 365);
   return `${diffYears}y ago`;
}

export function UserDirectoryView({
   initialData,
   currentAdminId,
}: UserDirectoryViewProps) {
   // Query state
   const [searchQuery, setSearchQuery] = useState("");
   const [debouncedSearch, setDebouncedSearch] = useState("");
   const [roleFilter, setRoleFilter] = useState<"ALL" | AdminRosterRole>("ALL");
   const [enrollmentFilter, setEnrollmentFilter] =
      useState<AdminEnrollmentFilter>("ALL");
   const [yptFilter, setYptFilter] = useState<AdminYptFilter>("ALL");
   const [sortBy, setSortBy] = useState<AdminUserSortBy>("createdAt");
   const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
   const [page, setPage] = useState(1);
   const pageSize = 15;

   // Search input id for accessible label wiring
   const searchInputId = useId();

   // Data state
   const [rosterData, setRosterData] =
      useState<AdminUserRosterResult>(initialData);
   const [isPending, startTransition] = useTransition();

   // Inspector sheet state
   const [inspectingUser, setInspectingUser] =
      useState<AdminUserRosterItem | null>(null);
   const [isInspectorOpen, setIsInspectorOpen] = useState(false);

   // Snowflake copy feedback
   const [copiedId, setCopiedId] = useState<string | null>(null);

   // Debounce search input
   useEffect(() => {
      const timer = setTimeout(() => {
         setDebouncedSearch(searchQuery);
         setPage(1);
      }, 300);
      return () => clearTimeout(timer);
   }, [searchQuery]);

   // Fetch data when filters or pagination change
   const loadRoster = useCallback(
      (newPage = page) => {
         startTransition(async () => {
            const query: UserDirectoryQuery = {
               search: debouncedSearch.trim() || undefined,
               roleFilter: roleFilter === "ALL" ? undefined : roleFilter,
               enrollmentFilter:
                  enrollmentFilter === "ALL" ? undefined : enrollmentFilter,
               yptFilter: yptFilter === "ALL" ? undefined : yptFilter,
               sortBy,
               sortDirection,
               page: newPage,
               pageSize,
            };

            const res = await fetchAdminUserRosterAction(query);
            if (res.ok && res.data) {
               setRosterData(res.data);
            }
         });
      },
      [
         debouncedSearch,
         roleFilter,
         enrollmentFilter,
         yptFilter,
         sortBy,
         sortDirection,
         page,
      ]
   );

   useEffect(() => {
      loadRoster(page);
   }, [loadRoster, page]);

   const handleCopySnowflake = async (snowflake: string) => {
      try {
         await navigator.clipboard.writeText(snowflake);
         setCopiedId(snowflake);
         setTimeout(() => setCopiedId(null), 2000);
      } catch {
         // Silently handle clipboard permissions error
      }
   };

   const handleOpenInspector = (user: AdminUserRosterItem) => {
      setInspectingUser(user);
      setIsInspectorOpen(true);
   };

   const handleResetFilters = () => {
      setSearchQuery("");
      setDebouncedSearch("");
      setRoleFilter("ALL");
      setEnrollmentFilter("ALL");
      setYptFilter("ALL");
      setSortBy("createdAt");
      setSortDirection("desc");
      setPage(1);
   };

   const summary = rosterData.summary;

   return (
      <div className="space-y-6">
         {/* Top Hero Bar */}
         <div className="rounded-3xl border border-border-default bg-surface-primary p-6 shadow-xl backdrop-blur-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
               <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-1/10 border border-brand-1/30 text-brand-1">
                     <Users className="h-6 w-6" />
                  </div>
                  <div>
                     <h1 className="text-xl sm:text-2xl font-bold font-display text-white tracking-tight">
                        Platform User Directory & Rosters
                     </h1>
                     <p className="text-xs text-text-tertiary mt-0.5">
                        Global member directory, cross-challenge roster
                        tracking, and administrative controls.
                     </p>
                  </div>
               </div>

               <div className="flex items-center gap-2">
                  <Button
                     asChild
                     variant="secondary"
                     size="sm"
                     className="text-xs text-text-secondary hover:text-white"
                  >
                     <Link href="/admin">
                        <Shield className="h-3.5 w-3.5 mr-1 text-amber-400" />
                        <span>Console Home</span>
                     </Link>
                  </Button>
               </div>
            </div>
         </div>

         {/* 4 Summary Stat Cards */}
         <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="rounded-2xl border border-border-subtle bg-surface-primary p-4 shadow-sm flex items-center justify-between">
               <div>
                  <span className="text-xs text-text-tertiary block font-medium">
                     Total Registered
                  </span>
                  <span className="text-2xl font-bold font-display text-white mt-1 block">
                     {summary.totalUsers}
                  </span>
               </div>
               <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Users className="h-5 w-5" />
               </div>
            </div>

            <div className="rounded-2xl border border-border-subtle bg-surface-primary p-4 shadow-sm flex items-center justify-between">
               <div>
                  <span className="text-xs text-text-tertiary block font-medium">
                     Active in Battles
                  </span>
                  <span className="text-2xl font-bold font-display text-emerald-400 mt-1 block">
                     {summary.activeEnrolledUsers}
                  </span>
               </div>
               <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Swords className="h-5 w-5" />
               </div>
            </div>

            <div className="rounded-2xl border border-border-subtle bg-surface-primary p-4 shadow-sm flex items-center justify-between">
               <div>
                  <span className="text-xs text-text-tertiary block font-medium">
                     Unenrolled / Idle
                  </span>
                  <span className="text-2xl font-bold font-display text-text-secondary mt-1 block">
                     {summary.unenrolledUsers}
                  </span>
               </div>
               <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                  <UserX className="h-5 w-5" />
               </div>
            </div>

            <div className="rounded-2xl border border-border-subtle bg-surface-primary p-4 shadow-sm flex items-center justify-between">
               <div>
                  <span className="text-xs text-text-tertiary block font-medium">
                     YPT Connected
                  </span>
                  <span className="text-2xl font-bold font-display text-brand-1 mt-1 block">
                     {summary.yptConnectedUsers}
                  </span>
               </div>
               <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-1/10 text-brand-1 border border-brand-1/20">
                  <Link2 className="h-5 w-5" />
               </div>
            </div>
         </div>

         {/* Search & Filters Console */}
         <div className="rounded-2xl border border-border-default bg-surface-primary p-4 shadow-md space-y-3">
            <div className="flex flex-col md:flex-row gap-3">
               {/* Search Input */}
               <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
                  <Input
                     id={searchInputId}
                     type="text"
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     placeholder="Search member by username, display name, or Discord Snowflake ID..."
                     aria-label="Search members"
                     className="pl-9 bg-surface-page border-border-subtle text-xs h-10 text-white placeholder:text-text-tertiary focus:border-brand-1"
                  />
                  {searchQuery && (
                     <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-tertiary hover:text-white"
                     >
                        Clear
                     </button>
                  )}
               </div>

               {/* Filter Selects Row */}
               <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {/* Role Filter */}
                  <select
                     value={roleFilter}
                     onChange={(e) => {
                        setRoleFilter(e.target.value as any);
                        setPage(1);
                     }}
                     className="h-10 rounded-xl border border-border-subtle bg-surface-page px-2.5 text-xs text-white focus:outline-none focus:border-brand-1"
                  >
                     <option value="ALL">All Roles</option>
                     <option value="USER">Role: USER</option>
                     <option value="HOST">Role: HOST</option>
                     <option value="ADMIN">Role: ADMIN</option>
                  </select>

                  {/* Enrollment Filter */}
                  <select
                     value={enrollmentFilter}
                     onChange={(e) => {
                        setEnrollmentFilter(e.target.value as any);
                        setPage(1);
                     }}
                     className="h-10 rounded-xl border border-border-subtle bg-surface-page px-2.5 text-xs text-white focus:outline-none focus:border-brand-1"
                  >
                     <option value="ALL">All Enrollments</option>
                     <option value="ACTIVE">Active in Challenge</option>
                     <option value="IDLE">Idle (Past Battles)</option>
                     <option value="NEVER_ENROLLED">Never Enrolled</option>
                  </select>

                  {/* YPT Filter */}
                  <select
                     value={yptFilter}
                     onChange={(e) => {
                        setYptFilter(e.target.value as any);
                        setPage(1);
                     }}
                     className="h-10 rounded-xl border border-border-subtle bg-surface-page px-2.5 text-xs text-white focus:outline-none focus:border-brand-1"
                  >
                     <option value="ALL">All YPT States</option>
                     <option value="CONNECTED">YPT Connected</option>
                     <option value="DISCONNECTED">YPT Unlinked</option>
                  </select>

                  {/* Sort Filter */}
                  <select
                     value={sortBy}
                     onChange={(e) => {
                        setSortBy(e.target.value as any);
                        setPage(1);
                     }}
                     className="h-10 rounded-xl border border-border-subtle bg-surface-page px-2.5 text-xs text-white focus:outline-none focus:border-brand-1"
                  >
                     <option value="createdAt">Sort: Created Date</option>
                     <option value="lifetimeHours">Sort: Study Hours</option>
                     <option value="trophies">Sort: Trophies</option>
                  </select>
               </div>
            </div>

            {/* Active Filters Summary & Reset */}
            {(searchQuery ||
               roleFilter !== "ALL" ||
               enrollmentFilter !== "ALL" ||
               yptFilter !== "ALL" ||
               sortBy !== "createdAt") && (
               <div className="flex items-center justify-between text-xs pt-1 border-t border-border-subtle text-text-tertiary">
                  <span>Showing {rosterData.totalCount} matching members</span>
                  <button
                     type="button"
                     onClick={handleResetFilters}
                     className="flex items-center gap-1 text-brand-1 hover:underline"
                  >
                     <RotateCcw className="h-3 w-3" />
                     <span>Reset Filters</span>
                  </button>
               </div>
            )}
         </div>

         {/* Roster Table Card */}
         <div className="rounded-3xl border border-border-default bg-surface-primary overflow-hidden shadow-xl">
            {isPending && (
               <div className="h-1 bg-surface-page overflow-hidden">
                  <div className="h-full bg-brand-1 animate-pulse" />
               </div>
            )}

            {rosterData.items.length === 0 ? (
               <div className="p-8">
                  <EmptyState
                     title="No Members Found"
                     description="No registered platform users match the current search or filter criteria. Try adjusting your query parameters."
                  />
               </div>
            ) : (
               <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                     <thead>
                        <tr className="border-b border-border-subtle bg-surface-elevated/40 text-text-tertiary uppercase font-mono tracking-wider text-label">
                           <th className="py-3.5 pl-6 pr-3 font-medium">
                              Member
                           </th>
                           <th className="py-3.5 px-3 font-medium">Role</th>
                           <th className="py-3.5 px-3 font-medium">
                              Lifetime & Rank
                           </th>
                           <th className="py-3.5 px-3 font-medium">
                              YPT Status
                           </th>
                           <th className="py-3.5 px-3 font-medium">
                              Active Challenges
                           </th>
                           <th className="py-3.5 px-3 font-medium">Joined</th>
                           <th className="py-3.5 pl-3 pr-6 text-right font-medium">
                              Actions
                           </th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-border-subtle text-text-secondary">
                        {rosterData.items.map((user) => (
                           <tr
                              key={user.id}
                              className="hover:bg-surface-elevated/40 transition-colors"
                           >
                              {/* Member Column */}
                              <td className="py-3.5 pl-6 pr-3">
                                 <div className="flex items-center gap-3">
                                    <UserAvatar
                                       src={user.image}
                                       name={user.name}
                                       discordId={user.discordId}
                                       userId={user.id}
                                       size="sm"
                                       className="ring-1 ring-border-subtle"
                                    />
                                    <div className="min-w-0">
                                       <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-semibold text-white truncate text-xs">
                                             {user.name}
                                          </span>
                                          <span className="text-label text-text-tertiary font-mono">
                                             @{user.discordTag}
                                          </span>
                                       </div>

                                       {user.discordId && (
                                          <button
                                             type="button"
                                             onClick={() =>
                                                handleCopySnowflake(
                                                   user.discordId!
                                                )
                                             }
                                             className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded bg-surface-page border border-border-subtle text-meta font-mono text-text-tertiary hover:text-white transition-colors"
                                             title="Click to copy Discord Snowflake"
                                          >
                                             {copiedId === user.discordId ? (
                                                <Check className="h-2.5 w-2.5 text-emerald-400" />
                                             ) : (
                                                <Copy className="h-2.5 w-2.5 text-text-tertiary" />
                                             )}
                                             <span>{user.discordId}</span>
                                          </button>
                                       )}
                                    </div>
                                 </div>
                              </td>

                              {/* Role Column */}
                              <td className="py-3.5 px-3">
                                 <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-label font-bold uppercase ${
                                       user.role === "ADMIN"
                                          ? "bg-purple-500/15 text-purple-300 border border-purple-500/30"
                                          : user.role === "HOST"
                                            ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                            : "bg-zinc-500/15 text-zinc-300 border border-zinc-500/30"
                                    }`}
                                 >
                                    {user.role}
                                 </span>
                              </td>

                              {/* Lifetime & Rank Column */}
                              <td className="py-3.5 px-3">
                                 <div className="space-y-0.5">
                                    <div className="font-bold font-mono text-emerald-400">
                                       {user.lifetimeStudyHours}h
                                    </div>
                                    <div className="text-label text-text-tertiary flex items-center gap-1">
                                       <span className="text-amber-400 font-bold">
                                          {user.trophies} 🏆
                                       </span>
                                       <span>• {user.trophyRank}</span>
                                    </div>
                                 </div>
                              </td>

                              {/* YPT Status Column */}
                              <td className="py-3.5 px-3">
                                 <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-label font-semibold ${
                                       user.yptStatus === "CONNECTED"
                                          ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                                          : user.yptStatus === "ERROR"
                                            ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                                            : "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
                                    }`}
                                 >
                                    <span
                                       className={`h-1.5 w-1.5 rounded-full ${
                                          user.yptStatus === "CONNECTED"
                                             ? "bg-emerald-400"
                                             : user.yptStatus === "ERROR"
                                               ? "bg-rose-400"
                                               : "bg-zinc-500"
                                       }`}
                                    />
                                    <span>{user.yptStatus}</span>
                                 </span>
                              </td>

                              {/* Active Challenges Column */}
                              <td className="py-3.5 px-3">
                                 {user.activeChallenges.length > 0 ? (
                                    <div className="flex flex-wrap gap-1 max-w-xs">
                                       {user.activeChallenges.map((ch) => (
                                          <Link
                                             key={ch.id}
                                             href={`/challenge/${ch.id}/participant/${ch.participantId}`}
                                             className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand-1/10 border border-brand-1/30 text-brand-1 text-label font-medium hover:bg-brand-1/20 transition-colors"
                                             title={`View ${ch.title} participant stats`}
                                          >
                                             <span className="truncate max-w-32">
                                                {ch.title}
                                             </span>
                                             <span className="text-micro uppercase px-1 rounded bg-brand-1/20">
                                                {ch.mode}
                                             </span>
                                          </Link>
                                       ))}
                                    </div>
                                 ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-surface-elevated border border-border-subtle text-label text-text-tertiary">
                                       Unenrolled
                                    </span>
                                 )}
                              </td>

                              {/* Joined Column */}
                              <td className="py-3.5 px-3 text-label text-text-tertiary">
                                 <div>
                                    {new Date(
                                       user.createdAt
                                    ).toLocaleDateString()}
                                 </div>
                                 <div className="text-meta text-text-tertiary/80">
                                    {formatRelativeTime(user.createdAt)}
                                 </div>
                              </td>

                              {/* Actions Column */}
                              <td className="py-3.5 pl-3 pr-6 text-right">
                                 <div className="flex items-center justify-end gap-1.5">
                                    <Button
                                       asChild
                                       variant="ghost"
                                       size="sm"
                                       className="h-8 px-2 text-xs text-text-secondary hover:text-white"
                                    >
                                       <Link href={`/profile/${user.id}`}>
                                          <span>Profile</span>
                                       </Link>
                                    </Button>

                                    <Button
                                       type="button"
                                       variant="secondary"
                                       size="sm"
                                       onClick={() => handleOpenInspector(user)}
                                       className="h-8 px-2.5 text-xs text-text-primary hover:text-white bg-surface-page hover:bg-surface-elevated border-border-subtle"
                                    >
                                       Inspect
                                    </Button>
                                 </div>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            )}

            {/* Pagination Footer */}
            {rosterData.totalPages > 1 && (
               <div className="p-4 border-t border-border-subtle flex items-center justify-center">
                  <DataPagination
                     currentPage={rosterData.page}
                     totalPages={rosterData.totalPages}
                     totalItems={rosterData.totalCount}
                     pageSize={rosterData.pageSize}
                     onPageChange={(p) => setPage(p)}
                     itemLabel="members"
                  />
               </div>
            )}
         </div>

         {/* Side Inspector Sheet */}
         <UserInspectorSheet
            isOpen={isInspectorOpen}
            onClose={() => setIsInspectorOpen(false)}
            user={inspectingUser}
            currentAdminId={currentAdminId}
            onUserUpdated={() => loadRoster(page)}
         />
      </div>
   );
}
