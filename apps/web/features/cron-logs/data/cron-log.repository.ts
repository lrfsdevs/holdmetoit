import { prisma } from "@/core/db";
import type {
   CronOverview,
   CronRunDetail,
   CronRunListItem,
   CronRunListResult,
   CronStatus,
} from "../domain/cron-log.types";

const MAX_LIMIT = 100;

const RUN_LIST_SELECT = {
   id: true,
   jobName: true,
   trigger: true,
   status: true,
   challengeId: true,
   startedAt: true,
   finishedAt: true,
   durationMs: true,
   summary: true,
   errorCode: true,
   errorMessage: true,
} as const;

export interface ListCronRunsInput {
   jobName?: string;
   status?: CronStatus;
   limit?: number;
   offset?: number;
}

function toIso(value: Date | null | undefined): string | null {
   return value ? value.toISOString() : null;
}

function toRunListItem(row: any): CronRunListItem {
   return {
      id: row.id,
      jobName: row.jobName,
      trigger: row.trigger,
      status: row.status,
      challengeId: row.challengeId ?? null,
      startedAt: row.startedAt.toISOString(),
      finishedAt: toIso(row.finishedAt),
      durationMs: row.durationMs ?? null,
      summary: row.summary ?? null,
      errorCode: row.errorCode ?? null,
      errorMessage: row.errorMessage ?? null,
   };
}

export async function listCronRuns(
   input: ListCronRunsInput = {}
): Promise<CronRunListResult> {
   const limit = Math.min(Math.max(input.limit ?? 25, 1), MAX_LIMIT);
   const offset = Math.max(input.offset ?? 0, 0);

   const rows = await prisma.cronLog.findMany({
      where: {
         ...(input.jobName ? { jobName: input.jobName } : {}),
         ...(input.status ? { status: input.status } : {}),
      },
      orderBy: { startedAt: "desc" },
      skip: offset,
      take: limit + 1,
      select: RUN_LIST_SELECT,
   });

   return {
      items: rows.slice(0, limit).map(toRunListItem),
      hasMore: rows.length > limit,
   };
}

export async function getCronRunDetail(
   cronLogId: string
): Promise<CronRunDetail | null> {
   const row = await prisma.cronLog.findUnique({
      where: { id: cronLogId },
      select: RUN_LIST_SELECT,
   });

   return row ? toRunListItem(row) : null;
}

export async function getCronOverview(): Promise<CronOverview> {
   const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

   const [lastIngest, lastBackup, counts] = await Promise.all([
      prisma.cronLog.findFirst({
         where: { jobName: "YPT_INGEST" },
         orderBy: { startedAt: "desc" },
         select: RUN_LIST_SELECT,
      }),
      prisma.cronLog.findFirst({
         where: { jobName: "DB_BACKUP" },
         orderBy: { startedAt: "desc" },
         select: RUN_LIST_SELECT,
      }),
      prisma.cronLog.groupBy({
         by: ["jobName", "status"],
         where: { startedAt: { gte: since } },
         _count: { _all: true },
      }),
   ]);

   return {
      lastIngest: lastIngest ? toRunListItem(lastIngest) : null,
      lastBackup: lastBackup ? toRunListItem(lastBackup) : null,
      last24h: counts.map((entry) => ({
         jobName: entry.jobName,
         status: entry.status as CronStatus,
         count: entry._count._all,
      })),
   };
}
