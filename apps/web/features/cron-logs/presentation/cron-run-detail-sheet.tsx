"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
   Sheet,
   SheetContent,
   SheetDescription,
   SheetHeader,
   SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { CronRunDetail } from "../domain/cron-log.types";
import { CronStatusBadge } from "./cron-status-badge";
import {
   formatAbsoluteTime,
   formatDurationMs,
   shortId,
} from "./cron-logs-format";

interface CronRunDetailSheetProps {
   open: boolean;
   detail: CronRunDetail | null;
   isLoading: boolean;
   error: string | null;
   onClose: () => void;
   onRetry: () => void;
}

function DetailSkeleton() {
   return (
      <div className="space-y-4" role="status" aria-label="Loading run detail">
         <Skeleton className="h-6 w-48" />
         <Skeleton className="h-4 w-full" />
         <Skeleton className="h-4 w-2/3" />
         <Skeleton className="h-24 w-full" />
      </div>
   );
}

function ErrorState({
   message,
   onRetry,
}: {
   message: string;
   onRetry: () => void;
}) {
   return (
      <div
         role="alert"
         className="rounded-2xl border border-feedback-error/30 bg-feedback-error/10 p-4"
      >
         <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-feedback-error-text" />
            <div className="space-y-2">
               <p className="text-xs text-feedback-error-text">{message}</p>
               <Button variant="outline" size="sm" onClick={onRetry}>
                  Retry
               </Button>
            </div>
         </div>
      </div>
   );
}

export function CronRunDetailSheet({
   open,
   detail,
   isLoading,
   error,
   onClose,
   onRetry,
}: CronRunDetailSheetProps) {
   return (
      <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
         <SheetContent
            side="right"
            className="w-full gap-5 overflow-y-auto sm:max-w-xl"
         >
            <SheetHeader>
               <SheetTitle>Run detail</SheetTitle>
               <SheetDescription>
                  Cron execution metadata and result summary.
               </SheetDescription>
            </SheetHeader>

            {isLoading ? (
               <DetailSkeleton />
            ) : error ? (
               <ErrorState message={error} onRetry={onRetry} />
            ) : detail ? (
               <div className="space-y-5">
                  <div className="space-y-2">
                     <div className="flex flex-wrap items-center gap-2">
                        <CronStatusBadge status={detail.status} />
                        <span className="font-mono text-xs text-text-secondary">
                           {detail.jobName}
                        </span>
                        <span className="text-meta text-text-tertiary">
                           · {detail.trigger}
                        </span>
                     </div>
                     <dl className="grid grid-cols-1 gap-2 text-meta sm:grid-cols-2">
                        <div>
                           <dt className="text-text-tertiary">Started</dt>
                           <dd className="text-text-secondary">
                              {formatAbsoluteTime(detail.startedAt)}
                           </dd>
                        </div>
                        <div>
                           <dt className="text-text-tertiary">Duration</dt>
                           <dd className="font-mono text-text-secondary">
                              {formatDurationMs(detail.durationMs)}
                           </dd>
                        </div>
                        <div>
                           <dt className="text-text-tertiary">Run ID</dt>
                           <dd className="font-mono text-text-secondary">
                              {shortId(detail.id)}
                           </dd>
                        </div>
                        <div>
                           <dt className="text-text-tertiary">Challenge</dt>
                           <dd className="font-mono text-text-secondary">
                              {detail.challengeId
                                 ? shortId(detail.challengeId, 12)
                                 : "—"}
                           </dd>
                        </div>
                     </dl>
                     {detail.errorMessage ? (
                        <p className="rounded-xl border border-feedback-error/30 bg-feedback-error/10 px-3 py-2 text-meta text-feedback-error-text">
                           {detail.errorCode ? `${detail.errorCode}: ` : ""}
                           {detail.errorMessage}
                        </p>
                     ) : null}
                  </div>

                  {detail.summary ? (
                     <div className="space-y-1.5">
                        <h3 className="text-label font-semibold uppercase tracking-wider text-text-tertiary">
                           Summary
                        </h3>
                        <pre className="max-h-72 overflow-auto rounded-xl border border-border-subtle bg-surface-nested p-3 text-meta font-mono text-text-secondary">
                           {JSON.stringify(detail.summary, null, 2)}
                        </pre>
                     </div>
                  ) : null}
               </div>
            ) : null}
         </SheetContent>
      </Sheet>
   );
}
