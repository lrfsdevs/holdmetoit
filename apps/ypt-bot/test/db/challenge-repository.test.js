import { test, describe, mock } from "node:test";
import assert from "node:assert";
import {
   getChallengeLifecycle,
   CHALLENGE_GRACE_WINDOW_MS,
   getActiveChallenge,
   lockExpiredChallengesAfterGrace,
   reconcileChallengeAccountability,
} from "../../src/db/challenge-repository.js";
import { computeChallengeDayLogDate } from "../../src/ingest/date-buckets.js";
import { ingestGroupMembersToDailyStudyLogs } from "../../src/ingest/daily-study-log.js";
import { prisma } from "../../src/db/client.js";

describe("getChallengeLifecycle", () => {
   const startAt = new Date("2026-10-05T00:00:00.000Z");
   const endAt = new Date("2026-10-12T00:00:00.000Z"); // 7 days later (end of Day 7)

   test("returns UPCOMING when now is before startAt", () => {
      const challenge = { startAt, endAt, resultsLockedAt: null };
      const now = new Date("2026-10-04T23:59:59.999Z");
      const lifecycle = getChallengeLifecycle(challenge, now);

      assert.strictEqual(lifecycle.state, "UPCOMING");
      assert.strictEqual(lifecycle.canIngest, false);
      assert.strictEqual(lifecycle.isGracePeriod, false);
   });

   test("returns ACTIVE during standard challenge window (Day 1 through Day 7)", () => {
      const challenge = { startAt, endAt, resultsLockedAt: null };
      // Day 7 middle: Sunday noon
      const now = new Date("2026-10-11T12:00:00.000Z");
      const lifecycle = getChallengeLifecycle(challenge, now);

      assert.strictEqual(lifecycle.state, "ACTIVE");
      assert.strictEqual(lifecycle.canIngest, true);
      assert.strictEqual(lifecycle.isGracePeriod, false);
   });

   test("returns DAY7_GRACE during the 6 hours immediately following Day 7 completion", () => {
      const challenge = { startAt, endAt, resultsLockedAt: null };
      // 2 hours into Monday after Day 7 ended
      const now = new Date("2026-10-12T02:00:00.000Z");
      const lifecycle = getChallengeLifecycle(challenge, now);

      assert.strictEqual(lifecycle.state, "DAY7_GRACE");
      assert.strictEqual(lifecycle.canIngest, true);
      assert.strictEqual(lifecycle.isGracePeriod, true);
      assert.strictEqual(lifecycle.day7End.getTime(), endAt.getTime());
   });

   test("returns DAY7_GRACE at exact upper boundary of 6-hour window", () => {
      const challenge = { startAt, endAt, resultsLockedAt: null };
      const exactEnd = new Date(endAt.getTime() + CHALLENGE_GRACE_WINDOW_MS);
      const lifecycle = getChallengeLifecycle(challenge, exactEnd);

      assert.strictEqual(lifecycle.state, "DAY7_GRACE");
      assert.strictEqual(lifecycle.canIngest, true);
      assert.strictEqual(lifecycle.isGracePeriod, true);
   });

   test("returns EXPIRED once 6 hours past Day 7 completion have elapsed", () => {
      const challenge = { startAt, endAt, resultsLockedAt: null };
      const pastEnd = new Date(
         endAt.getTime() + CHALLENGE_GRACE_WINDOW_MS + 1000
      ); // 6h + 1s
      const lifecycle = getChallengeLifecycle(challenge, pastEnd);

      assert.strictEqual(lifecycle.state, "EXPIRED");
      assert.strictEqual(lifecycle.canIngest, false);
      assert.strictEqual(lifecycle.isGracePeriod, false);
   });

   test("returns LOCKED immediately when resultsLockedAt is set in the past, even during Day 7", () => {
      const challenge = {
         startAt,
         endAt,
         resultsLockedAt: new Date("2026-10-11T17:00:00.000Z"),
      };
      const now = new Date("2026-10-11T17:30:00.000Z");
      const lifecycle = getChallengeLifecycle(challenge, now);

      assert.strictEqual(lifecycle.state, "LOCKED");
      assert.strictEqual(lifecycle.canIngest, false);
      assert.strictEqual(lifecycle.isGracePeriod, false);
   });

   test("returns LOCKED during the grace period if resultsLockedAt was triggered", () => {
      const challenge = {
         startAt,
         endAt,
         resultsLockedAt: new Date("2026-10-12T01:00:00.000Z"),
      };
      const now = new Date("2026-10-12T01:30:00.000Z");
      const lifecycle = getChallengeLifecycle(challenge, now);

      assert.strictEqual(lifecycle.state, "LOCKED");
      assert.strictEqual(lifecycle.canIngest, false);
   });
});

describe("Day 7 Grace Period Bucket Anchoring", () => {
   const startAt = new Date("2026-10-05T00:00:00.000Z");
   const endAt = new Date("2026-10-12T00:00:00.000Z"); // Day 7 completion (Monday 00:00 UTC)

   test("grace period anchors logDate strictly to Day 7 (Sunday 2026-10-11)", () => {
      const challenge = { startAt, endAt, resultsLockedAt: null };
      const nowGrace = new Date("2026-10-12T04:30:00.000Z"); // 4.5h past Day 7 completion
      const lifecycle = getChallengeLifecycle(challenge, nowGrace);

      assert.strictEqual(lifecycle.isGracePeriod, true);

      // Using the 1s offset before day7End anchors the bucket to Day 7
      const logDate = computeChallengeDayLogDate(
         new Date(lifecycle.day7End.getTime() - 1000),
         challenge.startAt
      );

      assert.strictEqual(logDate.toISOString().slice(0, 10), "2026-10-11");
   });
});

