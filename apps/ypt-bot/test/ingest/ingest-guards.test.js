import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { getGroupMembers, getAggregatedMembers } from "../../src/ypt/client.js";
import { ingestGroupMembersToDailyStudyLogs } from "../../src/ingest/daily-study-log.js";
import {
   getOrRefreshAuthToken,
   invalidateAuthToken,
} from "../../src/ypt/session.js";
import { prisma } from "../../src/db/client.js";

describe("YPT studyDate extraction and aggregation", () => {
   const originalFetch = globalThis.fetch;

   afterEach(() => {
      globalThis.fetch = originalFetch;
   });

   it("extracts studyDate (dl.dt) and lastActiveDate (dl.dd) in getGroupMembers", async () => {
      globalThis.fetch = async () => ({
         ok: true,
         status: 200,
         headers: { get: () => "application/json" },
         json: async () => ({
            s: true,
            ms: [
               {
                  ud: 12345,
                  n: "Alice",
                  dl: {
                     sm: 3600000,
                     dt: "2026-10-11",
                     dd: "2026-10-11",
                  },
               },
               {
                  ud: 67890,
                  n: "Bob",
                  dl: {
                     sm: 0,
                     dt: "2026-10-12",
                     dd: "2026-10-10",
                  },
               },
            ],
         }),
      });

      const members = await getGroupMembers("dummy-token", 101);
      assert.strictEqual(members.length, 2);
      assert.strictEqual(members[0].studyDate, "2026-10-11");
      assert.strictEqual(members[0].lastActiveDate, "2026-10-11");
      assert.strictEqual(members[1].studyDate, "2026-10-12");
      assert.strictEqual(members[1].lastActiveDate, "2026-10-10");
   });

   it("preserves studyDate from group with study hours when aggregating multi-group members", async () => {
      // Group 1 has rolled over to 2026-10-12 with 0 study time
      // Group 2 still has 2026-10-11 with 14h study time
      globalThis.fetch = async (url) => {
         const isGroup1 = url.includes("groupID=1");
         return {
            ok: true,
            status: 200,
            headers: { get: () => "application/json" },
            json: async () => ({
               s: true,
               ms: isGroup1
                  ? [{ ud: 999, n: "Charlie", dl: { sm: 0, dt: "2026-10-12" } }]
                  : [
                       {
                          ud: 999,
                          n: "Charlie",
                          dl: { sm: 50400000, dt: "2026-10-11" },
                       },
                    ],
            }),
         };
      };

      const aggregated = await getAggregatedMembers("dummy-token", [
         { id: 1, name: "Group 1" },
         { id: 2, name: "Group 2" },
      ]);

      assert.strictEqual(aggregated.members.length, 1);
      const m = aggregated.members[0];
      assert.strictEqual(m.todayStudyMs, 50400000);
      assert.strictEqual(m.studyDate, "2026-10-11");
   });
});

