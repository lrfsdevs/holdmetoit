"use client";

import {
   useCallback,
   useEffect,
   useMemo,
   useState,
   useTransition,
} from "react";
import Image from "next/image";
import {
   Calendar,
   ChevronDown,
   ChevronUp,
   Clock,
   Download,
   Filter,
   Loader2,
   RefreshCw,
   Search,
   Shield,
   User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataPagination } from "@/components/ui/data-pagination";
import { getChallengeAuditTrailAction } from "@/features/audit/api/audit.actions";
import {
   exportAuditTrailToJson,
   formatAuditActionHuman,
   type AuditEvent,
   type AuditEventType,
} from "@/features/audit/domain/audit-log";

interface EventAuditTabProps {
   challengeId: string;
   challengeTitle: string;
}

type FilterCategory =
   "ALL" | "DETAILS" | "ROSTER" | "HOURS" | "STUDY_LOGS" | "LIFECYCLE";

function formatRelativeTime(dateStr: string): string {
   try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 30) return `${diffDays}d ago`;
      return new Date(dateStr).toLocaleDateString("en-US", {
         month: "short",
         day: "numeric",
      });
   } catch {
      return "";
   }
}

function formatUtcClock(dateStr: string): string {
   try {
      const d = new Date(dateStr);
      return d.toLocaleString("en-US", {
         month: "short",
         day: "numeric",
         year: "numeric",
         hour: "2-digit",
         minute: "2-digit",
         second: "2-digit",
         timeZone: "UTC",
         timeZoneName: "short",
      });
   } catch {
      return dateStr;
   }
}

function getActionBadgeStyle(action: AuditEventType): string {
   switch (action) {
      case "EVENT_DETAILS_UPDATED":
      case "CHALLENGE_UPDATED":
      case "TIMETABLE_ADJUSTED":
      case "EVENT_BANNER_UPDATED":
      case "PUNISHMENT_PFP_UPDATED":
      case "HOUSE_IDENTITY_UPDATED":
         return "bg-[#e08a32]/15 text-[#f5ba73] border-[#e08a32]/30";
      case "ROSTER_EDIT":
         return "bg-[#9f8dc0]/15 text-[#d8cce8] border-[#9f8dc0]/30";
      case "HOURS_OVERRIDE":
         return "bg-[#529e72]/15 text-[#85ff93] border-[#529e72]/30";
      case "TARGET_HOURS_OVERRIDE":
         return "bg-[#a855f7]/15 text-[#d8b4fe] border-[#a855f7]/30";
      case "STUDY_LOG_ADDED":
         return "bg-[#10b981]/15 text-[#34d399] border-[#10b981]/30";
      case "CHALLENGE_KICKOFF":
         return "bg-[#22c55e]/15 text-[#4ade80] border-[#22c55e]/30";
      case "CHALLENGE_LOCKED":
         return "bg-[#eab308]/15 text-[#facc15] border-[#eab308]/30";
      case "CHALLENGE_UNLOCKED":
         return "bg-[#f97316]/15 text-[#fdba74] border-[#f97316]/30";
      case "PARTICIPANT_PARDONED":
         return "bg-[#38bdf8]/15 text-[#7dd3fc] border-[#38bdf8]/30";
      case "CHALLENGE_CREATED":
         return "bg-[#3b82f6]/15 text-[#93c5fd] border-[#3b82f6]/30";
      case "CHALLENGE_DELETED":
         return "bg-[#ef4444]/15 text-[#f87171] border-[#ef4444]/30";
      default:
         return "bg-[#262626] text-[#d1d1d1] border-[#383838]";
   }
}