describe("Day 7 Grace Period Session Filtering Logic", () => {
   const day7End = new Date("2026-10-12T00:00:00.000Z");
   const day7EndMs = day7End.getTime();

   // Helper matching daily-study-log.js grace session derivation logic
   function filterGraceSession({ member, existing }) {
      const isStudying = Boolean(member.isStudying);
      const sessionStartMs = member.sessionStartMs
         ? Number(member.sessionStartMs)
         : null;
      const isOldSession =
         isStudying && sessionStartMs !== null && sessionStartMs < day7EndMs;
      const wasStudyingOldSession = existing?.status === "STUDYING";

      let durationSeconds;
      let status;

      if (isOldSession) {
         const studyMs = Math.max(
            Number(member.todayStudyMs || 0) +
               Number(member.sessionElapsedMs || 0)
         );
         durationSeconds = Math.floor(studyMs / 1000);
         status = "STUDYING";
      } else if (wasStudyingOldSession && !isStudying) {
         const finalized = Math.floor(Number(member.todayStudyMs || 0) / 1000);
         durationSeconds = Math.max(existing?.durationSeconds || 0, finalized);
         status = "OFFLINE";
      } else {
         durationSeconds = existing ? existing.durationSeconds : 0;
         status = "OFFLINE";
      }

      return { durationSeconds, status };
   }

   test("permits in-progress old session started before Day 7 completion to accumulate", () => {
      const member = {
         isStudying: true,
         sessionStartMs: new Date("2026-10-11T23:30:00.000Z").getTime(), // 30m before completion
         sessionElapsedMs: 75 * 60 * 1000, // 1h 15m elapsed
         todayStudyMs: 3600 * 1000, // 1h previously recorded
      };
      const existing = { durationSeconds: 3600, status: "STUDYING" };

      const result = filterGraceSession({ member, existing });
      assert.strictEqual(result.status, "STUDYING");
      assert.strictEqual(result.durationSeconds, 8100); // 3600s + 4500s
   });

   test("finalizes old session when member goes offline during grace window", () => {
      const member = {
         isStudying: false,
         sessionStartMs: null,
         sessionElapsedMs: 0,
         todayStudyMs: 8100 * 1000, // completed 2h 15m total
      };
      // In previous cycle, was logged as STUDYING in the old session
      const existing = { durationSeconds: 7800, status: "STUDYING" };

      const result = filterGraceSession({ member, existing });
      assert.strictEqual(result.status, "OFFLINE");
      assert.strictEqual(result.durationSeconds, 8100);
   });

   test("rejects new session started on or after Day 7 completion", () => {
      const member = {
         isStudying: true,
         sessionStartMs: new Date("2026-10-12T00:30:00.000Z").getTime(), // 30m AFTER completion
         sessionElapsedMs: 30 * 60 * 1000,
         todayStudyMs: 5000 * 1000,
      };
      const existing = { durationSeconds: 3600, status: "OFFLINE" };

      const result = filterGraceSession({ member, existing });
      assert.strictEqual(result.status, "OFFLINE");
      assert.strictEqual(
         result.durationSeconds,
         3600,
         "Day 7 duration must not increase from new session"
      );
   });

   test("keeps offline members without pending old session unchanged", () => {
      const member = {
         isStudying: false,
         sessionStartMs: null,
         sessionElapsedMs: 0,
         todayStudyMs: 9000 * 1000, // new study time in YPT
      };
      const existing = { durationSeconds: 3600, status: "OFFLINE" };

      const result = filterGraceSession({ member, existing });
      assert.strictEqual(result.status, "OFFLINE");
      assert.strictEqual(result.durationSeconds, 3600);
   });
});

describe(
   "getActiveChallenge Resolution & Fallback Behavior (DB)",
   {
      skip:
         process.env.RUN_DB_INTEGRATION_TESTS !== "true" ||
         process.env.CI_SKIP_DB === "true",
   },
   () => {
      test("returns active challenge with state ACTIVE during Day 7", async () => {
         const day7Mid = new Date("2026-10-11T12:00:00.000Z");
         const challenge = await getActiveChallenge(day7Mid);

         assert.ok(challenge, "Should find active challenge in DB");
         assert.strictEqual(challenge.title, "October Team Battle");
         assert.strictEqual(challenge.lifecycle.state, "ACTIVE");
         assert.strictEqual(challenge.lifecycle.canIngest, true);
      });

      test("returns null when challenge is locked in DB", async () => {
         const dbChal = await prisma.challenge.findFirst({
            orderBy: { endAt: "desc" },
         });
         assert.ok(
            dbChal?.resultsLockedAt,
            "Challenge in DB must have resultsLockedAt set"
         );
         const afterLock = new Date(
            new Date(dbChal.resultsLockedAt).getTime() + 1000
         );
         const challenge = await getActiveChallenge(afterLock);

         assert.strictEqual(
            challenge,
            null,
            "Should return null when challenge is locked in DB"
         );
      });

      test("returns null when past 6h grace window (expired)", async () => {
         const expiredTime = new Date("2026-10-12T07:00:00.000Z"); // 7h past endAt
         const challenge = await getActiveChallenge(expiredTime);

         assert.strictEqual(
            challenge,
            null,
            "Should return null when expired and allowFallback is false"
         );
      });

      test("returns latest challenge when allowFallback is explicitly true for expired query", async () => {
         const expiredTime = new Date("2026-10-12T07:00:00.000Z");
         const challenge = await getActiveChallenge(expiredTime, {
            allowFallback: true,
         });

         assert.ok(
            challenge,
            "Should return fallback challenge when allowFallback is true"
         );
         assert.strictEqual(challenge.title, "October Team Battle");
         assert.ok(challenge.lifecycle);
         assert.strictEqual(challenge.lifecycle.canIngest, false);
      });
   }
);

