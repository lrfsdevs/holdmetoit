export type CronStatus = "RUNNING" | "SUCCESS" | "FAILED" | "SKIPPED";

export type CronJob = "YPT_INGEST" | "DB_BACKUP";

export interface CronRunListItem {
   id: string;
   jobName: string;
   trigger: string;
   status: CronStatus;
   challengeId: string | null;
   startedAt: string;
   finishedAt: string | null;
   durationMs: number | null;
   summary: unknown;
   errorCode: string | null;
   errorMessage: string | null;
}

export type CronRunDetail = CronRunListItem;

export interface CronRunListResult {
   items: CronRunListItem[];
   hasMore: boolean;
}

export interface CronOverview {
   lastIngest: CronRunListItem | null;
   lastBackup: CronRunListItem | null;
   last24h: Array<{
      jobName: string;
      status: CronStatus;
      count: number;
   }>;
}

export type CronResult<T> =
   { ok: true; data: T } | { ok: false; code: string; message: string };