export function EventAuditTab({
   challengeId,
   challengeTitle,
}: EventAuditTabProps) {
   const [logs, setLogs] = useState<AuditEvent[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const [errorMessage, setErrorMessage] = useState<string | null>(null);
   const [isPending, startTransition] = useTransition();

   const [searchQuery, setSearchQuery] = useState("");
   const [currentPage, setCurrentPage] = useState(1);
   const pageSize = 10;
   const [selectedCategory, setSelectedCategory] =
      useState<FilterCategory>("ALL");
   const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());

   const fetchLogs = useCallback(() => {
      setIsLoading(true);
      setErrorMessage(null);

      startTransition(async () => {
         const res = await getChallengeAuditTrailAction(challengeId);
         if (res.ok) {
            setLogs(res.logs);
         } else {
            setErrorMessage(res.message || "Failed to load audit logs.");
         }
         setIsLoading(false);
      });
   }, [challengeId]);

   useEffect(() => {
      fetchLogs();
   }, [fetchLogs]);

   const toggleExpand = (id: string) => {
      setExpandedLogIds((prev) => {
         const next = new Set(prev);
         if (next.has(id)) next.delete(id);
         else next.add(id);
         return next;
      });
   };

   const handleExportJson = () => {
      if (logs.length === 0) return;
      const jsonStr = exportAuditTrailToJson(logs);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      const sanitizedTitle = challengeTitle
         .toLowerCase()
         .replace(/[^a-z0-9]+/g, "-");
      a.download = `${sanitizedTitle}-audit-log-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
   };

   const filteredLogs = useMemo(() => {
      return logs.filter((log) => {
         // 1. Category Filter
         if (selectedCategory === "ALL") {
            if (log.actionType === "STUDY_LOG_ADDED") return false;
         } else if (selectedCategory === "DETAILS") {
            const detailTypes: AuditEventType[] = [
               "CHALLENGE_UPDATED",
               "EVENT_DETAILS_UPDATED",
               "TIMETABLE_ADJUSTED",
               "EVENT_BANNER_UPDATED",
               "PUNISHMENT_PFP_UPDATED",
               "HOUSE_IDENTITY_UPDATED",
            ];
            if (!detailTypes.includes(log.actionType)) return false;
         } else if (selectedCategory === "ROSTER") {
            if (
               log.actionType !== "ROSTER_EDIT" &&
               log.actionType !== "TARGET_HOURS_OVERRIDE"
            )
               return false;
         } else if (selectedCategory === "HOURS") {
            if (
               log.actionType !== "HOURS_OVERRIDE" &&
               log.actionType !== "TARGET_HOURS_OVERRIDE"
            )
               return false;
         } else if (selectedCategory === "STUDY_LOGS") {
            if (log.actionType !== "STUDY_LOG_ADDED") return false;
         } else if (selectedCategory === "LIFECYCLE") {
            const lifecycleTypes: AuditEventType[] = [
               "CHALLENGE_CREATED",
               "CHALLENGE_KICKOFF",
               "CHALLENGE_LOCKED",
               "CHALLENGE_UNLOCKED",
               "CHALLENGE_DELETED",
               "PARTICIPANT_PARDONED",
            ];
            if (!lifecycleTypes.includes(log.actionType)) return false;
         }

         // 2. Search Query Filter
         if (!searchQuery.trim()) return true;
         const q = searchQuery.toLowerCase().trim();
         const actionHuman = formatAuditActionHuman(
            log.actionType
         ).toLowerCase();
         const adminName = (log.actorDisplayName || "").toLowerCase();
         const adminUser = log.actorUsername.toLowerCase();
         const targetName = (log.targetEntityName || "").toLowerCase();
         const reason = (log.auditReason || "").toLowerCase();

         return (
            actionHuman.includes(q) ||
            adminName.includes(q) ||
            adminUser.includes(q) ||
            targetName.includes(q) ||
            reason.includes(q)
         );
      });
   }, [logs, selectedCategory, searchQuery]);

   const totalPages = Math.ceil(filteredLogs.length / pageSize);
   const safePage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages));
   const paginatedLogs = filteredLogs.slice(
      (safePage - 1) * pageSize,
      safePage * pageSize
   );

   return (
      <div className="space-y-6 max-w-5xl mx-auto pb-16">
         {/* Header Container */}
         <div className="rounded-3xl border border-[#262626] bg-[#141414] p-6 sm:p-8 space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#262626]">
               <div className="space-y-1">
                  <h2 className="text-xl font-bold text-white tracking-tight">
                     Event Audit Log
                  </h2>
                  <p className="text-xs text-[#868686] max-w-xl">
                     Append-only, immutable record of every administrative
                     action, schedule change, roster reassignment, and hours
                     override for{" "}
                     <span className="text-white font-semibold">
                        {challengeTitle}
                     </span>
                     .
                  </p>
               </div>

               <div className="flex items-center gap-2.5">
                  <Button
                     type="button"
                     variant="outline"
                     size="sm"
                     onClick={fetchLogs}
                     disabled={isLoading || isPending}
                     className="h-9 px-3 rounded-xl border-[#383838] bg-[#1d1d1d] hover:bg-[#262626] text-white text-xs font-medium gap-1.5"
                  >
                     <RefreshCw
                        className={`h-3.5 w-3.5 ${
                           isLoading || isPending ? "animate-spin" : ""
                        }`}
                     />
                     <span>Refresh</span>
                  </Button>

                  <Button
                     type="button"
                     variant="outline"
                     size="sm"
                     onClick={handleExportJson}
                     disabled={logs.length === 0}
                     className="h-9 px-3.5 rounded-xl border-[#383838] bg-[#1d1d1d] hover:bg-[#262626] text-white text-xs font-medium gap-1.5"
                  >
                     <Download className="h-3.5 w-3.5 text-[#e08a32]" />
                     <span>Export JSON</span>
                  </Button>
               </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="space-y-4">
               <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#868686]" />
                  <Input
                     value={searchQuery}
                     onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                     }}
                     placeholder="Search audit trail by admin, action, target entity, or reason..."
                     className="h-11 rounded-2xl bg-[#1d1d1d] border-[#2e2e2e] focus:border-[#483c30] text-white pl-10 pr-4 text-xs"
                  />
               </div>

               <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  <Filter className="h-3.5 w-3.5 text-[#868686] shrink-0 mr-1" />
                  {(
                     [
                        ["ALL", "All Actions"],
                        ["DETAILS", "Event Details"],
                        ["ROSTER", "Roster Edits"],
                        ["HOURS", "Hours Overrides"],
                        ["STUDY_LOGS", "Study Hour Logs"],
                        ["LIFECYCLE", "Status & Lifecycle"],
                     ] as const
                  ).map(([cat, label]) => (
                     <button
                        key={cat}
                        type="button"
                        onClick={() => {
                           setSelectedCategory(cat);
                           setCurrentPage(1);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                           selectedCategory === cat
                              ? "bg-[#e08a32] text-black shadow-sm"
                              : "bg-[#1d1d1d] text-[#868686] hover:text-white hover:bg-[#262626] border border-[#2a2a2a]"
                        }`}
                     >
                        {label}
                     </button>
                  ))}
               </div>
            </div>
         </div>

         {/* Main Audit Timeline Content */}
         <div className="space-y-4">
            {/* Loading State Skeleton */}
            {isLoading && (
               <div className="rounded-3xl border border-[#262626] bg-[#141414] p-6 space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                     <div
                        key={i}
                        className="animate-pulse flex items-start gap-4 p-4 rounded-2xl bg-[#1d1d1d]/60 border border-[#262626]"
                     >
                        <div className="h-10 w-10 rounded-full bg-[#2a2a2a]" />
                        <div className="flex-1 space-y-2">
                           <div className="h-4 w-1/3 rounded bg-[#2a2a2a]" />
                           <div className="h-3 w-1/2 rounded bg-[#2a2a2a]" />
                        </div>
                        <div className="h-6 w-24 rounded bg-[#2a2a2a]" />
                     </div>
                  ))}
               </div>
            )}

            {/* Error State */}
            {!isLoading && errorMessage && (
               <div className="rounded-3xl border border-[#ef4444]/30 bg-[#251010] p-8 text-center space-y-3">
                  <p className="text-sm font-semibold text-[#f87171]">
                     {errorMessage}
                  </p>
                  <Button
                     type="button"
                     variant="outline"
                     size="sm"
                     onClick={fetchLogs}
                     className="rounded-xl border-[#ef4444]/40 text-white"
                  >
                     Try Again
                  </Button>
               </div>
            )}

            {/* Empty State */}
            {!isLoading && !errorMessage && filteredLogs.length === 0 && (
               <div className="rounded-3xl border border-[#262626] bg-[#141414] p-12 text-center space-y-3">
                  <Clock className="h-8 w-8 text-[#868686] mx-auto opacity-60" />
                  <h3 className="text-sm font-semibold text-white">
                     {searchQuery || selectedCategory !== "ALL"
                        ? "No matching audit logs found"
                        : "No audit logs recorded for this event yet"}
                  </h3>
                  <p className="text-xs text-[#868686] max-w-sm mx-auto">
                     {searchQuery || selectedCategory !== "ALL"
                        ? "Try clearing filters or search terms to view all recorded administrative events."
                        : "Any changes to event title, schedule, houses, rosters, or study hour overrides will be automatically recorded here."}
                  </p>
               </div>
            )}

            {/* Audit Log Entries List */}
            {!isLoading && !errorMessage && filteredLogs.length > 0 && (
               <>
                  <div className="space-y-3">
                     {paginatedLogs.map((log) => {
                        const isExpanded = expandedLogIds.has(log.id);
                        const badgeStyle = getActionBadgeStyle(log.actionType);
                        const actionLabel = formatAuditActionHuman(
                           log.actionType
                        );
                        const relativeTime = formatRelativeTime(log.timestamp);
                        const clockTime = formatUtcClock(log.timestamp);

                        const hasDiff =
                           log.previousValue !== null || log.newValue !== null;

                        return (
                           <div
                              key={log.id}
                              className="rounded-2xl border border-[#262626] bg-[#141414] hover:border-[#383838] transition-all shadow-md overflow-hidden"
                           >
                              <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                 {/* Column 1 & 2: Admin + Action Info */}
                                 <div className="flex items-start gap-3.5 flex-1 min-w-0">
                                    {/* Admin Avatar */}
                                    <div className="relative shrink-0">
                                       {log.actorImage ? (
                                          <Image
                                             src={log.actorImage}
                                             alt={
                                                log.actorDisplayName ||
                                                log.actorUsername
                                             }
                                             width={40}
                                             height={40}
                                             className="h-10 w-10 rounded-full border border-[#383838] object-cover"
                                          />
                                       ) : (
                                          <div className="h-10 w-10 rounded-full border border-[#383838] bg-[#221b2c] text-[#d8cce8] flex items-center justify-center font-bold text-sm">
                                             {(
                                                log.actorDisplayName ||
                                                log.actorUsername ||
                                                "A"
                                             )
                                                .slice(0, 1)
                                                .toUpperCase()}
                                          </div>
                                       )}
                                    </div>

                                    {/* Main Description */}
                                    <div className="space-y-1.5 min-w-0 flex-1">
                                       <div className="flex flex-wrap items-center gap-2">
                                          <span className="text-sm font-bold text-white truncate">
                                             {log.actorDisplayName ||
                                                log.actorUsername}
                                          </span>
                                          <span className="text-xs text-[#868686]">
                                             @{log.actorUsername}
                                          </span>

                                          {/* Action Badge */}
                                          <span
                                             className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${badgeStyle}`}
                                          >
                                             {actionLabel}
                                          </span>

                                          {/* Target Entity Name Pill */}
                                          {log.targetEntityName && (
                                             <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#1d1d1d] text-[#c9c9c9] border border-[#2e2e2e] truncate max-w-[200px]">
                                                {log.targetEntityName}
                                             </span>
                                          )}
                                       </div>

                                       {/* Audit Reason / Human Summary */}
                                       <p className="text-xs text-[#d1d1d1] leading-relaxed">
                                          {log.auditReason ||
                                             "Administrative update executed"}
                                       </p>
                                    </div>
                                 </div>

                                 {/* Column 4: Time Clock & Details Trigger */}
                                 <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#262626]">
                                    <div className="text-right">
                                       <span className="block text-xs font-semibold text-white font-mono">
                                          {relativeTime}
                                       </span>
                                       <span className="block text-[10px] text-[#868686] font-mono">
                                          {clockTime}
                                       </span>
                                    </div>

                                    {hasDiff && (
                                       <button
                                          type="button"
                                          onClick={() => toggleExpand(log.id)}
                                          className="inline-flex items-center gap-1 text-[11px] text-[#e08a32] hover:text-[#f5ba73] font-medium transition-colors"
                                       >
                                          <span>
                                             {isExpanded
                                                ? "Hide Diff"
                                                : "View Diff"}
                                          </span>
                                          {isExpanded ? (
                                             <ChevronUp className="h-3 w-3" />
                                          ) : (
                                             <ChevronDown className="h-3 w-3" />
                                          )}
                                       </button>
                                    )}
                                 </div>
                              </div>

                              {/* Expandable Field-Level Diff Panel */}
                              {isExpanded && hasDiff && (
                                 <div className="px-5 pb-5 pt-2 border-t border-[#262626] bg-[#191919] space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                                       {/* Previous Value */}
                                       <div className="rounded-xl border border-[#382e25] bg-[#231d18]/70 p-3 space-y-1.5">
                                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#c87948]">
                                             Previous State
                                          </span>
                                          <pre className="text-[11px] font-mono text-[#d8cfc4] overflow-x-auto whitespace-pre-wrap leading-tight bg-[#1b1713] p-2.5 rounded-lg border border-[#382e25]/60 max-h-48">
                                             {log.previousValue !== null &&
                                             log.previousValue !== undefined
                                                ? JSON.stringify(
                                                     log.previousValue,
                                                     null,
                                                     2
                                                  )
                                                : "None (Created fresh)"}
                                          </pre>
                                       </div>

                                       {/* New Value */}
                                       <div className="rounded-xl border border-[#2a3c2c] bg-[#17271c]/70 p-3 space-y-1.5">
                                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#529e72]">
                                             New Updated State
                                          </span>
                                          <pre className="text-[11px] font-mono text-[#e5f5eb] overflow-x-auto whitespace-pre-wrap leading-tight bg-[#111f15] p-2.5 rounded-lg border border-[#2a3c2c]/60 max-h-48">
                                             {log.newValue !== null &&
                                             log.newValue !== undefined
                                                ? JSON.stringify(
                                                     log.newValue,
                                                     null,
                                                     2
                                                  )
                                                : "None (Deleted)"}
                                          </pre>
                                       </div>
                                    </div>
                                 </div>
                              )}
                           </div>
                        );
                     })}
                  </div>

                  {/* Pagination Controls */}
                  <DataPagination
                     currentPage={safePage}
                     totalPages={totalPages}
                     totalItems={filteredLogs.length}
                     pageSize={pageSize}
                     onPageChange={setCurrentPage}
                     itemLabel="audit logs"
                  />
               </>
            )}
         </div>
      </div>
   );
}
