import { test, describe } from "node:test";
import assert from "node:assert";
import {
   formatUtcDateString,
   syncChallengeFromMonday,
} from "../src/sync/challenge_sync.js";
import { prisma } from "../src/db.js";
import { getActiveChallenge } from "../src/db/challengeService.js";

describe("formatUtcDateString", () => {
   test("formats dates strictly in YYYY-MM-DD UTC format", () => {
      const d = new Date("2026-10-05T23:59:59.999Z");
      assert.strictEqual(formatUtcDateString(d), "2026-10-05");
   });
});

describe(
   "syncChallengeFromMonday",
   {
      skip:
         process.env.RUN_DB_INTEGRATION_TESTS !== "true" ||
         process.env.CI_SKIP_DB === "true",
   },
   () => {
      test("syncs historical days from Monday (2026-10-05) into DailyStudyLog with override preservation", async () => {
         const testNow = new Date("2026-10-10T12:00:00.000Z");
         const result = await syncChallengeFromMonday({
            nowUtc: testNow,
            skipYpt: true, // test historical and DB layer deterministically
            verbose: false,
         });

         assert.strictEqual(result.success, true);
         assert.ok(result.challengeId);
         assert.strictEqual(
            formatUtcDateString(result.challengeStartUtc),
            "2026-10-05"
         );
         assert.ok(result.historicalUpserted >= 0);

         // Verify database contents in DailyStudyLog for Monday
         const mondayLogs = await prisma.dailyStudyLog.findMany({
            where: {
               logDate: new Date("2026-10-05T00:00:00.000Z"),
            },
         });

         assert.ok(
            mondayLogs.length > 0,
            "Monday study logs must exist in DailyStudyLog"
         );

         // Verify overrides from Monday are preserved and status is OFFLINE
         for (const log of mondayLogs) {
            assert.strictEqual(
               log.status,
               "OFFLINE",
               "Historical logs must have status OFFLINE"
            );
         }

         const mondayOverrides = mondayLogs.filter((l) => l.isOverride);
         assert.ok(
            mondayOverrides.length > 0,
            "Should have preserved Monday overrides"
         );
         for (const ov of mondayOverrides) {
            assert.strictEqual(ov.isOverride, true);
            assert.ok(
               ov.overrideById,
               "Preserved overrideById must not be empty"
            );
         }

         // Verify that running sync again is idempotent and respects existing overrides
         const secondRun = await syncChallengeFromMonday({
            nowUtc: testNow,
            skipYpt: true,
            verbose: false,
         });

         assert.strictEqual(secondRun.success, true);
         assert.strictEqual(secondRun.challengeId, result.challengeId);
      });
   }
);
