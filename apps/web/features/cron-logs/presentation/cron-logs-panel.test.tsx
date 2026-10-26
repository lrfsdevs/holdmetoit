// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
   cleanup,
   fireEvent,
   render,
   screen,
   waitFor,
} from "@testing-library/react";

import { CronLogsPanel } from "./cron-logs-panel";
import * as logActions from "../api/cron-log.actions";
import type {
   CronOverview,
   CronRunDetail,
   CronRunListItem,
} from "../domain/cron-log.types";

vi.mock("../api/cron-log.actions", () => ({
   listCronRunsAction: vi.fn(),
   getCronRunDetailAction: vi.fn(),
   getCronOverviewAction: vi.fn(),
}));

vi.mock("sonner", () => ({
   toast: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
   },
}));

afterEach(cleanup);

const RUN: CronRunListItem = {
   id: "run_1",
   jobName: "YPT_INGEST",
   trigger: "interval",
   status: "SUCCESS",
   challengeId: "c_1",
   startedAt: "2026-10-24T10:00:00.000Z",
   finishedAt: "2026-10-24T10:00:01.400Z",
   durationMs: 1400,
   summary: { fetchedMembers: 2, upsertedCount: 2 },
   errorCode: null,
   errorMessage: null,
};

const BACKUP: CronRunListItem = {
   id: "backup_1",
   jobName: "DB_BACKUP",
   trigger: "scheduled",
   status: "SUCCESS",
   challengeId: null,
   startedAt: "2026-10-24T00:00:00.000Z",
   finishedAt: "2026-10-24T00:00:08.000Z",
   durationMs: 8000,
   summary: { filename: "holdmetoit-2026-10-24.dump", sizeBytes: 1024 },
   errorCode: null,
   errorMessage: null,
};

const OVERVIEW: CronOverview = {
   lastIngest: RUN,
   lastBackup: BACKUP,
   last24h: [
      { jobName: "YPT_INGEST", status: "SUCCESS", count: 10 },
      { jobName: "YPT_INGEST", status: "FAILED", count: 1 },
      { jobName: "DB_BACKUP", status: "SKIPPED", count: 2 },
   ],
};

const DETAIL: CronRunDetail = RUN;

beforeEach(() => {
   vi.clearAllMocks();

   vi.mocked(logActions.listCronRunsAction).mockResolvedValue({
      ok: true,
      data: { items: [RUN], hasMore: false },
   });
   vi.mocked(logActions.getCronOverviewAction).mockResolvedValue({
      ok: true,
      data: OVERVIEW,
   });
   vi.mocked(logActions.getCronRunDetailAction).mockResolvedValue({
      ok: true,
      data: DETAIL,
   });
});

async function openRun(id = RUN.id) {
   render(<CronLogsPanel />);
   await screen.findByText("interval");
   fireEvent.click(screen.getByRole("button", { name: `Open run ${id}` }));
   await screen.findByText("Run detail");
}

describe("CronLogsPanel", () => {
   it("loads the overview and the run list", async () => {
      render(<CronLogsPanel />);

      await screen.findByText("interval");
      expect(screen.getByText("Last ingest")).toBeTruthy();
      expect(screen.getByText("Last backup")).toBeTruthy();
      expect(logActions.listCronRunsAction).toHaveBeenCalledWith({
         jobName: undefined,
         status: undefined,
         limit: 25,
         offset: 0,
      });
   });

   it("renders the empty state", async () => {
      vi.mocked(logActions.listCronRunsAction).mockResolvedValue({
         ok: true,
         data: { items: [], hasMore: false },
      });

      render(<CronLogsPanel />);

      await screen.findByText("No cron runs yet");
   });

   it("renders an error and retries", async () => {
      vi.mocked(logActions.listCronRunsAction)
         .mockResolvedValueOnce({ ok: false, code: "X", message: "boom" })
         .mockResolvedValue({
            ok: true,
            data: { items: [RUN], hasMore: false },
         });

      render(<CronLogsPanel />);

      await screen.findByText("boom");
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));

      await screen.findByText("interval");
      expect(logActions.listCronRunsAction).toHaveBeenCalledTimes(2);
   });

   it("reloads with the selected job filter", async () => {
      render(<CronLogsPanel />);
      await screen.findByText("interval");

      fireEvent.click(screen.getByRole("button", { name: "DB_BACKUP" }));

      await waitFor(() => {
         expect(logActions.listCronRunsAction).toHaveBeenLastCalledWith({
            jobName: "DB_BACKUP",
            status: undefined,
            limit: 25,
            offset: 0,
         });
      });
   });

   it("opens the run detail with status and summary", async () => {
      await openRun();

      expect(screen.getAllByText("YPT_INGEST").length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Started/).length).toBeGreaterThan(0);
      expect(screen.getByText(/fetchedMembers/)).toBeTruthy();
      expect(logActions.getCronRunDetailAction).toHaveBeenCalledWith({
         cronLogId: "run_1",
      });
   });

   it("opens backup runs without any undo controls", async () => {
      vi.mocked(logActions.listCronRunsAction).mockResolvedValue({
         ok: true,
         data: { items: [BACKUP], hasMore: false },
      });
      vi.mocked(logActions.getCronRunDetailAction).mockResolvedValue({
         ok: true,
         data: BACKUP,
      });

      render(<CronLogsPanel />);
      await screen.findByText("scheduled");
      fireEvent.click(
         screen.getByRole("button", { name: `Open run ${BACKUP.id}` })
      );

      await screen.findByText("Run detail");
      expect(screen.getAllByText("DB_BACKUP").length).toBeGreaterThan(0);
      expect(screen.queryByRole("button", { name: /undo/i })).toBeNull();
   });
});
