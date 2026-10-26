"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
   Activity,
   AlertTriangle,
   Database,
   Loader2,
   RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
   getCronOverviewAction,
   getCronRunDetailAction,
   listCronRunsAction,
} from "../api/cron-log.actions";
import type {
   CronJob,
   CronOverview,
   CronRunDetail,
   CronRunListItem,
   CronStatus,
} from "../domain/cron-log.types";
import { CronRunDetailSheet } from "./cron-run-detail-sheet";
import { CronRunList, CronRunListSkeleton } from "./cron-run-list";
import { CronStatusBadge } from "./cron-status-badge";
import {
   formatBytes,
   formatDurationMs,
   formatRelativeTime,
   summaryFilename,
   summarySize,
} from "./cron-logs-format";

const PAGE_SIZE = 25;

type JobFilter = "ALL" | CronJob;
type StatusFilter = "ALL" | CronStatus;

const JOB_FILTERS: JobFilter[] = ["ALL", "YPT_INGEST", "DB_BACKUP"];
const STATUS_FILTERS: StatusFilter[] = [
   "ALL",
   "RUNNING",
   "SUCCESS",
   "FAILED",
   "SKIPPED",
];

function FilterPill({
   active,
   onClick,
   children,
}: {
   active: boolean;
   onClick: () => void;
   children: React.ReactNode;
}) {
   return (
      <button
         type="button"
         aria-pressed={active}
         onClick={onClick}
         className={`rounded-full border px-3 py-1.5 text-meta font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus ${
            active
               ? "border-border-strong bg-surface-nested text-text-primary"
               : "border-border-default bg-surface-primary text-text-tertiary hover:bg-surface-elevated"
         }`}
      >
         {children}
      </button>
   );
}

function OverviewCard({
   title,
   icon,
   onOpen,
   children,
}: {
   title: string;
   icon: React.ReactNode;
   onOpen?: () => void;
   children: React.ReactNode;
}) {
   const content = (
      <>
         <div className="flex items-center justify-between">
            <span className="text-meta font-semibold uppercase tracking-wider text-text-tertiary">
               {title}
            </span>
            {icon}
         </div>
         <div className="mt-2 space-y-1">{children}</div>
      </>
   );

   if (onOpen) {
      return (
         <button
            type="button"
            onClick={onOpen}
            className="rounded-2xl border border-border-default bg-surface-primary p-4 text-left transition-colors hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
         >
            {content}
         </button>
      );
   }

   return (
      <div className="rounded-2xl border border-border-default bg-surface-primary p-4">
         {content}
      </div>
   );
}