describe("ingestGroupMembersToDailyStudyLogs End-to-End Simulation (Mocked DB)", () => {
   const mockChallenge = {
      id: "chal-day7-mock",
      title: "Mock Day 7 Challenge",
      startAt: new Date("2026-10-05T00:00:00.000Z"),
      endAt: new Date("2026-10-12T00:00:00.000Z"),
      resultsLockedAt: null,
   };

   const mockParticipants = [
      {
         id: "cp-alice",
         challengeId: "chal-day7-mock",
         userId: "u-alice",
         user: {
            id: "u-alice",
            yptId: "ypt-alice",
            username: "alice",
            displayName: "Alice",
         },
      },
      {
         id: "cp-bob",
         challengeId: "chal-day7-mock",
         userId: "u-bob",
         user: {
            id: "u-bob",
            yptId: "ypt-bob",
            username: "bob",
            displayName: "Bob",
         },
      },
      {
         id: "cp-charlie",
         challengeId: "chal-day7-mock",
         userId: "u-charlie",
         user: {
            id: "u-charlie",
            yptId: "ypt-charlie",
            username: "charlie",
            displayName: "Charlie",
         },
      },
      {
         id: "cp-diana",
         challengeId: "chal-day7-mock",
         userId: "u-diana",
         user: {
            id: "u-diana",
            yptId: "ypt-diana",
            username: "diana",
            displayName: "Diana",
         },
      },
   ];

   test("ingests old sessions and rejects new sessions into Day 7 during DAY7_GRACE", async () => {
      const nowGrace = new Date("2026-10-12T02:00:00.000Z"); // 2 hours after Day 7 completion

      const origChallengeFindMany = prisma.challenge.findMany;
      const origChallengeUpdateMany = prisma.challenge.updateMany;
      const origParticipantFindMany = prisma.challengeParticipant.findMany;
      const origLogFindMany = prisma.dailyStudyLog.findMany;
      const origLogUpsert = prisma.dailyStudyLog.upsert;
      const origLogUpdate = prisma.dailyStudyLog.update;

      const upsertCalls = [];
      const updateCalls = [];

      prisma.challenge.findMany = async ({ where } = {}) => {
         // If called from lockExpiredChallengesAfterGrace, mockChallenge is not expired (< 6h)
         if (where?.endAt?.lte) return [];
         return [mockChallenge];
      };
      prisma.challenge.updateMany = async () => ({ count: 0 });
      prisma.challengeParticipant.findMany = async () => mockParticipants;
      prisma.dailyStudyLog.findMany = async ({ where }) => {
         // Assert that query logDate is Day 7 (2026-10-11), NOT Day 8 (2026-10-12)
         assert.strictEqual(
            where.logDate.toISOString().slice(0, 10),
            "2026-10-11"
         );
         return [
            {
               id: "log-alice",
               participantId: "cp-alice",
               durationSeconds: 3600,
               status: "STUDYING",
               isOverride: false,
            },
            {
               id: "log-bob",
               participantId: "cp-bob",
               durationSeconds: 3600,
               status: "OFFLINE",
               isOverride: false,
            },
            {
               id: "log-charlie",
               participantId: "cp-charlie",
               durationSeconds: 7200,
               status: "STUDYING",
               isOverride: false,
            },
            {
               id: "log-diana",
               participantId: "cp-diana",
               durationSeconds: 10000,
               status: "OFFLINE",
               isOverride: true,
            },
         ];
      };
      prisma.dailyStudyLog.upsert = async (args) => {
         upsertCalls.push(args);
         return args;
      };
      prisma.dailyStudyLog.update = async (args) => {
         updateCalls.push(args);
         return args;
      };

      try {
         const members = [
            // Alice: ongoing old session (started 23:30 on Day 7)
            {
               userId: "ypt-alice",
               isStudying: true,
               sessionStartMs: new Date("2026-10-11T23:30:00.000Z").getTime(),
               sessionElapsedMs: 90 * 60 * 1000, // 1.5h
               todayStudyMs: 3600 * 1000, // 1h base
            },
            // Bob: new session started after Day 7 ended (started 00:30 on Monday)
            {
               userId: "ypt-bob",
               isStudying: true,
               sessionStartMs: new Date("2026-10-12T00:30:00.000Z").getTime(),
               sessionElapsedMs: 60 * 60 * 1000,
               todayStudyMs: 5000 * 1000,
            },
            // Charlie: completed old session (now offline)
            {
               userId: "ypt-charlie",
               isStudying: false,
               sessionStartMs: null,
               sessionElapsedMs: 0,
               todayStudyMs: 9000 * 1000,
            },
            // Diana: admin override row
            {
               userId: "ypt-diana",
               isStudying: true,
               sessionStartMs: new Date("2026-10-11T23:00:00.000Z").getTime(),
               sessionElapsedMs: 60 * 60 * 1000,
               todayStudyMs: 5000 * 1000,
            },
         ];

         const silentLogger = {
            info: () => {},
            warn: () => {},
            error: () => {},
            child: () => silentLogger,
         };

         const result = await ingestGroupMembersToDailyStudyLogs(
            "test-group",
            members,
            nowGrace,
            silentLogger
         );

         assert.strictEqual(result.success, true);
         assert.strictEqual(
            result.logDate.toISOString().slice(0, 10),
            "2026-10-11"
         );
         assert.strictEqual(result.matchedCount, 4);
         assert.strictEqual(result.skippedOverrides, 1);
         assert.strictEqual(result.upsertedCount, 3);

         // Verify Alice: Old session accumulated into Day 7
         const aliceUpsert = upsertCalls.find(
            (c) => c.where.participantId_logDate.participantId === "cp-alice"
         );
         assert.ok(aliceUpsert);
         assert.strictEqual(aliceUpsert.create.status, "STUDYING");
         assert.strictEqual(aliceUpsert.create.durationSeconds, 9000); // 3600s + 5400s

         // Verify Bob: New session rejected! Duration frozen at existing 3600s, status OFFLINE
         const bobUpsert = upsertCalls.find(
            (c) => c.where.participantId_logDate.participantId === "cp-bob"
         );
         assert.ok(bobUpsert);
         assert.strictEqual(bobUpsert.create.status, "OFFLINE");
         assert.strictEqual(
            bobUpsert.create.durationSeconds,
            3600,
            "Bob new session must not be logged"
         );

         // Verify Charlie: Old session completed and finalized to OFFLINE
         const charlieUpsert = upsertCalls.find(
            (c) => c.where.participantId_logDate.participantId === "cp-charlie"
         );
         assert.ok(charlieUpsert);
         assert.strictEqual(charlieUpsert.create.status, "OFFLINE");
         assert.strictEqual(charlieUpsert.create.durationSeconds, 9000);

         // Verify Diana: Admin override protected
         assert.strictEqual(updateCalls.length, 1);
         assert.strictEqual(updateCalls[0].where.id, "log-diana");
         assert.strictEqual(updateCalls[0].data.status, "STUDYING");
      } finally {
         prisma.challenge.findMany = origChallengeFindMany;
         prisma.challenge.updateMany = origChallengeUpdateMany;
         prisma.challengeParticipant.findMany = origParticipantFindMany;
         prisma.dailyStudyLog.findMany = origLogFindMany;
         prisma.dailyStudyLog.upsert = origLogUpsert;
         prisma.dailyStudyLog.update = origLogUpdate;
      }
   });

   test("still logs study telemetry when the challenge is locked (no longer skips)", async () => {
      const lockedChallenge = {
         ...mockChallenge,
         resultsLockedAt: new Date("2026-10-11T17:00:00.000Z"),
      };

      const origChallengeFindMany = prisma.challenge.findMany;
      const origChallengeFindFirst = prisma.challenge.findFirst;
      const origChallengeUpdateMany = prisma.challenge.updateMany;
      const origParticipantFindMany = prisma.challengeParticipant.findMany;
      const origLogFindMany = prisma.dailyStudyLog.findMany;
      const origLogUpsert = prisma.dailyStudyLog.upsert;

      let upsertArgs = null;

      prisma.challenge.findMany = async ({ where } = {}) => {
         if (where?.endAt?.lte) return [];
         return [lockedChallenge];
      };
      prisma.challenge.findFirst = async () => lockedChallenge;
      prisma.challenge.updateMany = async () => ({ count: 0 });
      prisma.challengeParticipant.findMany = async () => [mockParticipants[0]];
      prisma.dailyStudyLog.findMany = async () => [];
      prisma.dailyStudyLog.upsert = async (args) => {
         upsertArgs = args;
         return args;
      };

      try {
         const silentLogger = {
            info: () => {},
            warn: () => {},
            error: () => {},
            child: () => silentLogger,
         };

         const now = new Date("2026-10-11T17:30:00.000Z");
         const members = [
            {
               userId: "ypt-alice",
               isStudying: true,
               todayStudyMs: 3600 * 1000,
               sessionElapsedMs: 0,
            },
         ];
         const result = await ingestGroupMembersToDailyStudyLogs(
            "test-group",
            members,
            now,
            silentLogger
         );

         assert.strictEqual(result.success, true);
         assert.strictEqual(
            result.upsertedCount,
            1,
            "Locked challenge must still receive study telemetry"
         );
         assert.ok(upsertArgs);
         assert.strictEqual(upsertArgs.create.participantId, "cp-alice");
      } finally {
         prisma.challenge.findMany = origChallengeFindMany;
         prisma.challenge.findFirst = origChallengeFindFirst;
         prisma.challenge.updateMany = origChallengeUpdateMany;
         prisma.challengeParticipant.findMany = origParticipantFindMany;
         prisma.dailyStudyLog.findMany = origLogFindMany;
         prisma.dailyStudyLog.upsert = origLogUpsert;
      }
   });
});