describe("Zero-Drop & Rollover Glitch Guards in ingestGroupMembersToDailyStudyLogs", () => {
   it("guards against overwriting completed day when YPT member has already rolled over to next date", async () => {
      // Mock prisma dependencies
      const originalFindMany = prisma.dailyStudyLog.findMany;
      const originalUpsert = prisma.dailyStudyLog.upsert;
      const originalChallenge = prisma.challenge.findFirst;
      const originalChallengeFindMany = prisma.challenge.findMany;
      const originalParticipants = prisma.challengeParticipant.findMany;

      let upsertArgs = null;

      try {
         const mockChallenge = {
            id: "mock-challenge-id",
            title: "Mock Challenge",
            startAt: new Date("2026-10-05T00:00:00.000Z"),
            endAt: new Date("2026-10-12T00:00:00.000Z"),
            resultsLockedAt: null,
         };

         prisma.challenge.findFirst = async () => mockChallenge;
         prisma.challenge.findMany = async (args) => {
            if (args?.where?.endAt?.lte) {
               return [];
            }
            return [mockChallenge];
         };

         prisma.challengeParticipant.findMany = async () => [
            {
               id: "participant-1",
               challengeId: "mock-challenge-id",
               userId: "user-1",
               user: {
                  id: "user-1",
                  yptId: "1001",
                  displayName: "Mock User",
                  username: "mockuser",
               },
            },
         ];

         // Existing DB record for today (2026-10-11) has 50400s (14h)
         prisma.dailyStudyLog.findMany = async () => [
            {
               id: "log-1",
               participantId: "participant-1",
               isOverride: false,
               durationSeconds: 50400,
            },
         ];

         prisma.dailyStudyLog.upsert = async (args) => {
            upsertArgs = args;
            return args;
         };

         // YPT member has rolled over to 2026-10-12 with 0s
         const members = [
            {
               userId: "1001",
               nickname: "Mock User",
               studyDate: "2026-10-12", // Future date vs 2026-10-11
               todayStudyMs: 0,
               sessionElapsedMs: 0,
               isStudying: false,
            },
         ];

         const nowUtc = new Date("2026-10-11T23:30:00.000Z");
         const result = await ingestGroupMembersToDailyStudyLogs(
            "mock-group",
            members,
            nowUtc
         );

         assert.strictEqual(
            result.protectedRollovers,
            1,
            "Should trigger protectedRollovers"
         );
         assert.strictEqual(result.protectedZeroDrops, 0);
         assert.strictEqual(
            upsertArgs.create.durationSeconds,
            50400,
            "Must preserve existing duration in create"
         );
         assert.strictEqual(
            upsertArgs.update.durationSeconds,
            50400,
            "Must preserve existing duration in update"
         );
      } finally {
         prisma.challenge.findFirst = originalChallenge;
         prisma.challenge.findMany = originalChallengeFindMany;
         prisma.challengeParticipant.findMany = originalParticipants;
         prisma.dailyStudyLog.findMany = originalFindMany;
         prisma.dailyStudyLog.upsert = originalUpsert;
      }
   });

   it("guards against zero-drop wipeout when incoming studyMs is 0 but existing record > 0", async () => {
      const originalFindMany = prisma.dailyStudyLog.findMany;
      const originalUpsert = prisma.dailyStudyLog.upsert;
      const originalChallenge = prisma.challenge.findFirst;
      const originalChallengeFindMany = prisma.challenge.findMany;
      const originalParticipants = prisma.challengeParticipant.findMany;

      let upsertArgs = null;

      try {
         const mockChallenge = {
            id: "mock-challenge-id",
            title: "Mock Challenge",
            startAt: new Date("2026-10-05T00:00:00.000Z"),
            endAt: new Date("2026-10-12T00:00:00.000Z"),
            resultsLockedAt: null,
         };

         prisma.challenge.findFirst = async () => mockChallenge;
         prisma.challenge.findMany = async (args) => {
            if (args?.where?.endAt?.lte) {
               return [];
            }
            return [mockChallenge];
         };

         prisma.challengeParticipant.findMany = async () => [
            {
               id: "participant-1",
               challengeId: "mock-challenge-id",
               userId: "user-1",
               user: {
                  id: "user-1",
                  yptId: "1001",
                  displayName: "Mock User",
                  username: "mockuser",
               },
            },
         ];

         // Existing DB record has 26186s (~7.2h)
         prisma.dailyStudyLog.findMany = async () => [
            {
               id: "log-1",
               participantId: "participant-1",
               isOverride: false,
               durationSeconds: 26186,
            },
         ];

         prisma.dailyStudyLog.upsert = async (args) => {
            upsertArgs = args;
            return args;
         };

         // YPT telemetry glitch returns 0s for same day (2026-10-11)
         const members = [
            {
               userId: "1001",
               nickname: "Mock User",
               studyDate: "2026-10-11",
               todayStudyMs: 0,
               sessionElapsedMs: 0,
               isStudying: false,
            },
         ];

         const nowUtc = new Date("2026-10-11T20:00:00.000Z");
         const result = await ingestGroupMembersToDailyStudyLogs(
            "mock-group",
            members,
            nowUtc
         );

         assert.strictEqual(
            result.protectedZeroDrops,
            1,
            "Should trigger protectedZeroDrops"
         );
         assert.strictEqual(
            upsertArgs.create.durationSeconds,
            26186,
            "Must preserve existing duration in create"
         );
         assert.strictEqual(
            upsertArgs.update.durationSeconds,
            26186,
            "Must preserve existing duration in update"
         );
      } finally {
         prisma.challenge.findFirst = originalChallenge;
         prisma.challenge.findMany = originalChallengeFindMany;
         prisma.challengeParticipant.findMany = originalParticipants;
         prisma.dailyStudyLog.findMany = originalFindMany;
         prisma.dailyStudyLog.upsert = originalUpsert;
      }
   });

   it("allows normal progress update when duration increases or adjusts within same day", async () => {
      const originalFindMany = prisma.dailyStudyLog.findMany;
      const originalUpsert = prisma.dailyStudyLog.upsert;
      const originalChallenge = prisma.challenge.findFirst;
      const originalChallengeFindMany = prisma.challenge.findMany;
      const originalParticipants = prisma.challengeParticipant.findMany;

      let upsertArgs = null;

      try {
         const mockChallenge = {
            id: "mock-challenge-id",
            title: "Mock Challenge",
            startAt: new Date("2026-10-05T00:00:00.000Z"),
            endAt: new Date("2026-10-12T00:00:00.000Z"),
            resultsLockedAt: null,
         };

         prisma.challenge.findFirst = async () => mockChallenge;
         prisma.challenge.findMany = async (args) => {
            if (args?.where?.endAt?.lte) {
               return [];
            }
            return [mockChallenge];
         };

         prisma.challengeParticipant.findMany = async () => [
            {
               id: "participant-1",
               challengeId: "mock-challenge-id",
               userId: "user-1",
               user: {
                  id: "user-1",
                  yptId: "1001",
                  displayName: "Mock User",
                  username: "mockuser",
               },
            },
         ];

         prisma.dailyStudyLog.findMany = async () => [
            {
               id: "log-1",
               participantId: "participant-1",
               isOverride: false,
               durationSeconds: 10000,
            },
         ];

         prisma.dailyStudyLog.upsert = async (args) => {
            upsertArgs = args;
            return args;
         };

         // Member studied to 12000s
         const members = [
            {
               userId: "1001",
               nickname: "Mock User",
               studyDate: "2026-10-11",
               todayStudyMs: 12000000,
               sessionElapsedMs: 0,
               isStudying: true,
            },
         ];

         const nowUtc = new Date("2026-10-11T12:00:00.000Z");
         const result = await ingestGroupMembersToDailyStudyLogs(
            "mock-group",
            members,
            nowUtc
         );

         assert.strictEqual(result.protectedRollovers, 0);
         assert.strictEqual(result.protectedZeroDrops, 0);
         assert.strictEqual(upsertArgs.create.durationSeconds, 12000);
         assert.strictEqual(upsertArgs.update.durationSeconds, 12000);
         assert.strictEqual(upsertArgs.update.status, "STUDYING");
      } finally {
         prisma.challenge.findFirst = originalChallenge;
         prisma.challenge.findMany = originalChallengeFindMany;
         prisma.challengeParticipant.findMany = originalParticipants;
         prisma.dailyStudyLog.findMany = originalFindMany;
         prisma.dailyStudyLog.upsert = originalUpsert;
      }
   });
});