function OverviewCards({
   overview,
   onOpenRun,
}: {
   overview: CronOverview | null;
   onOpenRun: (runId: string) => void;
}) {
   if (!overview) {
      return (
         <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
               <div
                  key={index}
                  className="h-24 animate-pulse rounded-2xl border border-border-default bg-surface-primary"
               />
            ))}
         </div>
      );
   }

   const totals = overview.last24h.reduce(
      (acc, item) => {
         if (item.status === "SUCCESS") acc.success += item.count;
         if (item.status === "FAILED") acc.failed += item.count;
         if (item.status === "SKIPPED") acc.skipped += item.count;
         return acc;
      },
      { success: 0, failed: 0, skipped: 0 }
   );

   const ingest = overview.lastIngest;
   const backup = overview.lastBackup;

   return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
         <OverviewCard
            title="Last ingest"
            icon={<Activity className="h-4 w-4 text-brand-1" />}
            onOpen={ingest ? () => onOpenRun(ingest.id) : undefined}
         >
            {ingest ? (
               <>
                  <div className="flex flex-wrap items-center gap-2">
                     <CronStatusBadge status={ingest.status} />
                     <span className="text-meta text-text-tertiary">
                        {formatRelativeTime(ingest.startedAt)}
                     </span>
                  </div>
                  <p className="text-meta text-text-secondary">
                     {formatDurationMs(ingest.durationMs)}
                  </p>
               </>
            ) : (
               <p className="text-meta text-text-tertiary">
                  No ingest runs yet.
               </p>
            )}
         </OverviewCard>

         <OverviewCard
            title="Last backup"
            icon={<Database className="h-4 w-4 text-brand-1" />}
            onOpen={backup ? () => onOpenRun(backup.id) : undefined}
         >
            {backup ? (
               <>
                  <div className="flex flex-wrap items-center gap-2">
                     <CronStatusBadge status={backup.status} />
                     <span className="text-meta text-text-tertiary">
                        {formatRelativeTime(backup.startedAt)}
                     </span>
                  </div>
                  <p className="truncate text-meta text-text-secondary">
                     {summaryFilename(backup.summary) ?? "—"} ·{" "}
                     {formatBytes(summarySize(backup.summary))}
                  </p>
               </>
            ) : (
               <p className="text-meta text-text-tertiary">No backups yet.</p>
            )}
         </OverviewCard>

         <OverviewCard
            title="Last 24h"
            icon={<Activity className="h-4 w-4 text-text-tertiary" />}
         >
            <p className="font-display text-xl font-bold text-text-primary">
               {totals.success}{" "}
               <span className="text-meta font-medium text-text-tertiary">
                  ok
               </span>
            </p>
            <p className="text-meta text-text-tertiary">
               <span className="text-feedback-error-text">
                  {totals.failed} failed
               </span>
               {" · "}
               {totals.skipped} skipped
            </p>
         </OverviewCard>
      </div>
   );
}

function EmptyState({
   hasFilters,
   onClear,
}: {
   hasFilters: boolean;
   onClear: () => void;
}) {
   return (
      <div className="rounded-2xl border border-dashed border-border-default bg-surface-page p-10 text-center">
         <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-border-strong bg-surface-secondary text-text-tertiary">
            <Activity className="h-6 w-6" />
         </div>
         <h3 className="mt-4 text-base font-semibold text-text-primary">
            {hasFilters ? "No runs match these filters" : "No cron runs yet"}
         </h3>
         <p className="mx-auto mt-1 max-w-sm text-xs text-text-tertiary">
            {hasFilters
               ? "Try clearing the job or status filter."
               : "The bot writes a row after each ingestion cycle and each backup run."}
         </p>
         {hasFilters ? (
            <div className="mt-4">
               <Button variant="outline" size="sm" onClick={onClear}>
                  Clear filters
               </Button>
            </div>
         ) : null}
      </div>
   );
}