describe("lockExpiredChallengesAfterGrace & Audit Log Creation", () => {
   const challengeEnd = new Date("2026-10-12T00:00:00.000Z");
   const mockTarget = {
      id: "cmuub6ijq0003sb4eytzy2262",
      title: "October Team Battle",
      endAt: challengeEnd,
      resultsLockedAt: null,
   };

   test("does not lock challenge while still within the 6-hour grace window", async () => {
      const nowInsideGrace = new Date("2026-10-12T04:00:00.000Z"); // 4h into grace (< 6h)

      const origFindMany = prisma.challenge.findMany;
      const origUpdateMany = prisma.challenge.updateMany;
      const origAuditCreate = prisma.auditLog.create;

      let updateCount = 0;
      let auditCount = 0;

      prisma.challenge.findMany = async ({ where }) => {
         if (
            mockTarget.endAt <= where.endAt.lte &&
            !mockTarget.resultsLockedAt
         ) {
            return [mockTarget];
         }
         return [];
      };
      prisma.challenge.updateMany = async () => {
         updateCount++;
         return { count: 1 };
      };
      prisma.auditLog.create = async () => {
         auditCount++;
      };

      try {
         const locked = await lockExpiredChallengesAfterGrace(nowInsideGrace);
         assert.strictEqual(locked.length, 0);
         assert.strictEqual(
            updateCount,
            0,
            "Must not update challenge during grace"
         );
         assert.strictEqual(
            auditCount,
            0,
            "Must not create audit log during grace"
         );
      } finally {
         prisma.challenge.findMany = origFindMany;
         prisma.challenge.updateMany = origUpdateMany;
         prisma.auditLog.create = origAuditCreate;
      }
   });

   test("locks challenge and writes audit log once 6-hour grace window has elapsed", async () => {
      const nowPastGrace = new Date("2026-10-12T06:05:00.000Z"); // 6h 5m after Day 7 completion

      const origFindMany = prisma.challenge.findMany;
      const origUpdateMany = prisma.challenge.updateMany;
      const origAuditCreate = prisma.auditLog.create;

      let updateCalledWith = null;
      let auditCalledWith = null;

      prisma.challenge.findMany = async () => [mockTarget];
      prisma.challenge.updateMany = async (args) => {
         updateCalledWith = args;
         return { count: 1 };
      };
      prisma.auditLog.create = async (args) => {
         auditCalledWith = args;
         return args;
      };

      try {
         const locked = await lockExpiredChallengesAfterGrace(nowPastGrace);

         assert.strictEqual(locked.length, 1);
         assert.strictEqual(locked[0].id, mockTarget.id);

         // Verify challenge update
         assert.ok(updateCalledWith);
         assert.strictEqual(updateCalledWith.where.id, mockTarget.id);
         assert.strictEqual(updateCalledWith.where.resultsLockedAt, null);
         assert.strictEqual(
            updateCalledWith.data.resultsLockedAt.toISOString(),
            nowPastGrace.toISOString()
         );

         // Verify audit log creation
         assert.ok(auditCalledWith);
         const audit = auditCalledWith.data;
         assert.strictEqual(audit.challengeId, mockTarget.id);
         assert.strictEqual(audit.actionType, "CHALLENGE_LOCKED");
         assert.strictEqual(audit.targetEntityId, mockTarget.id);
         assert.strictEqual(audit.targetEntityType, "CHALLENGE");
         assert.strictEqual(audit.targetEntityName, mockTarget.title);
         assert.deepStrictEqual(audit.previousValue, { resultsLockedAt: null });
         assert.strictEqual(
            audit.auditReason,
            "challenge locked after 6 hr grace hours"
         );
         assert.strictEqual(
            audit.newValue.title,
            "challenge locked after 6 hr grace hours"
         );
         assert.strictEqual(audit.newValue.autoLocked, true);
         assert.strictEqual(audit.actorUsername, "system");
      } finally {
         prisma.challenge.findMany = origFindMany;
         prisma.challenge.updateMany = origUpdateMany;
         prisma.auditLog.create = origAuditCreate;
      }
   });

   test("is idempotent: does not lock or create duplicate audit log if already locked", async () => {
      const nowPastGrace = new Date("2026-10-12T06:10:00.000Z");

      const origFindMany = prisma.challenge.findMany;
      const origUpdateMany = prisma.challenge.updateMany;
      const origAuditCreate = prisma.auditLog.create;

      let auditCreated = false;

      prisma.challenge.findMany = async () => [];
      prisma.challenge.updateMany = async () => ({ count: 0 });
      prisma.auditLog.create = async () => {
         auditCreated = true;
      };

      try {
         const locked = await lockExpiredChallengesAfterGrace(nowPastGrace);
         assert.strictEqual(locked.length, 0);
         assert.strictEqual(
            auditCreated,
            false,
            "No audit log should be created on second run"
         );
      } finally {
         prisma.challenge.findMany = origFindMany;
         prisma.challenge.updateMany = origUpdateMany;
         prisma.auditLog.create = origAuditCreate;
      }
   });
});

