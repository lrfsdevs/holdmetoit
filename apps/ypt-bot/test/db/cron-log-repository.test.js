import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { env } from "../../src/config/env.js";
import {
   CRON_JOBS,
   pruneCronLogs,
   recordCronRun,
   recoverInterruptedRuns,
   withCronLog,
} from "../../src/db/cron-log-repository.js";

function createLoggerStub() {
   const records = [];

   return {
      records,
      info: (message, meta) => records.push({ level: "info", message, meta }),
      warn: (message, meta) => records.push({ level: "warn", message, meta }),
      error: (message, meta) => records.push({ level: "error", message, meta }),
      child() {
         return this;
      },
   };
}

function createDb({
   createResult = { id: "log_1" },
   createError,
   updateError,
} = {}) {
   const state = {
      created: [],
      updated: [],
      updatedMany: [],
      deletedRuns: [],
   };

   return {
      state,
      cronLog: {
         async create(args) {
            state.created.push(args);
            if (createError) throw createError;
            return createResult;
         },
         async update(args) {
            state.updated.push(args);
            if (updateError) throw updateError;
            return args;
         },
         async updateMany(args) {
            state.updatedMany.push(args);
            return { count: 2 };
         },
         async deleteMany(args) {
            state.deletedRuns.push(args);
            return { count: 3 };
         },
      },
   };
}

describe("withCronLog", () => {
   let log;

   beforeEach(() => {
      log = createLoggerStub();
   });

   it("creates a RUNNING row and finalizes SUCCESS with summary", async () => {
      const db = createDb();
      const result = {
         challengeId: "challenge_1",
         logDate: new Date("2026-10-10T00:00:00.000Z"),
         matchedCount: 3,
      };

      const returned = await withCronLog(
         { jobName: CRON_JOBS.YPT_INGEST, trigger: "interval", runId: "run_1" },
         async ({ runId }) => {
            assert.equal(runId, "run_1");
            return result;
         },
         { db, log }
      );

      assert.equal(returned, result);
      assert.equal(db.state.created.length, 1);
      assert.deepEqual(db.state.created[0].data, {
         jobName: CRON_JOBS.YPT_INGEST,
         runId: "run_1",
         trigger: "interval",
         status: "RUNNING",
         startedAt: db.state.created[0].data.startedAt,
      });

      assert.equal(db.state.updated.length, 1);
      const update = db.state.updated[0].data;
      assert.equal(update.status, "SUCCESS");
      assert.equal(update.challengeId, "challenge_1");
      assert.equal(typeof update.durationMs, "number");
      assert.equal(update.summary.logDate, "2026-10-10T00:00:00.000Z");
   });

   it("marks a skipped result as SKIPPED", async () => {
      const db = createDb();

      await withCronLog(
         { jobName: CRON_JOBS.DB_BACKUP, trigger: "scheduled" },
         async () => ({ skipped: true, filename: "x.dump" }),
         { db, log }
      );

      assert.equal(db.state.updated[0].data.status, "SKIPPED");
   });

   it("marks failures and rethrows", async () => {
      const db = createDb();
      const failure = Object.assign(new Error("boom"), { code: "P2022" });

      await assert.rejects(
         withCronLog(
            { jobName: CRON_JOBS.YPT_INGEST, trigger: "startup" },
            async () => {
               throw failure;
            },
            { db, log }
         ),
         (error) => error === failure
      );

      const update = db.state.updated[0].data;
      assert.equal(update.status, "FAILED");
      assert.equal(update.errorCode, "P2022");
      assert.equal(update.errorMessage, "boom");
   });

   it("still runs the job when the initial row insert fails", async () => {
      const db = createDb({ createError: new Error("db down") });

      const result = await withCronLog(
         { jobName: CRON_JOBS.YPT_INGEST, trigger: "interval" },
         async () => ({ ok: true }),
         { db, log }
      );

      assert.deepEqual(result, { ok: true });
      assert.equal(db.state.updated.length, 0);
      assert.ok(log.records.some((r) => r.message === "cron_log_write_failed"));
   });

   it("still returns the job result when the final update fails", async () => {
      const db = createDb({ updateError: new Error("db down") });

      const result = await withCronLog(
         { jobName: CRON_JOBS.YPT_INGEST, trigger: "interval" },
         async () => ({ ok: true }),
         { db, log }
      );

      assert.deepEqual(result, { ok: true });
      assert.ok(log.records.some((r) => r.message === "cron_log_write_failed"));
   });
});

describe("recordCronRun", () => {
   it("writes a completed SKIPPED overlap row", async () => {
      const db = createDb();
      const log = createLoggerStub();

      await recordCronRun(
         {
            jobName: CRON_JOBS.YPT_INGEST,
            trigger: "overlap",
            summary: { reason: "previous_run_in_flight" },
         },
         { db, log }
      );

      const data = db.state.created[0].data;
      assert.equal(data.status, "SKIPPED");
      assert.equal(data.trigger, "overlap");
      assert.equal(data.durationMs, 0);
      assert.deepEqual(data.summary, { reason: "previous_run_in_flight" });
   });
});

describe("recoverInterruptedRuns", () => {
   it("closes RUNNING rows as FAILED/INTERRUPTED", async () => {
      const db = createDb();
      const log = createLoggerStub();

      await recoverInterruptedRuns({ db, log });

      assert.deepEqual(db.state.updatedMany[0].where, { status: "RUNNING" });
      assert.equal(db.state.updatedMany[0].data.status, "FAILED");
      assert.equal(db.state.updatedMany[0].data.errorCode, "INTERRUPTED");
   });
});

describe("pruneCronLogs", () => {
   it("uses the 30-day run cutoff", async () => {
      const db = createDb();
      const log = createLoggerStub();
      const now = new Date("2026-10-24T12:00:00.000Z");

      const result = await pruneCronLogs({ db, log, now });

      const dayMs = 24 * 60 * 60 * 1000;
      const expectedRunCutoff = new Date(
         now.getTime() - env.CRON_LOG_RETENTION_DAYS * dayMs
      );

      assert.equal(
         db.state.deletedRuns[0].where.startedAt.lt.toISOString(),
         expectedRunCutoff.toISOString()
      );
      assert.deepEqual(db.state.deletedRuns[0].where.status, {
         not: "RUNNING",
      });
      assert.deepEqual(result, { runs: 3 });
   });
});
