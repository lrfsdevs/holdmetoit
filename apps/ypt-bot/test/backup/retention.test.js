import { test, describe } from "node:test";
import assert from "node:assert";
import {
   buildObjectName,
   computeNextUtcMidnight,
   isBackupDue,
   parseObjectDate,
   selectExpiredObjects,
} from "../../src/backup/retention.js";

describe("computeNextUtcMidnight", () => {
   test("returns the next UTC midnight", () => {
      assert.strictEqual(
         computeNextUtcMidnight(
            new Date("2026-10-23T12:34:56.789Z")
         ).toISOString(),
         "2026-10-24T00:00:00.000Z"
      );
   });

   test("rolls forward when now is exactly midnight", () => {
      assert.strictEqual(
         computeNextUtcMidnight(
            new Date("2026-10-23T00:00:00.000Z")
         ).toISOString(),
         "2026-10-24T00:00:00.000Z"
      );
   });

   test("handles month and year boundaries", () => {
      assert.strictEqual(
         computeNextUtcMidnight(
            new Date("2026-01-31T23:59:59.999Z")
         ).toISOString(),
         "2026-02-01T00:00:00.000Z"
      );
      assert.strictEqual(
         computeNextUtcMidnight(
            new Date("2026-12-31T23:59:59.999Z")
         ).toISOString(),
         "2027-01-01T00:00:00.000Z"
      );
   });
});

describe("buildObjectName", () => {
   test("uses a day-scoped name for scheduled runs", () => {
      assert.strictEqual(
         buildObjectName(new Date("2026-10-23T00:00:00.000Z")),
         "holdmetoit-2026-10-23.dump"
      );
   });

   test("uses a timestamped name for manual runs", () => {
      assert.strictEqual(
         buildObjectName(new Date("2026-10-23T12:34:56.789Z"), {
            manual: true,
         }),
         "holdmetoit-2026-10-23T12-34-56Z.dump"
      );
   });
});

describe("parseObjectDate", () => {
   test("parses scheduled and manual object names", () => {
      assert.strictEqual(
         parseObjectDate("holdmetoit-2026-10-23.dump").toISOString(),
         "2026-10-23T00:00:00.000Z"
      );
      assert.strictEqual(
         parseObjectDate("holdmetoit-2026-10-23T12-34-56Z.dump").toISOString(),
         "2026-10-23T12:34:56.000Z"
      );
   });

   test("rejects unrelated and malformed names", () => {
      assert.strictEqual(parseObjectDate("notes.txt"), null);
      assert.strictEqual(parseObjectDate("holdmetoit-2026-13-01.dump"), null);
      assert.strictEqual(parseObjectDate("holdmetoit-2026-10-32.dump"), null);
   });
});

describe("isBackupDue", () => {
   const now = new Date("2026-10-23T12:00:00.000Z");

   test("is due when there is no previous backup", () => {
      assert.strictEqual(isBackupDue(now, null), true);
   });

   test("is not due within 24 hours", () => {
      assert.strictEqual(
         isBackupDue(now, new Date("2026-10-22T13:00:00.000Z")),
         false
      );
   });

   test("is due at or beyond 24 hours", () => {
      assert.strictEqual(
         isBackupDue(now, new Date("2026-10-22T12:00:00.000Z")),
         true
      );
   });
});

describe("selectExpiredObjects", () => {
   const now = new Date("2026-10-23T00:00:00.000Z");

   test("removes only objects older than the retention window", () => {
      const expired = selectExpiredObjects(
         [
            { name: "holdmetoit-2026-09-22.dump" },
            { name: "holdmetoit-2026-09-23.dump" },
            { name: "holdmetoit-2026-10-22.dump" },
            { name: "notes.txt" },
         ],
         now,
         30,
         "backups"
      );

      assert.deepStrictEqual(expired, ["backups/holdmetoit-2026-09-22.dump"]);
   });

   test("clamps retention 0 and negative values to one day", () => {
      const objects = [
         { name: "holdmetoit-2026-10-21.dump" },
         { name: "holdmetoit-2026-10-22.dump" },
         { name: "holdmetoit-2026-10-23.dump" },
      ];

      const oneDay = selectExpiredObjects(objects, now, 1);
      assert.deepStrictEqual(oneDay, ["backups/holdmetoit-2026-10-21.dump"]);
      assert.deepStrictEqual(selectExpiredObjects(objects, now, 0), oneDay);
      assert.deepStrictEqual(selectExpiredObjects(objects, now, -5), oneDay);
   });
});
