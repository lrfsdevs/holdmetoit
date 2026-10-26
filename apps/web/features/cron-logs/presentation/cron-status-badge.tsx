import type { CronStatus } from "../domain/cron-log.types";

const STYLES: Record<CronStatus, string> = {
   SUCCESS:
      "bg-feedback-success/15 text-feedback-success-text border-feedback-success/30",
   FAILED:
      "bg-feedback-error/15 text-feedback-error-text border-feedback-error/30",
   SKIPPED: "bg-surface-nested text-text-secondary border-border-strong",
   RUNNING:
      "bg-feedback-info/15 text-feedback-info-text border-feedback-info/30",
};

export function CronStatusBadge({ status }: { status: CronStatus }) {
   return (
      <span
         className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-meta font-semibold ${STYLES[status]}`}
      >
         {status === "RUNNING" && (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
         )}
         {status}
      </span>
   );
}
