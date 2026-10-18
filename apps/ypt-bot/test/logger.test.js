import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Writable } from "node:stream";
import winston from "winston";
import { createLogger } from "../src/logger.js";

function captureLogger(options = {}) {
   const records = [];
   const stream = new Writable({
      write(chunk, _enc, callback) {
         records.push(JSON.parse(chunk.toString()));
         callback();
      },
   });
   const logger = createLogger({
      format: winston.format.json(),
      transports: [new winston.transports.Stream({ stream })],
      silent: false,
      ...options,
   });
   return { logger, records };
}

describe("createLogger", () => {
   test("attaches default meta and call metadata to records", () => {
      const { logger, records } = captureLogger();

      logger.info("ingest complete", { matchedCount: 5 });

      assert.equal(records.length, 1);
      assert.equal(records[0].level, "info");
      assert.equal(records[0].message, "ingest complete");
      assert.equal(records[0].matchedCount, 5);
      assert.equal(records[0].service, "ypt-checker");
   });

   test("child logger merges run context into every record", () => {
      const { logger, records } = captureLogger();
      const run = logger.child({ runId: "r1", challengeId: "c1" });

      run.info("phase start");

      assert.equal(records.length, 1);
      assert.equal(records[0].runId, "r1");
      assert.equal(records[0].challengeId, "c1");
   });

   test("silent suppresses output", () => {
      const { logger, records } = captureLogger({ silent: true });

      logger.info("should not appear");
      logger.error("should not appear either");

      assert.equal(records.length, 0);
   });

   test("errors carry a stack when passed as metadata", () => {
      const { logger, records } = captureLogger({
         format: winston.format.combine(
            winston.format.errors({ stack: true }),
            winston.format.json()
         ),
      });

      logger.error("boom context", new Error("kaboom"));

      assert.equal(records.length, 1);
      assert.match(records[0].message, /boom context/);
      assert.match(records[0].stack, /kaboom/);
   });
});