describe("reconcileChallengeAccountability (Law L6 / GH-#217)", () => {
   const mockChallengeId = "chal-accountability-mock";

   test("flags uncompleted participants (hours, tasks, losing team) as PUNISHED and creates PunishmentRecords", async () => {
      const origTransaction = prisma.$transaction;
      const origChallengeFindUnique = prisma.challenge.findUnique;
      const origTaskFindMany = prisma.task.findMany;
      const origParticipantUpdateMany = prisma.challengeParticipant.updateMany;
      const origPunishmentDeleteMany = prisma.punishmentRecord.deleteMany;
      const origPunishmentCreateMany = prisma.punishmentRecord.createMany;

      prisma.$transaction = async (fn) =>
         typeof fn === "function" ? fn(prisma) : fn;

      const mockChallengeData = {
         id: mockChallengeId,
         title: "Accountability Test Battle",
         format: "TEAM_VS_TEAM",
         teams: [
            { id: "team-a", isDeleted: false },
            { id: "team-b", isDeleted: false },
         ],
         participants: [
            {
               id: "p1-winner",
               userId: "u1",
               teamId: "team-a",
               targetSeconds: 36_000,
               status: "NORMAL",
               isWithdrawn: false,
               dailyStudyLogs: [{ durationSeconds: 40_000 }],
               punishmentRecords: [],
            },
            {
               id: "p2-hours-deficit",
               userId: "u2",
               teamId: "team-a",
               targetSeconds: 36_000,
               status: "NORMAL",
               isWithdrawn: false,
               dailyStudyLogs: [{ durationSeconds: 10_000 }], // 26h deficit
               punishmentRecords: [],
            },
            {
               id: "p3-losing-team",
               userId: "u3",
               teamId: "team-b",
               targetSeconds: 36_000,
               status: "NORMAL",
               isWithdrawn: false,
               dailyStudyLogs: [{ durationSeconds: 36_000 }], // Hours met, but team-b loses (36k vs 50k)
               punishmentRecords: [],
            },
            {
               id: "p4-incomplete-tasks",
               userId: "u4",
               teamId: "team-a",
               targetSeconds: 36_000,
               status: "NORMAL",
               isWithdrawn: false,
               dailyStudyLogs: [{ durationSeconds: 40_000 }], // Hours met, in winning team, but task pending
               punishmentRecords: [],
            },
            {
               id: "p5-excused",
               userId: "u5",
               teamId: "team-b",
               targetSeconds: 36_000,
               status: "EXCUSED",
               isWithdrawn: false,
               dailyStudyLogs: [{ durationSeconds: 0 }],
               punishmentRecords: [{ isPardoned: true }],
            },
         ],
      };

      const mockTasks = [
         { userId: "u1", status: "COMPLETED" },
         { userId: "u2", status: "COMPLETED" },
         { userId: "u3", status: "COMPLETED" },
         { userId: "u4", status: "TODO" }, // Incomplete task!
      ];

      const participantUpdates = [];
      let deletedStalePunishments = false;
      let createdPunishments = [];

      prisma.challenge.findUnique = async () => mockChallengeData;
      prisma.task.findMany = async () => mockTasks;
      prisma.challengeParticipant.updateMany = async (args) => {
         participantUpdates.push(args);
         return { count: args.where.id.in.length };
      };
      prisma.punishmentRecord.deleteMany = async (args) => {
         deletedStalePunishments = true;
         return { count: 0 };
      };
      prisma.punishmentRecord.createMany = async (args) => {
         createdPunishments = args.data;
         return { count: args.data.length };
      };

      try {
         const result = await reconcileChallengeAccountability(mockChallengeId);

         assert.ok(result);
         assert.deepStrictEqual(result.savedParticipantIds, ["p1-winner"]);
         assert.deepStrictEqual(result.punishedParticipantIds, [
            "p2-hours-deficit",
            "p3-losing-team",
            "p4-incomplete-tasks",
         ]);

         assert.ok(
            deletedStalePunishments,
            "Must delete stale unpardoned punishment records"
         );
         assert.strictEqual(createdPunishments.length, 3);
         const createdIds = createdPunishments.map((p) => p.participantId);
         assert.ok(createdIds.includes("p2-hours-deficit"));
         assert.ok(createdIds.includes("p3-losing-team"));
         assert.ok(createdIds.includes("p4-incomplete-tasks"));

         const normalUpdate = participantUpdates.find(
            (u) => u.data.status === "NORMAL"
         );
         assert.ok(normalUpdate);
         assert.deepStrictEqual(normalUpdate.where.id.in, ["p1-winner"]);

         const punishedUpdate = participantUpdates.find(
            (u) => u.data.status === "PUNISHED"
         );
         assert.ok(punishedUpdate);
         assert.deepStrictEqual(punishedUpdate.where.id.in, [
            "p2-hours-deficit",
            "p3-losing-team",
            "p4-incomplete-tasks",
         ]);
      } finally {
         prisma.$transaction = origTransaction;
         prisma.challenge.findUnique = origChallengeFindUnique;
         prisma.task.findMany = origTaskFindMany;
         prisma.challengeParticipant.updateMany = origParticipantUpdateMany;
         prisma.punishmentRecord.deleteMany = origPunishmentDeleteMany;
         prisma.punishmentRecord.createMany = origPunishmentCreateMany;
      }
   });

   test("reconciles accountability in SOLOS format: individual competition with no team penalty", async () => {
      const origTransaction = prisma.$transaction;
      const origChallengeFindUnique = prisma.challenge.findUnique;
      const origTaskFindMany = prisma.task.findMany;
      const origParticipantUpdateMany = prisma.challengeParticipant.updateMany;
      const origPunishmentDeleteMany = prisma.punishmentRecord.deleteMany;
      const origPunishmentCreateMany = prisma.punishmentRecord.createMany;

      prisma.$transaction = async (fn) =>
         typeof fn === "function" ? fn(prisma) : fn;

      const mockSoloChallenge = {
         id: "solo-chal",
         format: "SOLOS",
         teams: [],
         participants: [
            {
               id: "p1",
               userId: "u1",
               teamId: null,
               targetSeconds: 18_000,
               status: "NORMAL",
               isWithdrawn: false,
               dailyStudyLogs: [{ durationSeconds: 18_000 }],
               punishmentRecords: [],
            },
            {
               id: "p2",
               userId: "u2",
               teamId: null,
               targetSeconds: 36_000,
               status: "NORMAL",
               isWithdrawn: false,
               dailyStudyLogs: [{ durationSeconds: 20_000 }], // 16h deficit
               punishmentRecords: [],
            },
         ],
      };

      prisma.challenge.findUnique = async () => mockSoloChallenge;
      prisma.task.findMany = async () => [];
      prisma.challengeParticipant.updateMany = async () => ({ count: 1 });
      prisma.punishmentRecord.deleteMany = async () => ({ count: 0 });
      prisma.punishmentRecord.createMany = async () => ({ count: 1 });

      try {
         const result = await reconcileChallengeAccountability("solo-chal");
         assert.deepStrictEqual(result.savedParticipantIds, ["p1"]);
         assert.deepStrictEqual(result.punishedParticipantIds, ["p2"]);
      } finally {
         prisma.$transaction = origTransaction;
         prisma.challenge.findUnique = origChallengeFindUnique;
         prisma.task.findMany = origTaskFindMany;
         prisma.challengeParticipant.updateMany = origParticipantUpdateMany;
         prisma.punishmentRecord.deleteMany = origPunishmentDeleteMany;
         prisma.punishmentRecord.createMany = origPunishmentCreateMany;
      }
   });

   test("reconciles accountability when team scores tie: both winning teams are saved (Law L6)", async () => {
      const origTransaction = prisma.$transaction;
      const origChallengeFindUnique = prisma.challenge.findUnique;
      const origTaskFindMany = prisma.task.findMany;
      const origParticipantUpdateMany = prisma.challengeParticipant.updateMany;
      const origPunishmentDeleteMany = prisma.punishmentRecord.deleteMany;
      const origPunishmentCreateMany = prisma.punishmentRecord.createMany;

      prisma.$transaction = async (fn) =>
         typeof fn === "function" ? fn(prisma) : fn;

      const mockTiedChallenge = {
         id: "tied-chal",
         format: "TEAM_VS_TEAM",
         teams: [
            { id: "team-a", isDeleted: false },
            { id: "team-b", isDeleted: false },
         ],
         participants: [
            {
               id: "p1",
               userId: "u1",
               teamId: "team-a",
               targetSeconds: 36_000,
               status: "NORMAL",
               isWithdrawn: false,
               dailyStudyLogs: [{ durationSeconds: 36_000 }],
               punishmentRecords: [],
            },
            {
               id: "p2",
               userId: "u2",
               teamId: "team-b",
               targetSeconds: 36_000,
               status: "NORMAL",
               isWithdrawn: false,
               dailyStudyLogs: [{ durationSeconds: 36_000 }],
               punishmentRecords: [],
            },
         ],
      };

      prisma.challenge.findUnique = async () => mockTiedChallenge;
      prisma.task.findMany = async () => [];
      prisma.challengeParticipant.updateMany = async () => ({ count: 2 });
      prisma.punishmentRecord.deleteMany = async () => ({ count: 0 });
      prisma.punishmentRecord.createMany = async () => ({ count: 0 });

      try {
         const result = await reconcileChallengeAccountability("tied-chal");
         assert.deepStrictEqual(result.savedParticipantIds, ["p1", "p2"]);
         assert.deepStrictEqual(result.punishedParticipantIds, []);
      } finally {
         prisma.challenge.findUnique = origChallengeFindUnique;
         prisma.task.findMany = origTaskFindMany;
         prisma.challengeParticipant.updateMany = origParticipantUpdateMany;
         prisma.punishmentRecord.deleteMany = origPunishmentDeleteMany;
         prisma.punishmentRecord.createMany = origPunishmentCreateMany;
      }
   });
   test("executes accountability mutations inside prisma.$transaction", async () => {
      let transactionCalled = false;
      const origTransaction = prisma.$transaction;
      const origChallengeFindUnique = prisma.challenge.findUnique;
      const origTaskFindMany = prisma.task.findMany;
      const origParticipantUpdateMany = prisma.challengeParticipant.updateMany;
      const origPunishmentDeleteMany = prisma.punishmentRecord.deleteMany;
      const origPunishmentCreateMany = prisma.punishmentRecord.createMany;

      prisma.$transaction = async (fn) => {
         transactionCalled = true;
         return fn(prisma);
      };
      prisma.challenge.findUnique = async () => ({
         id: "tx-chal",
         format: "SOLOS",
         teams: [],
         participants: [
            {
               id: "p1",
               userId: "u1",
               targetSeconds: 1000,
               status: "NORMAL",
               isWithdrawn: false,
               dailyStudyLogs: [{ durationSeconds: 2000 }],
               punishmentRecords: [],
            },
         ],
      });
      prisma.task.findMany = async () => [];
      prisma.challengeParticipant.updateMany = async () => ({ count: 1 });
      prisma.punishmentRecord.deleteMany = async () => ({ count: 0 });
      prisma.punishmentRecord.createMany = async () => ({ count: 0 });

      try {
         await reconcileChallengeAccountability("tx-chal");
         assert.strictEqual(
            transactionCalled,
            true,
            "$transaction must be invoked for mutations"
         );
      } finally {
         prisma.$transaction = origTransaction;
         prisma.challenge.findUnique = origChallengeFindUnique;
         prisma.task.findMany = origTaskFindMany;
         prisma.challengeParticipant.updateMany = origParticipantUpdateMany;
         prisma.punishmentRecord.deleteMany = origPunishmentDeleteMany;
         prisma.punishmentRecord.createMany = origPunishmentCreateMany;
      }
   });

   test("counts withdrawn participant logs through withdrawalAt toward team totals but excludes them from outcome evaluation", async () => {
      const origTransaction = prisma.$transaction;
      const origChallengeFindUnique = prisma.challenge.findUnique;
      const origTaskFindMany = prisma.task.findMany;
      const origParticipantUpdateMany = prisma.challengeParticipant.updateMany;
      const origPunishmentDeleteMany = prisma.punishmentRecord.deleteMany;
      const origPunishmentCreateMany = prisma.punishmentRecord.createMany;

      prisma.$transaction = async (fn) =>
         typeof fn === "function" ? fn(prisma) : fn;

      // Team A: 1 active member (10,000s) + 1 withdrawn member with logs before withdrawal (30,000s) + logs after withdrawal (50,000s, ignored)
      // Total Team A eligible: 40,000s
      // Team B: 1 active member (30,000s)
      // Total Team B: 30,000s -> Team A wins!
      const mockChallenge = {
         id: "chal-withdrawn",
         format: "TEAM_VS_TEAM",
         teams: [
            { id: "team-a", isDeleted: false },
            { id: "team-b", isDeleted: false },
         ],
         participants: [
            {
               id: "p-active-a",
               userId: "u-active-a",
               teamId: "team-a",
               targetSeconds: 10_000,
               status: "NORMAL",
               isWithdrawn: false,
               dailyStudyLogs: [{ durationSeconds: 10_000 }],
               punishmentRecords: [],
            },
            {
               id: "p-withdrawn-a",
               userId: "u-withdrawn-a",
               teamId: "team-a",
               targetSeconds: 100_000,
               status: "NORMAL",
               isWithdrawn: true,
               withdrawalAt: new Date("2026-10-10T12:00:00.000Z"),
               dailyStudyLogs: [
                  {
                     durationSeconds: 30_000,
                     createdAt: new Date("2026-10-10T10:00:00.000Z"),
                  }, // eligible
                  {
                     durationSeconds: 50_000,
                     createdAt: new Date("2026-10-10T14:00:00.000Z"),
                  }, // after withdrawal, excluded
               ],
               punishmentRecords: [],
            },
            {
               id: "p-active-b",
               userId: "u-active-b",
               teamId: "team-b",
               targetSeconds: 10_000,
               status: "NORMAL",
               isWithdrawn: false,
               dailyStudyLogs: [{ durationSeconds: 30_000 }],
               punishmentRecords: [],
            },
         ],
      };

      prisma.challenge.findUnique = async () => mockChallenge;
      prisma.task.findMany = async () => [];
      prisma.challengeParticipant.updateMany = async () => ({ count: 1 });
      prisma.punishmentRecord.deleteMany = async () => ({ count: 0 });
      prisma.punishmentRecord.createMany = async () => ({ count: 1 });

      try {
         const result =
            await reconcileChallengeAccountability("chal-withdrawn");
         // Team A wins because 10k + 30k = 40k > 30k (Team B).
         // Active A met hours and won -> saved.
         // Active B met hours but lost -> punished.
         // Withdrawn A is not in either list!
         assert.deepStrictEqual(result.savedParticipantIds, ["p-active-a"]);
         assert.deepStrictEqual(result.punishedParticipantIds, ["p-active-b"]);
      } finally {
         prisma.$transaction = origTransaction;
         prisma.challenge.findUnique = origChallengeFindUnique;
         prisma.task.findMany = origTaskFindMany;
         prisma.challengeParticipant.updateMany = origParticipantUpdateMany;
         prisma.punishmentRecord.deleteMany = origPunishmentDeleteMany;
         prisma.punishmentRecord.createMany = origPunishmentCreateMany;
      }
   });
});
