"use client";

import { ChevronRight } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import type { CronRunListItem } from "../domain/cron-log.types";
import { CronStatusBadge } from "./cron-status-badge";
import {
   formatAbsoluteTime,
   formatDurationMs,
   formatRelativeTime,
} from "./cron-logs-format";

interface CronRunListProps {
   runs: CronRunListItem[];
   onOpenRun: (runId: string) => void;
}

function errorLabel(run: CronRunListItem): string {
   return run.errorMessage ?? run.errorCode ?? "—";
}

export function CronRunList({ runs, onOpenRun }: CronRunListProps) {
   return (
      <>
         <div className="hidden overflow-hidden rounded-2xl border border-border-default bg-surface-primary sm:block">
            <table className="w-full text-left text-xs">
               <thead className="border-b border-border-subtle bg-surface-elevated text-meta uppercase tracking-wider text-text-tertiary">
                  <tr>
                     <th scope="col" className="px-4 py-3 font-semibold">
                        Status
                     </th>
                     <th scope="col" className="px-4 py-3 font-semibold">
                        Job
                     </th>
                     <th scope="col" className="px-4 py-3 font-semibold">
                        Trigger
                     </th>
                     <th scope="col" className="px-4 py-3 font-semibold">
                        Started
                     </th>
                     <th scope="col" className="px-4 py-3 font-semibold">
                        Duration
                     </th>
                     <th scope="col" className="px-4 py-3 font-semibold">
                        Error
                     </th>
                     <th scope="col" className="px-4 py-3">
                        <span className="sr-only">Open</span>
                     </th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-border-subtle">
                  {runs.map((run) => (
                     <tr
                        key={run.id}
                        onClick={() => onOpenRun(run.id)}
                        className="cursor-pointer transition-colors hover:bg-surface-elevated"
                     >
                        <td className="px-4 py-3">
                           <CronStatusBadge status={run.status} />
                        </td>
                        <td className="px-4 py-3 font-mono text-meta text-text-secondary">
                           {run.jobName}
                        </td>
                        <td className="px-4 py-3 text-text-tertiary">
                           {run.trigger}
                        </td>
                        <td
                           className="px-4 py-3 text-text-secondary"
                           title={formatAbsoluteTime(run.startedAt)}
                        >
                           {formatRelativeTime(run.startedAt)}
                        </td>
                        <td className="px-4 py-3 font-mono text-text-secondary">
                           {formatDurationMs(run.durationMs)}
                        </td>
                        <td
                           className={`max-w-[220px] truncate px-4 py-3 ${
                              run.errorMessage
                                 ? "text-feedback-error-text"
                                 : "text-text-tertiary"
                           }`}
                           title={run.errorMessage ?? undefined}
                        >
                           {errorLabel(run)}
                        </td>
                        <td className="px-4 py-3 text-right">
                           <button
                              type="button"
                              onClick={(event) => {
                                 event.stopPropagation();
                                 onOpenRun(run.id);
                              }}
                              aria-label={`Open run ${run.id}`}
                              className="rounded-lg p-1 text-text-tertiary transition-colors hover:bg-surface-nested hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                           >
                              <ChevronRight className="h-4 w-4" />
                           </button>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>

         <div className="space-y-2 sm:hidden">
            {runs.map((run) => (
               <button
                  key={run.id}
                  type="button"
                  onClick={() => onOpenRun(run.id)}
                  className="w-full rounded-2xl border border-border-default bg-surface-primary p-4 text-left transition-colors hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
               >
                  <div className="flex items-start justify-between gap-2">
                     <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                           <CronStatusBadge status={run.status} />
                           <span className="font-mono text-meta text-text-secondary">
                              {run.jobName}
                           </span>
                        </div>
                        <p className="text-meta text-text-tertiary">
                           {run.trigger} · {formatRelativeTime(run.startedAt)} ·{" "}
                           {formatDurationMs(run.durationMs)}
                        </p>
                        {run.errorMessage ? (
                           <p className="line-clamp-2 text-meta text-feedback-error-text">
                              {run.errorMessage}
                           </p>
                        ) : null}
                     </div>
                     <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-text-tertiary" />
                  </div>
               </button>
            ))}
         </div>
      </>
   );
}

export function CronRunListSkeleton() {
   return (
      <div className="space-y-2" aria-label="Loading cron runs" role="status">
         {Array.from({ length: 5 }).map((_, index) => (
            <div
               key={index}
               className="flex items-center justify-between rounded-2xl border border-border-default bg-surface-primary px-4 py-4"
            >
               <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-4 w-24" />
               </div>
               <Skeleton className="h-4 w-16" />
            </div>
         ))}
      </div>
   );
}
