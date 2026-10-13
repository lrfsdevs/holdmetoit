import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/core/db";
import {
   evaluateLockOutcome,
   resolveWinningTeamIds,
} from "@/features/accountability/domain/punishment";
import {
   getAuditTrail,
   _clearAuditTrailForTests,
} from "@/features/audit/data/audit-log.repository";
import { mapDiscordProfileToUserFields } from "@/features/auth/data/discord-profile.mapper";
import {
   createAdminChallenge,
   kickoffChallenge,
   lockChallengeResults,
} from "@/features/challenges/data/challenge-admin.repository";
import {
   calculateChallengeStatus,
   canEditDeclarations,
   canLogStudyTime,
} from "@/features/challenges/domain/challenge-lifecycle";
import {
   validateWeeklyGoalDescriptions,
   validateWeeklyTargetSeconds,
} from "@/features/challenges/domain/target-hours.validation";
import {
   buildScoreboardViewModel,
   type RawChallengePayload,
} from "@/features/leaderboard/data/leaderboard-data";
import {
   calculateRemainingDeficit,
   calculateRequiredDailyPace,
} from "@/features/leaderboard/domain/deficit";
import {
   aggregateTeamScores,
   calculateLeadMargin,
} from "@/features/leaderboard/domain/leaderboard";
import { generateDiscordSummary } from "@/features/notifications/domain/discord-summary";
import { executeAdminHoursOverride } from "@/features/study-logs/data/admin-override.repository";
import {
   composeDurationSeconds,
   validateDailyLogDurationSeconds,
} from "@/features/study-logs/domain/daily-log.validation";

vi.mock("@/core/db", () => ({
   prisma: {
      challenge: {
         findUnique: vi.fn(),
         create: vi.fn(),
         update: vi.fn(),
      },
      challengeParticipant: {
         findUnique: vi.fn(),
         update: vi.fn(),
         updateMany: vi.fn(),
      },
      dailyStudyLogV2: {
         findUnique: vi.fn(),
         upsert: vi.fn(),
      },
      task: {
         findMany: vi.fn(),
      },
      punishmentRecord: {
         deleteMany: vi.fn(),
         createMany: vi.fn(),
      },
      user: {
         count: vi.fn(),
         update: vi.fn(),
      },
      $transaction: vi.fn((cb) => cb(prisma)),
   },
}));