describe("Auth token session caching and invalidation in ingest daemon", () => {
   const originalFetch = globalThis.fetch;

   afterEach(() => {
      globalThis.fetch = originalFetch;
      invalidateAuthToken();
   });

   it("reuses cached auth token across invocations and clears on invalidateAuthToken", async () => {
      let signInCount = 0;
      let splashCount = 0;

      globalThis.fetch = async (url) => {
         if (url.includes("/user/sign-in-jwt")) {
            signInCount++;
            return {
               ok: true,
               status: 200,
               headers: { get: () => "application/json" },
               json: async () => ({ s: true, jwt: `token-${signInCount}` }),
            };
         }
         if (url.includes("/user/v2/splash-login")) {
            splashCount++;
            return {
               ok: true,
               status: 200,
               headers: { get: () => "application/json" },
               json: async () => ({ s: true }),
            };
         }
         throw new Error(`Unexpected URL: ${url}`);
      };

      invalidateAuthToken();

      const t1 = await getOrRefreshAuthToken();
      assert.strictEqual(t1, "token-1");
      assert.strictEqual(signInCount, 1);
      assert.strictEqual(splashCount, 1);

      // Second call should reuse cached token
      const t2 = await getOrRefreshAuthToken();
      assert.strictEqual(t2, "token-1");
      assert.strictEqual(signInCount, 1, "Should NOT call signIn again");
      assert.strictEqual(splashCount, 1, "Should NOT call splashLogin again");

      // Invalidation clears cache and forces re-authentication
      invalidateAuthToken();
      const t3 = await getOrRefreshAuthToken();
      assert.strictEqual(t3, "token-2");
      assert.strictEqual(signInCount, 2);
      assert.strictEqual(splashCount, 2);
   });
});
