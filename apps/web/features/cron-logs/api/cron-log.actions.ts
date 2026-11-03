"use server";

import { z } from "zod";
import { toClientError } from "@/core/errors";

import {
   DevAccessError,
   requireDevUser,
} from "@/features/auth/api/require-dev";
import {
   getCronOverview,
   getCronRunDetail,
   listCronRuns,
} from "../data/cron-log.repository";
import type {
   CronOverview,
   CronResult,
   CronRunDetail,
   CronRunListResult,
} from "../domain/cron-log.types";

const listSchema = z.object({
   jobName: z.enum(["YPT_INGEST", "DB_BACKUP"]).optional(),
   status: z.enum(["RUNNING", "SUCCESS", "FAILED", "SKIPPED"]).optional(),
   limit: z.number().int().min(1).max(100).optional(),
   offset: z.number().int().min(0).optional(),
});

const detailSchema = z.object({
   cronLogId: z.string().min(1),
});

function isDevAccessError(error: unknown): boolean {
   return (
      error instanceof DevAccessError ||
      (error as { code?: string })?.code === "FORBIDDEN_NOT_DEV"
   );
}

const FORBIDDEN = {
   ok: false as const,
   code: "FORBIDDEN_NOT_DEV",
   message: "Developer permissions required.",
};

export async function listCronRunsAction(
   input: unknown = {}
): Promise<CronResult<CronRunListResult>> {
   try {
      await requireDevUser();

      const parsed = listSchema.safeParse(input);
      if (!parsed.success) {
         return {
            ok: false,
            code: "INVALID_INPUT",
            message: parsed.error.issues[0]?.message ?? "Invalid run filters.",
         };
      }

      return { ok: true, data: await listCronRuns(parsed.data) };
   } catch (error) {
      if (isDevAccessError(error)) return FORBIDDEN;

      console.error("listCronRunsAction failed", error);
      return {
         ok: false,
         code: "FETCH_CRON_LOGS_FAILED",
         message: "Failed to load cron runs.",
      };
   }
}

export async function getCronRunDetailAction(
   input: unknown
): Promise<CronResult<CronRunDetail>> {
   try {
      await requireDevUser();

      const parsed = detailSchema.safeParse(input);
      if (!parsed.success) {
         return {
            ok: false,
            code: "INVALID_INPUT",
            message: parsed.error.issues[0]?.message ?? "Invalid run id.",
         };
      }

      const detail = await getCronRunDetail(parsed.data.cronLogId);
      if (!detail) {
         return {
            ok: false,
            code: "NOT_FOUND",
            message: "Cron run not found.",
         };
      }

      return { ok: true, data: detail };
   } catch (error) {
      if (isDevAccessError(error)) return FORBIDDEN;

      const clientError = toClientError(error, {
         scope: "cron_logs.detail",
         defaultCode: "FETCH_CRON_LOGS_FAILED",
         defaultMessage: "Failed to load the cron run.",
      });

      return {
         ok: false,
         code: clientError.code,
         message: clientError.message,
      };
   }
}

export async function getCronOverviewAction(): Promise<
   CronResult<CronOverview>
> {
   try {
      await requireDevUser();
      return { ok: true, data: await getCronOverview() };
   } catch (error) {
      if (isDevAccessError(error)) return FORBIDDEN;

      const clientError = toClientError(error, {
         scope: "cron_logs.overview",
         defaultCode: "FETCH_CRON_LOGS_FAILED",
         defaultMessage: "Failed to load the cron overview.",
      });

      return {
         ok: false,
         code: clientError.code,
         message: clientError.message,
      };
   }
}
