import { beforeEach, describe, expect, it, vi } from "vitest";

import {
   getCronOverviewAction,
   getCronRunDetailAction,
   listCronRunsAction,
} from "./cron-log.actions";
import * as devModule from "@/features/auth/api/require-dev";
import * as repoModule from "../data/cron-log.repository";
import type { CronRunDetail } from "../domain/cron-log.types";

vi.mock("@/features/auth/api/require-dev", () => ({
   DevAccessError: class DevAccessError extends Error {
      readonly code = "FORBIDDEN_NOT_DEV";
   },
   requireDevUser: vi.fn(),
}));

vi.mock("../data/cron-log.repository", () => ({
   listCronRuns: vi.fn(),
   getCronRunDetail: vi.fn(),
   getCronOverview: vi.fn(),
}));

const RUN_LIST = {
   items: [],
   hasMore: false,
};

const OVERVIEW = {
   lastIngest: null,
   lastBackup: null,
   last24h: [],
};

describe("cron-log read actions", () => {
   beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(devModule.requireDevUser).mockResolvedValue({
         id: "dev_1",
         username: "Developer",
         displayName: "Developer",
         role: "DEV",
      });
   });

   it("rejects non-DEV callers", async () => {
      vi.mocked(devModule.requireDevUser).mockRejectedValue(
         new devModule.DevAccessError()
      );

      const list = await listCronRunsAction({});
      const detail = await getCronRunDetailAction({ cronLogId: "run_1" });
      const overview = await getCronOverviewAction();

      expect(list.ok).toBe(false);
      expect(detail.ok).toBe(false);
      expect(overview.ok).toBe(false);
      if (!list.ok) expect(list.code).toBe("FORBIDDEN_NOT_DEV");
      if (!detail.ok) expect(detail.code).toBe("FORBIDDEN_NOT_DEV");
      if (!overview.ok) expect(overview.code).toBe("FORBIDDEN_NOT_DEV");
   });

   it("lists runs with parsed filters", async () => {
      vi.mocked(repoModule.listCronRuns).mockResolvedValue(RUN_LIST);

      const result = await listCronRunsAction({
         jobName: "YPT_INGEST",
         status: "FAILED",
         limit: 25,
         offset: 50,
      });

      expect(result).toEqual({ ok: true, data: RUN_LIST });
      expect(repoModule.listCronRuns).toHaveBeenCalledWith({
         jobName: "YPT_INGEST",
         status: "FAILED",
         limit: 25,
         offset: 50,
      });
   });

   it("rejects invalid filters", async () => {
      const result = await listCronRunsAction({ limit: 0 });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("INVALID_INPUT");
      expect(repoModule.listCronRuns).not.toHaveBeenCalled();
   });

   it("returns NOT_FOUND for a missing run", async () => {
      vi.mocked(repoModule.getCronRunDetail).mockResolvedValue(null);

      const result = await getCronRunDetailAction({ cronLogId: "missing" });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("NOT_FOUND");
   });

   it("returns the detail and overview payloads", async () => {
      const detail: CronRunDetail = {
         id: "run_1",
         jobName: "YPT_INGEST",
         trigger: "interval",
         status: "SUCCESS",
         challengeId: "c_1",
         startedAt: "2026-10-24T10:00:00.000Z",
         finishedAt: "2026-10-24T10:00:01.000Z",
         durationMs: 1000,
         summary: null,
         errorCode: null,
         errorMessage: null,
      };
      vi.mocked(repoModule.getCronRunDetail).mockResolvedValue(detail);
      vi.mocked(repoModule.getCronOverview).mockResolvedValue(OVERVIEW);

      const detailResult = await getCronRunDetailAction({
         cronLogId: "run_1",
      });
      const overviewResult = await getCronOverviewAction();

      expect(detailResult).toEqual({ ok: true, data: detail });
      expect(overviewResult).toEqual({ ok: true, data: OVERVIEW });
   });

   it("maps repository failures without leaking internals", async () => {
      const consoleError = vi
         .spyOn(console, "error")
         .mockImplementation(() => {});
      vi.mocked(repoModule.listCronRuns).mockRejectedValue(
         new Error("db down")
      );

      try {
         const result = await listCronRunsAction({});

         expect(result.ok).toBe(false);
         if (!result.ok) {
            expect(result.code).toBe("FETCH_CRON_LOGS_FAILED");
            expect(result.message).toBe("Failed to load cron runs.");
         }
         expect(consoleError).toHaveBeenCalled();
      } finally {
         consoleError.mockRestore();
      }
   });
});
