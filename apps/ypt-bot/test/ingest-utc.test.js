import { test, describe } from "node:test";
import assert from "node:assert";
import {
   computeUtcLogDate,
   computeChallengeDayLogDate,
   deriveStudyStatus,
} from "../src/sync/ingestStudyLogs.js";
import {
   getActiveChallenge,
   getParticipantMap,
} from "../src/db/challengeService.js";
import { prisma } from "../src/db.js";

describe("computeUtcLogDate (Strict UTC)", () => {
   test("normalizes any timestamp to UTC midnight (00:00:00.000Z)", () => {
      // 2026-10-10 at 15:45:30.123 UTC
      const input = new Date("2026-10-10T15:45:30.123Z");
      const result = computeUtcLogDate(input);

      assert.strictEqual(result.toISOString(), "2026-10-10T00:00:00.000Z");
      assert.strictEqual(result.getUTCHours(), 0);
      assert.strictEqual(result.getUTCMinutes(), 0);
      assert.strictEqual(result.getUTCSeconds(), 0);
      assert.strictEqual(result.getUTCMilliseconds(), 0);
   });

   test("correctly handles month and year rollovers in UTC", () => {
      const endOfYear = new Date("2026-12-31T23:59:59.999Z");
      const result = computeUtcLogDate(endOfYear);

      assert.strictEqual(result.toISOString(), "2026-12-31T00:00:00.000Z");
   });
});

describe("computeChallengeDayLogDate (challenge-anchored bucket)", () => {
   const iso = (d) => d.toISOString();

   test("equals the UTC calendar date for a midnight-UTC challenge start", () => {
      const start = new Date("2026-10-05T00:00:00.000Z");
      assert.strictEqual(
         iso(
            computeChallengeDayLogDate(
               new Date("2026-10-05T23:59:59.999Z"),
               start
            )
         ),
         "2026-10-05T00:00:00.000Z"
      );
      assert.strictEqual(
         iso(
            computeChallengeDayLogDate(
               new Date("2026-10-06T00:00:00.000Z"),
               start
            )
         ),
         "2026-10-06T00:00:00.000Z"
      );
      assert.strictEqual(
         iso(
            computeChallengeDayLogDate(
               new Date("2026-10-10T12:00:00.000Z"),
               start
            )
         ),
         "2026-10-10T00:00:00.000Z"
      );
   });

   test("anchors to the start instant for a non-midnight challenge start", () => {
      const start = new Date("2026-10-05T18:00:00.000Z");
      assert.strictEqual(
         iso(
            computeChallengeDayLogDate(
               new Date("2026-10-06T10:00:00.000Z"),
               start
            )
         ),
         "2026-10-05T00:00:00.000Z"
      );
      assert.strictEqual(
         iso(
            computeChallengeDayLogDate(
               new Date("2026-10-06T19:00:00.000Z"),
               start
            )
         ),
         "2026-10-06T00:00:00.000Z"
      );
   });

   test("rolls over exactly at startAt + N*24h", () => {
      const start = new Date("2026-10-05T18:00:00.000Z");
      assert.strictEqual(
         iso(
            computeChallengeDayLogDate(
               new Date("2026-10-06T17:59:59.999Z"),
               start
            )
         ),
         "2026-10-05T00:00:00.000Z"
      );
      assert.strictEqual(
         iso(
            computeChallengeDayLogDate(
               new Date("2026-10-06T18:00:00.000Z"),
               start
            )
         ),
         "2026-10-06T00:00:00.000Z"
      );
   });

   test("keeps every instant within a 24h window in the same bucket", () => {
      const start = new Date("2026-10-05T18:00:00.000Z");
      const a = computeChallengeDayLogDate(
         new Date("2026-10-07T18:00:00.000Z"),
         start
      );
      const b = computeChallengeDayLogDate(
         new Date("2026-10-08T17:59:00.000Z"),
         start
      );
      assert.strictEqual(iso(a), "2026-10-07T00:00:00.000Z");
      assert.strictEqual(iso(b), iso(a));
   });

   test("clamps instants before the challenge start to day 0", () => {
      const start = new Date("2026-10-05T18:00:00.000Z");
      assert.strictEqual(
         iso(
            computeChallengeDayLogDate(
               new Date("2026-10-05T00:00:00.000Z"),
               start
            )
         ),
         "2026-10-05T00:00:00.000Z"
      );
   });
});

describe("deriveStudyStatus", () => {
   test("returns STUDYING when isStudying is true and not paused", () => {
      const status = deriveStudyStatus({
         isStudying: true,
         isPaused: false,
         currentSubject: "Organic Chemistry",
      });
      assert.strictEqual(status, "STUDYING");
   });

   test("marks paused members as STUDYING", () => {
      const status = deriveStudyStatus({
         isStudying: true,
         isPaused: true,
         currentSubject: "Physics",
      });
      assert.strictEqual(status, "STUDYING");
   });

   test("returns OFFLINE when isStudying is false", () => {
      const status = deriveStudyStatus({
         isStudying: false,
         isPaused: false,
      });
      assert.strictEqual(status, "OFFLINE");
   });
});

describe(
   "Database Active Challenge & Participant Resolution (UTC)",
   { skip: process.env.CI_SKIP_DB === "true" },
   () => {
      test("dynamically finds active challenge within date range in UTC", async () => {
         // October Team Battle is 2026-10-05T00:00:00Z to 2026-10-12T00:00:00Z
         const testUtcTime = new Date("2026-10-08T12:00:00.000Z");
         const challenge = await getActiveChallenge(testUtcTime);

         assert.ok(challenge, "Should find an active challenge in DB");
         assert.strictEqual(challenge.title, "October Team Battle");
         assert.ok(
            new Date(challenge.startAt) <= testUtcTime,
            "startAt must be <= testUtcTime"
         );
         assert.ok(
            new Date(challenge.endAt) >= testUtcTime,
            "endAt must be >= testUtcTime"
         );
      });

      test("builds participant map with linked yptId from database", async () => {
         const testUtcTime = new Date("2026-10-08T12:00:00.000Z");
         const challenge = await getActiveChallenge(testUtcTime);
         assert.ok(challenge);

         const map = await getParticipantMap(challenge.id);
         assert.ok(map instanceof Map);
         assert.ok(map.size > 0, "Should have participants linked with yptId");

         // Check known user with yptId (e.g. Ori520 with 8449909 or Krish with 11188014)
         const oriParticipant = map.get("8449909");
         if (oriParticipant) {
            assert.strictEqual(oriParticipant.yptId, "8449909");
            assert.ok(oriParticipant.participantId, "Must have participantId");
         }
      });
   }
);
