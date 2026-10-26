import { test, describe, mock } from "node:test";
import assert from "node:assert/strict";
import { startDailyBackupScheduler } from "../../src/backup/scheduler.js";

function createLoggerStub() {
   const records = [];
   const push =
      (level) =>
      (message, meta = {}) => {
         records.push({ level, message, ...meta });
      };

   return {
      records,
      info: push("info"),
      warn: push("warn"),
      error: push("error"),
      child() {
         return this;
      },
   };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe("startDailyBackupScheduler", () => {
   test("returns null when disabled", () => {
      const scheduler = startDailyBackupScheduler({
         enabled: false,
         catchUpEnabled: false,
         log: createLoggerStub(),
      });

      assert.equal(scheduler, null);
   });

   test("runs at the next UTC midnight", async () => {
      mock.timers.enable({ apis: ["setTimeout"] });
      const calls = [];

      try {
         const scheduler = startDailyBackupScheduler({
            enabled: true,
            catchUpEnabled: false,
            clock: () => new Date("2026-10-24T23:59:30.000Z"),
            run: async (options) => {
               calls.push(options);
               return { skipped: false };
            },
            record: async (_meta, fn) => fn(),
            log: createLoggerStub(),
         });

         mock.timers.tick(30_000);
         await flush();

         assert.equal(calls.length, 1);
         scheduler.stop();
      } finally {
         mock.timers.reset();
      }
   });

   test("stop prevents a scheduled run", async () => {
      mock.timers.enable({ apis: ["setTimeout"] });
      const calls = [];

      try {
         const scheduler = startDailyBackupScheduler({
            enabled: true,
            catchUpEnabled: false,
            clock: () => new Date("2026-10-24T23:59:30.000Z"),
            run: async (options) => {
               calls.push(options);
               return { skipped: false };
            },
            record: async (_meta, fn) => fn(),
            log: createLoggerStub(),
         });

         scheduler.stop();
         mock.timers.tick(30_000);
         await flush();

         assert.equal(calls.length, 0);
      } finally {
         mock.timers.reset();
      }
   });
});