describe("HoldMeToIt E2E Quality Matrix Verification (Journeys J1–J6)", () => {
   beforeEach(() => {
      vi.clearAllMocks();
      _clearAuditTrailForTests();
   });

   // =========================================================================
   // J1: Discord OAuth Login & Profile Provisioning (Spectator -> Auth)
   // =========================================================================
   describe("Journey J1: Auth & Public Spectator Mode", () => {
      it("permits unauthenticated guest to spectate scoreboard and syncs profile on Discord login", () => {
         // 1. Unauthenticated spectator visits challenge scoreboard
         const rawChallenge: RawChallengePayload = {
            id: "chal_public",
            title: "Midterm Reading Week Sprint",
            format: "TEAM_VS_TEAM",
            status: "ACTIVE",
            startAt: new Date("2026-09-01T08:00:00Z"),
            endAt: new Date("2026-09-08T08:00:00Z"),
            eventBannerUrl: "/assets/challenge_hero_battle.jpg",
            punishmentPfpUrl: "/prototype/assets/punishment_pfp.jpg",
            teams: [
               {
                  id: "t_bees",
                  name: "Honey Bees",
                  color: "#d9822b",
                  iconEmoji: "🐝",
                  mascotUrl: null,
                  sortOrder: 0,
               },
               {
                  id: "t_butterflies",
                  name: "Lavender Butterflies",
                  color: "#9986b8",
                  iconEmoji: "🦋",
                  mascotUrl: null,
                  sortOrder: 1,
               },
            ],
            participants: [],
         };

         const spectatorView = buildScoreboardViewModel(
            rawChallenge,
            undefined,
            new Date("2026-09-04T08:00:00Z")
         );
         expect(spectatorView.currentUser.isLoggedIn).toBe(false);
         expect(spectatorView.currentUser.isEnrolled).toBe(false);
         expect(spectatorView.heroImageUrl).toBe(
            "/assets/challenge_hero_battle.jpg"
         );
         expect(spectatorView.punishmentWall.punishmentPfpUrl).toBe(
            "/prototype/assets/punishment_pfp.jpg"
         );

         // 2. User clicks 'Login with Discord' and Discord profile is mapped
         const discordProfile = {
            providerAccountId: "discord_987654321",
            username: "study_student",
            globalName: "Alex Study",
            image: "https://cdn.discordapp.com/avatars/987654321/abc.png",
         };

         const mapped = mapDiscordProfileToUserFields(discordProfile);
         expect(mapped.discordId).toBe("discord_987654321");
         expect(mapped.displayName).toBe("Alex Study");
         expect(mapped.username).toBe("study_student");
      });
   });

   // =========================================================================
   // J2: Admin Challenge Creation & Team Rostering
   // =========================================================================
   describe("Journey J2: Challenge Creation & Rostering", () => {
      it("creates challenge in UPCOMING state and enforces Law L1 mathematical unity", async () => {
         const mockCreated = {
            id: "chal_created",
            title: "Bees vs Butterflies",
            format: "TEAM_VS_TEAM" as const,
            startAt: new Date("2026-09-01T08:00:00Z"),
            endAt: new Date("2026-09-08T08:00:00Z"),
            teams: [
               { id: "t_1", name: "Honey Bees", maxMembers: null },
               { id: "t_2", name: "Lavender Butterflies", maxMembers: null },
            ],
         };

         vi.mocked(prisma.challenge.create).mockResolvedValue(
            mockCreated as never
         );

         const challenge = await createAdminChallenge(
            {
               title: "Bees vs Butterflies",
               format: "TEAM_VS_TEAM",
               startAt: new Date("2026-09-01T08:00:00Z"),
               endAt: new Date("2026-09-08T08:00:00Z"),
               eventBannerUrl: "/assets/challenge_hero_battle.jpg",
               punishmentPfpUrl: "/prototype/assets/punishment_pfp.jpg",
               teams: [
                  { name: "Honey Bees", color: "#d9822b", iconEmoji: "🐝" },
                  {
                     name: "Lavender Butterflies",
                     color: "#9986b8",
                     iconEmoji: "🦋",
                  },
               ],
            },
            { id: "admin_host", username: "HostMod" }
         );

         expect(
            calculateChallengeStatus(
               challenge,
               new Date("2026-08-31T08:00:00Z")
            )
         ).toBe("UPCOMING");
         expect(challenge.teams).toHaveLength(2);

         // Verify audit log recorded creation event (FEAT-AUDIT-01)
         const auditTrail = await getAuditTrail("chal_created");
         expect(auditTrail).toHaveLength(1);
         expect(auditTrail[0].actionType).toBe("CHALLENGE_CREATED");
      });
   });

   // =========================================================================
   // J3: Participant Pre-Kickoff Declarations & Goal Locking
   // =========================================================================
   describe("Journey J3: Pre-Kickoff Declarations & Lock Invariant", () => {
      it("allows target and goal updates in UPCOMING and permanently locks on ACTIVE kickoff", async () => {
         // 1. Participant declares 35:00:00 (126,000s) target and 3 goals
         const targetHoursSeconds = composeDurationSeconds(35, 0, 0);
         expect(targetHoursSeconds).toBe(126000);

         const targetValidation =
            validateWeeklyTargetSeconds(targetHoursSeconds);
         expect(targetValidation.ok).toBe(true);

         const goalsValidation = validateWeeklyGoalDescriptions([
            "Read Physics Ch 1-3",
            "Math Set 4",
            "Review Bio",
         ]);
         expect(goalsValidation.ok).toBe(true);

         // While challenge is UPCOMING, editing is allowed
         expect(canEditDeclarations("UPCOMING")).toBe(true);
         expect(canLogStudyTime("UPCOMING")).toBe(false);

         // 2. Host triggers kickoff
         vi.mocked(prisma.challenge.findUnique).mockResolvedValue({
            id: "chal_kickoff",
            startAt: new Date(Date.now() + 86400000),
            endAt: new Date(Date.now() + 7 * 86400000),
         } as never);
         vi.mocked(prisma.challenge.update).mockResolvedValue({
            id: "chal_kickoff",
            startAt: new Date(Date.now() - 3600000),
            endAt: new Date(Date.now() + 7 * 86400000),
         } as never);

         const activeChallenge = await kickoffChallenge("chal_kickoff", {
            id: "admin_host",
            username: "HostMod",
         });
         expect(activeChallenge.status).toBe("ACTIVE");

         // Once ACTIVE, declarations are permanently locked
         expect(canEditDeclarations("ACTIVE")).toBe(false);
         expect(canLogStudyTime("ACTIVE")).toBe(true);

         // Audit trail records kickoff
         const audit = await getAuditTrail("chal_kickoff");
         expect(audit.some((e) => e.actionType === "CHALLENGE_KICKOFF")).toBe(
            true
         );
      });
   });

   // =========================================================================
   // J4: Daily Study Logging & Dynamic Catch-Up Deficit Recalculation
   // =========================================================================
   describe("Journey J4: Daily Logging & Catch-Up Model", () => {
      it("validates 24h limit, updates team total, and recalculates required catch-up pace without grace passes", () => {
         // 1. Participant logs 04:30:00 (16,200s)
         const loggedSeconds = composeDurationSeconds(4, 30, 0);
         expect(loggedSeconds).toBe(16200);

         const validation = validateDailyLogDurationSeconds(loggedSeconds);
         expect(validation.ok).toBe(true);

         // Enforces single-day 24h limit (86,400s)
         const invalidExcessiveSeconds = composeDurationSeconds(24, 0, 1);
         expect(
            validateDailyLogDurationSeconds(invalidExcessiveSeconds).ok
         ).toBe(false);

         // 2. Team cumulative score aggregation
         const teamA = { id: "t_bees", name: "Honey Bees" };
         const teamB = { id: "t_butterflies", name: "Lavender Butterflies" };
         const participantLogs = [
            { teamId: "t_bees", loggedSeconds: 16200 },
            { teamId: "t_bees", loggedSeconds: 18000 },
            { teamId: "t_butterflies", loggedSeconds: 14400 },
         ];

         const teamScores = aggregateTeamScores(
            [teamA, teamB],
            participantLogs
         );
         const beesScore =
            teamScores.find((t) => t.teamId === "t_bees")?.totalSeconds ?? 0;
         const butterfliesScore =
            teamScores.find((t) => t.teamId === "t_butterflies")
               ?.totalSeconds ?? 0;

         expect(beesScore).toBe(34200);
         expect(butterfliesScore).toBe(14400);

         const margin = calculateLeadMargin(beesScore, butterfliesScore);
         expect(margin.marginSeconds).toBe(19800); // 5h 30m ahead
         expect(margin.leader).toBe("a");

         // 3. Dynamic catch-up deficit model (Law L3)
         // Target: 35h (126,000s), Logged so far: 14h (50,400s), Remaining days: 3
         const targetSeconds = 35 * 3600;
         const currentLogged = 14 * 3600;
         const remainingDeficit = calculateRemainingDeficit(
            targetSeconds,
            currentLogged
         );
         expect(remainingDeficit).toBe(21 * 3600); // 75,600s deficit

         const requiredDailyPace = calculateRequiredDailyPace(
            remainingDeficit,
            3
         );
         expect(requiredDailyPace).toBe(7 * 3600); // 7h/day over 3 days
      });
   });

   // =========================================================================
   // J5: Host Manual Hours Override & Audit Logging
   // =========================================================================
   describe("Journey J5: Host Manual Hours Override", () => {
      it("allows host to correct member hours with is_override=true and records in audit trail", async () => {
         vi.mocked(prisma.dailyStudyLogV2.findUnique).mockResolvedValue({
            id: "log_1",
            participantId: "part_1",
            durationSeconds: 0,
            isOverride: false,
            participant: { challengeId: "chal_1" },
         } as never);

         vi.mocked(prisma.dailyStudyLogV2.upsert).mockResolvedValue({
            id: "log_1",
            participantId: "part_1",
            durationSeconds: 13500, // 03:45:00
            isOverride: true,
            overrideById: "host_admin_id",
            overrideReason: "Crashed YPT timer on phone",
            participant: { challengeId: "chal_1" },
         } as never);

         const updatedLog = await executeAdminHoursOverride({
            participantId: "part_1",
            logDate: "2026-09-04",
            durationSeconds: 13500,
            reason: "Crashed YPT timer on phone",
            admin: { id: "host_admin_id", username: "HostAdmin" },
         });

         expect(updatedLog.isOverride).toBe(true);
         expect(updatedLog.durationSeconds).toBe(13500);

         // Audit trail must contain the HOURS_OVERRIDE entry with prior and new values
         const auditTrail = await getAuditTrail("chal_1");
         expect(auditTrail).toHaveLength(1);
         expect(auditTrail[0].actionType).toBe("HOURS_OVERRIDE");
         expect(auditTrail[0].auditReason).toBe("Crashed YPT timer on phone");
      });
   });

   // =========================================================================
   // J6: Event Lock, Dual-Failure Auto-Punishment & Broadcaster
   // =========================================================================
   describe("Journey J6: Event Lock, Three-Condition Punishment & Discord Summary", () => {
      it("locks results, evaluates the three-condition rule, and generates the Discord summary", async () => {
         // 1. Three-condition lock evaluation (FEAT-PUN-01): saved only when hours
         //    are met AND all challenge-linked weekly tasks are complete AND the
         //    participant is in a winning team. Equal hours never punish.
         const saved = evaluateLockOutcome({
            targetSeconds: 30 * 3600,
            loggedSeconds: 32 * 3600,
            weeklyTasks: [{ status: "COMPLETED" }, { status: "COMPLETED" }],
            isInWinningTeam: true,
         });
         expect(saved.isPunished).toBe(false);

         const taskFailure = evaluateLockOutcome({
            targetSeconds: 30 * 3600,
            loggedSeconds: 32 * 3600,
            weeklyTasks: [{ status: "COMPLETED" }, { status: "IN_PROGRESS" }],
            isInWinningTeam: true,
         });
         expect(taskFailure.isPunished).toBe(true);
         expect(taskFailure.reasons).toContain("incomplete_weekly_tasks");

         const hoursFailure = evaluateLockOutcome({
            targetSeconds: 30 * 3600,
            loggedSeconds: 25 * 3600,
            weeklyTasks: [{ status: "COMPLETED" }],
            isInWinningTeam: true,
         });
         expect(hoursFailure.isPunished).toBe(true);
         expect(hoursFailure.reasons).toContain("hours_deficit");

         const teamFailure = evaluateLockOutcome({
            targetSeconds: 30 * 3600,
            loggedSeconds: 32 * 3600,
            weeklyTasks: [{ status: "COMPLETED" }],
            isInWinningTeam: false,
         });
         expect(teamFailure.isPunished).toBe(true);
         expect(teamFailure.reasons).toContain("losing_team");

         expect(
            resolveWinningTeamIds([
               { teamId: "t_a", totalSeconds: 10 },
               { teamId: "t_b", totalSeconds: 10 },
            ])
         ).toEqual(["t_a", "t_b"]);

         // 2. Host locks results
         vi.mocked(prisma.challenge.findUnique).mockResolvedValue({
            id: "chal_complete",
            title: "Reading Week Sprint",
            startAt: new Date(Date.now() - 7 * 86400000),
            endAt: new Date(Date.now() + 86400000),
            resultsLockedAt: null,
            teams: [{ id: "team_bees" }, { id: "team_butterflies" }],
            participants: [
               {
                  id: "part_1",
                  userId: "user_1",
                  teamId: "team_bees",
                  targetSeconds: 30 * 3600,
                  status: "NORMAL",
                  dailyStudyLogsV2: [{ durationSeconds: 25 * 3600 }], // 5h deficit
                  punishmentRecords: [],
               },
            ],
         } as never);
         vi.mocked(prisma.task.findMany).mockResolvedValue([
            { userId: "user_1", status: "IN_PROGRESS" },
         ] as never);

         vi.mocked(prisma.challenge.update).mockResolvedValue({
            id: "chal_complete",
            startAt: new Date(Date.now() - 7 * 86400000),
            endAt: new Date(Date.now() - 3600000),
         } as never);

         const completed = await lockChallengeResults("chal_complete", {
            id: "admin_host",
            username: "HostAdmin",
         });
         expect(completed.status).toBe("COMPLETED");
         expect(prisma.punishmentRecord.createMany).toHaveBeenCalledWith({
            data: [{ challengeId: "chal_complete", participantId: "part_1" }],
         });

         // 3. 1-Click Discord summary generation (FEAT-DISC-01)
         const discordSummary = generateDiscordSummary({
            title: "Reading Week Sprint",
            status: "COMPLETED",
            startDate: "Sep 1, 2026",
            endDate: "Sep 8, 2026",
            teams: [
               {
                  name: "Honey Bees",
                  iconEmoji: "🐝",
                  totalLoggedSeconds: 150 * 3600,
                  isLeader: true,
               },
               {
                  name: "Lavender Butterflies",
                  iconEmoji: "🦋",
                  totalLoggedSeconds: 140 * 3600,
                  isLeader: false,
               },
            ],
            podium: [
               {
                  rank: 1,
                  displayName: "Alice",
                  username: "alice",
                  teamName: "Honey Bees",
                  totalLoggedSeconds: 40 * 3600,
               },
               {
                  rank: 2,
                  displayName: "Bob",
                  username: "bob",
                  teamName: "Lavender Butterflies",
                  totalLoggedSeconds: 38 * 3600,
               },
               {
                  rank: 3,
                  displayName: "Charlie",
                  username: "charlie",
                  teamName: "Honey Bees",
                  totalLoggedSeconds: 35 * 3600,
               },
            ],
            punishedMembers: [
               {
                  displayName: "Dave",
                  username: "dave",
                  isPardoned: false,
                  pardonReason: null,
               },
            ],
         });

         expect(discordSummary).toContain(
            "🏁 **HOLDMETOIT — READING WEEK SPRINT**"
         );
         expect(discordSummary).toContain("FINAL RESULTS");
         expect(discordSummary).toContain(
            "🐝 Honey Bees**: `150:00:00` 👑 [WINNER]"
         );
         expect(discordSummary).toContain(
            "🥇 1st Place: **@alice** (Honey Bees) — `40:00:00`"
         );
         expect(discordSummary).toContain(
            "💀 **PUNISHMENT WALL (Change Avatar to Event Forfeit PFP)**"
         );
         expect(discordSummary).toContain("**@dave** — Event forfeit");
      });
   });
});