export function CronLogsPanel() {
   const [jobFilter, setJobFilter] = useState<JobFilter>("ALL");
   const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

   const [runs, setRuns] = useState<CronRunListItem[]>([]);
   const [hasMore, setHasMore] = useState(false);
   const [isLoading, setIsLoading] = useState(true);
   const [isLoadingMore, setIsLoadingMore] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [overview, setOverview] = useState<CronOverview | null>(null);

   const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
   const [detail, setDetail] = useState<CronRunDetail | null>(null);
   const [isDetailLoading, setIsDetailLoading] = useState(false);
   const [detailError, setDetailError] = useState<string | null>(null);

   const detailRequest = useRef(0);

   const query = useCallback(
      (offset: number) => ({
         jobName: jobFilter === "ALL" ? undefined : jobFilter,
         status: statusFilter === "ALL" ? undefined : statusFilter,
         limit: PAGE_SIZE,
         offset,
      }),
      [jobFilter, statusFilter]
   );

   const loadOverview = useCallback(async () => {
      const result = await getCronOverviewAction();
      if (result.ok) setOverview(result.data);
   }, []);

   const loadRuns = useCallback(async () => {
      setIsLoading(true);
      setError(null);

      const [listResult] = await Promise.all([
         listCronRunsAction(query(0)),
         loadOverview(),
      ]);

      if (listResult.ok) {
         setRuns(listResult.data.items);
         setHasMore(listResult.data.hasMore);
      } else {
         setError(listResult.message);
      }

      setIsLoading(false);
   }, [loadOverview, query]);

   useEffect(() => {
      void loadRuns();
   }, [loadRuns]);

   const loadMore = async () => {
      setIsLoadingMore(true);
      const result = await listCronRunsAction(query(runs.length));

      if (result.ok) {
         setRuns((previous) => {
            const seen = new Set(previous.map((run) => run.id));
            return [
               ...previous,
               ...result.data.items.filter((run) => !seen.has(run.id)),
            ];
         });
         setHasMore(result.data.hasMore);
      } else {
         toast.error(result.message);
      }

      setIsLoadingMore(false);
   };

   const openRun = useCallback(async (runId: string) => {
      const requestId = detailRequest.current + 1;
      detailRequest.current = requestId;

      setSelectedRunId(runId);
      setDetail(null);
      setDetailError(null);
      setIsDetailLoading(true);

      const result = await getCronRunDetailAction({ cronLogId: runId });
      if (requestId !== detailRequest.current) return;

      if (result.ok) setDetail(result.data);
      else setDetailError(result.message);

      setIsDetailLoading(false);
   }, []);

   const closeRun = () => {
      detailRequest.current += 1;
      setSelectedRunId(null);
      setDetail(null);
      setDetailError(null);
   };

   const hasFilters = jobFilter !== "ALL" || statusFilter !== "ALL";
   const clearFilters = () => {
      setJobFilter("ALL");
      setStatusFilter("ALL");
   };

   return (
      <div className="space-y-5">
         <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
               <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-text-primary">
                  <Activity className="h-4 w-4 text-brand-1" />
                  Cron Logs
               </h2>
               <p className="mt-0.5 text-xs text-text-tertiary">
                  Ingestion and backup run history and status.
               </p>
            </div>
            <Button
               variant="outline"
               size="sm"
               onClick={() => void loadRuns()}
               disabled={isLoading}
            >
               {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
               ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
               )}
               Refresh
            </Button>
         </header>

         <OverviewCards overview={overview} onOpenRun={openRun} />

         <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
               <span className="w-12 text-meta font-semibold uppercase tracking-wider text-text-tertiary">
                  Job
               </span>
               {JOB_FILTERS.map((value) => (
                  <FilterPill
                     key={value}
                     active={jobFilter === value}
                     onClick={() => setJobFilter(value)}
                  >
                     {value}
                  </FilterPill>
               ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
               <span className="w-12 text-meta font-semibold uppercase tracking-wider text-text-tertiary">
                  Status
               </span>
               {STATUS_FILTERS.map((value) => (
                  <FilterPill
                     key={value}
                     active={statusFilter === value}
                     onClick={() => setStatusFilter(value)}
                  >
                     {value}
                  </FilterPill>
               ))}
            </div>
         </div>

         {error ? (
            <div
               role="alert"
               className="flex items-start gap-2 rounded-2xl border border-feedback-error/30 bg-feedback-error/10 px-4 py-3 text-xs text-feedback-error-text"
            >
               <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
               <div className="space-y-2">
                  <p>{error}</p>
                  <Button
                     variant="outline"
                     size="sm"
                     onClick={() => void loadRuns()}
                  >
                     Retry
                  </Button>
               </div>
            </div>
         ) : null}

         {isLoading ? (
            <CronRunListSkeleton />
         ) : runs.length === 0 ? (
            <EmptyState hasFilters={hasFilters} onClear={clearFilters} />
         ) : (
            <>
               <CronRunList runs={runs} onOpenRun={(id) => void openRun(id)} />
               {hasMore ? (
                  <div className="flex justify-center">
                     <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void loadMore()}
                        disabled={isLoadingMore}
                     >
                        {isLoadingMore ? (
                           <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        Load more
                     </Button>
                  </div>
               ) : null}
            </>
         )}

         <CronRunDetailSheet
            open={Boolean(selectedRunId)}
            detail={detail}
            isLoading={isDetailLoading}
            error={detailError}
            onClose={closeRun}
            onRetry={() => {
               if (selectedRunId) void openRun(selectedRunId);
            }}
         />
      </div>
   );
}
