import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/core/db";
import { _clearAuditTrailForTests } from "@/features/audit/data/audit-log.repository";
import {
   createAdminChallenge,
   kickoffChallenge,
   lockChallengeResults,
} from "@/features/challenges/data/challenge-admin.repository";
import { enrollParticipantInChallenge } from "@/features/challenges/data/participant.repository";
import {
   calculateChallengeStatus,
   canEditDeclarations,
   canLogStudyTime,
} from "@/features/challenges/domain/challenge-lifecycle";
import {
   calculateRemainingDeficit,
   calculateRequiredDailyPace,
} from "@/features/leaderboard/domain/deficit";
import { composeDurationSeconds } from "@/features/study-logs/domain/daily-log.validation";
import { buildChallengeWrappedViewModel } from "@/features/wrapped/domain/wrapped";
import type { ChallengeScoreboardViewModel } from "@/features/leaderboard/domain/leaderboard.types";

vi.mock("@/core/db", () => ({
   prisma: {
      challenge: {
         findUnique: vi.fn(),
         findUniqueOrThrow: vi.fn(),
         create: vi.fn(),
         update: vi.fn(),
         updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      challengeParticipant: {
         findUnique: vi.fn(),
         findFirst: vi.fn(),
         create: vi.fn(),
         update: vi.fn(),
         updateMany: vi.fn(),
         count: vi.fn(),
      },
      dailyStudyLog: {
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
      team: {
         findUnique: vi.fn(),
      },
      user: {
         count: vi.fn(),
         update: vi.fn(),
      },
      auditLog: {
         create: vi.fn().mockResolvedValue({}),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "chal_solo_ffa" }]),
      $transaction: vi.fn((cb) => cb(prisma)),
   },
}));

describe("Solo Challenge (Free-For-All) End-to-End Lifecycle Verification", () => {
   beforeEach(() => {
      vi.clearAllMocks();
      _clearAuditTrailForTests();
   });

   it("executes the full Solo Challenge journey from creation, multi-enrollment, kickoff, deficit logging, to final lock and wrapped verification", async () => {
      // ======================================================================
      // Step 1: Admin Creates Solo Challenge (SOLOS format)
      // ======================================================================
      // Relative dates keep this lifecycle test from becoming "completed"
      // as wall-clock time advances.
      const challengeStart = new Date(Date.now() + 86400000);
      const challengeEnd = new Date(Date.now() + 7 * 86400000);

      const mockSoloChallenge = {
         id: "chal_solo_ffa",
         title: "October Solo Free-For-All",
         format: "SOLOS" as const,
         startAt: challengeStart,
         endAt: challengeEnd,
         eventBannerUrl: "https://example.com/banner.png",
         punishmentPfpUrl: "https://example.com/forfeit.png",
         teams: [
            {
               id: "team_solo_scholars",
               name: "Solo Scholars",
               color: "#3b82f6",
               iconEmoji: "⚡",
               maxMembers: null, // Uncapped for solos
               sortOrder: 0,
            },
         ],
      };

      vi.mocked(prisma.challenge.create).mockResolvedValue(
         mockSoloChallenge as never
      );

      const challenge = await createAdminChallenge(
         {
            title: "October Solo Free-For-All",
            format: "SOLOS",
            startAt: challengeStart,
            endAt: challengeEnd,
            eventBannerUrl: "https://example.com/banner.png",
            punishmentPfpUrl: "https://example.com/forfeit.png",
            teams: [
               { name: "Solo Scholars", color: "#3b82f6", iconEmoji: "⚡" },
            ],
         },
         { id: "admin_mod", username: "CommunityMod" }
      );

      expect(challenge.format).toBe("SOLOS");
      expect(challenge.teams[0].maxMembers).toBeNull();
      expect(calculateChallengeStatus(challenge, new Date())).toBe("UPCOMING");

      // ======================================================================
      // Step 2: Multiple Scholars Enroll (Verifying Uncapped Solo Capacity)
      // ======================================================================
      vi.mocked(prisma.challenge.findUnique).mockResolvedValue({
         ...mockSoloChallenge,
         isDeleted: false,
         status: "UPCOMING",
         resultsLockedAt: null,
      } as never);

      // Participant 1: Alice (Target: 35h, Leaves: 1)
      vi.mocked(prisma.challengeParticipant.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.challengeParticipant.count).mockResolvedValue(0);
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
         id: "team_solo_scholars",
         challengeId: "chal_solo_ffa",
         maxMembers: 1, // Legacy DB might still have maxMembers=1, repository MUST bypass for SOLOS
         isDeleted: false,
      } as never);
      vi.mocked(prisma.challengeParticipant.create).mockResolvedValue({
         id: "part_alice",
         challengeId: "chal_solo_ffa",
         userId: "user_alice",
         teamId: "team_solo_scholars",
         targetSeconds: 35 * 3600,
         plannedLeaveDays: 1,
         usedLeaveDays: 0,
      } as never);

      const aliceEnrollment = await enrollParticipantInChallenge({
         challengeId: "chal_solo_ffa",
         userId: "user_alice",
         teamId: "team_solo_scholars",
         targetSeconds: 35 * 3600,
         plannedLeaveDays: 1,
      });
      expect(aliceEnrollment.id).toBe("part_alice");

      // Participant 2: Bob (Target: 35h, Leaves: 0)
      // Team already has 1 member, count returns 1. In SOLOS format, Bob MUST be allowed to enroll!
      vi.mocked(prisma.challengeParticipant.count).mockResolvedValue(1);
      vi.mocked(prisma.challengeParticipant.create).mockResolvedValue({
         id: "part_bob",
         challengeId: "chal_solo_ffa",
         userId: "user_bob",
         teamId: "team_solo_scholars",
         targetSeconds: 35 * 3600,
         plannedLeaveDays: 0,
         usedLeaveDays: 0,
      } as never);

      const bobEnrollment = await enrollParticipantInChallenge({
         challengeId: "chal_solo_ffa",
         userId: "user_bob",
         teamId: "team_solo_scholars",
         targetSeconds: 35 * 3600,
         plannedLeaveDays: 0,
      });
      expect(bobEnrollment.id).toBe("part_bob");

      // Participant 3: Charlie (Target: 30h, Leaves: 2)
      vi.mocked(prisma.challengeParticipant.count).mockResolvedValue(2);
      vi.mocked(prisma.challengeParticipant.create).mockResolvedValue({
         id: "part_charlie",
         challengeId: "chal_solo_ffa",
         userId: "user_charlie",
         teamId: "team_solo_scholars",
         targetSeconds: 30 * 3600,
         plannedLeaveDays: 2,
         usedLeaveDays: 0,
      } as never);

      const charlieEnrollment = await enrollParticipantInChallenge({
         challengeId: "chal_solo_ffa",
         userId: "user_charlie",
         teamId: "team_solo_scholars",
         targetSeconds: 30 * 3600,
         plannedLeaveDays: 2,
      });
      expect(charlieEnrollment.id).toBe("part_charlie");

      // ======================================================================
      // Step 3: Host Kickoff Trigger (UPCOMING -> ACTIVE)
      // ======================================================================
      expect(canEditDeclarations("UPCOMING")).toBe(true);
      expect(canLogStudyTime("UPCOMING")).toBe(false);

      vi.mocked(prisma.challenge.findUnique).mockResolvedValue({
         id: "chal_solo_ffa",
         startAt: new Date(Date.now() + 86400000),
         endAt: new Date(Date.now() + 7 * 86400000),
      } as never);
      vi.mocked(prisma.challenge.update).mockResolvedValue({
         id: "chal_solo_ffa",
         startAt: new Date(Date.now() - 3600000),
         endAt: new Date(Date.now() + 7 * 86400000),
      } as never);

      const activeChallenge = await kickoffChallenge("chal_solo_ffa", {
         id: "admin_mod",
         username: "CommunityMod",
      });
      expect(activeChallenge.status).toBe("ACTIVE");
      expect(canEditDeclarations("ACTIVE")).toBe(false);
      expect(canLogStudyTime("ACTIVE")).toBe(true);

      // ======================================================================
      // Step 4: Daily Logging & Catch-up Deficit Pace Calculations
      // ======================================================================
      // Alice logs 35h (126,000s) -> deficit 0
      const aliceDeficit = calculateRemainingDeficit(35 * 3600, 35 * 3600);
      expect(aliceDeficit).toBe(0);

      // Bob logs 20h (72,000s) on 35h target -> deficit 15h (54,000s)
      const bobDeficit = calculateRemainingDeficit(35 * 3600, 20 * 3600);
      expect(bobDeficit).toBe(15 * 3600);
      // 2 days remaining -> required daily pace 7.5h (27,000s)
      const bobDailyPace = calculateRequiredDailyPace(bobDeficit, 2);
      expect(bobDailyPace).toBe(7.5 * 3600);

      // Charlie logs 30h (108,000s) on 30h target -> deficit 0
      const charlieDeficit = calculateRemainingDeficit(30 * 3600, 30 * 3600);
      expect(charlieDeficit).toBe(0);

      // ======================================================================
      // Step 5: Final Results Lock & Three-Condition Solo Verification
      // ======================================================================
      // At event lock:
      // Alice: 35h target met, all weekly tasks complete -> SAVED
      // Bob: 20h logged (15h deficit), weekly tasks complete -> PUNISHED (hours_deficit)
      // Charlie: 30h target met, but 1 task incomplete -> PUNISHED (incomplete_weekly_tasks)
      //
      // In SOLOS format, NO PARTICIPANT may be punished for losing_team!
      vi.mocked(prisma.challenge.findUnique).mockResolvedValue({
         id: "chal_solo_ffa",
         title: "October Solo Free-For-All",
         format: "SOLOS",
         startAt: new Date(Date.now() - 7 * 86400000),
         endAt: new Date(Date.now() - 3600000),
         resultsLockedAt: null,
         teams: [{ id: "team_solo_scholars" }],
         participants: [
            {
               id: "part_alice",
               userId: "user_alice",
               teamId: "team_solo_scholars",
               targetSeconds: 35 * 3600,
               status: "NORMAL",
               dailyStudyLogs: [
                  { durationSeconds: 7 * 3600 },
                  { durationSeconds: 7 * 3600 },
                  { durationSeconds: 7 * 3600 },
                  { durationSeconds: 7 * 3600 },
                  { durationSeconds: 7 * 3600 },
               ],
               punishmentRecords: [],
            },
            {
               id: "part_bob",
               userId: "user_bob",
               teamId: "team_solo_scholars",
               targetSeconds: 35 * 3600,
               status: "NORMAL",
               dailyStudyLogs: [
                  { durationSeconds: 10 * 3600 },
                  { durationSeconds: 10 * 3600 },
               ], // 15h deficit
               punishmentRecords: [],
            },
            {
               id: "part_charlie",
               userId: "user_charlie",
               teamId: "team_solo_scholars",
               targetSeconds: 30 * 3600,
               status: "NORMAL",
               dailyStudyLogs: [
                  { durationSeconds: 10 * 3600 },
                  { durationSeconds: 10 * 3600 },
                  { durationSeconds: 10 * 3600 },
               ], // Hours met!
               punishmentRecords: [],
            },
         ],
      } as never);

      // Weekly tasks lookup for participants:
      vi.mocked(prisma.task.findMany).mockResolvedValue([
         { id: "t_a1", userId: "user_alice", status: "COMPLETED" },
         { id: "t_a2", userId: "user_alice", status: "COMPLETED" },
         { id: "t_b1", userId: "user_bob", status: "COMPLETED" },
         { id: "t_c1", userId: "user_charlie", status: "COMPLETED" },
         { id: "t_c2", userId: "user_charlie", status: "IN_PROGRESS" }, // Incomplete goal!
      ] as never);

      vi.mocked(prisma.challenge.findUniqueOrThrow).mockResolvedValue({
         id: "chal_solo_ffa",
         startAt: new Date(Date.now() - 7 * 86400000),
         endAt: new Date(Date.now() - 3600000),
         resultsLockedAt: new Date(),
         status: "COMPLETED",
      } as never);

      const lockedResult = await lockChallengeResults("chal_solo_ffa", {
         id: "admin_mod",
         username: "CommunityMod",
      });

      expect(lockedResult.status).toBe("COMPLETED");

      // Verify punishment creation:
      // - Bob punished (deficit)
      // - Charlie punished (incomplete task)
      // - Alice NOT punished!
      expect(prisma.punishmentRecord.createMany).toHaveBeenCalledWith({
         data: [
            { challengeId: "chal_solo_ffa", participantId: "part_bob" },
            { challengeId: "chal_solo_ffa", participantId: "part_charlie" },
         ],
      });

      // Verify participant statuses updated
      expect(prisma.challengeParticipant.updateMany).toHaveBeenCalledWith({
         where: { id: { in: ["part_bob", "part_charlie"] } },
         data: { status: "PUNISHED" },
      });

      // ======================================================================
      // Step 6: Challenge Wrapped Generation Verification for Solos
      // ======================================================================
      const mockScoreboard: ChallengeScoreboardViewModel = {
         id: "chal_solo_ffa",
         title: "October Solo Free-For-All",
         format: "SOLOS",
         status: "COMPLETED",
         resultsLockedAt: "2026-10-26T08:05:00.000Z",
         startAt: "2026-10-19T08:00:00.000Z",
         endAt: "2026-10-26T08:00:00.000Z",
         daysRemaining: 0,
         totalDays: 7,
         currentDayNumber: 7,
         timeRemainingHuman: "Completed",
         heroImageUrl: null,
         eventBannerUrl: null,
         punishmentPfpUrl: null,
         teams: [
            {
               id: "team_solo_scholars",
               name: "Solo Scholars",
               color: "#3b82f6",
               iconEmoji: "⚡",
               mascotUrl: null,
               sortOrder: 0,
               companionCount: 3,
               totalLoggedSeconds: 85 * 3600,
               totalLoggedClock: "85:00:00",
               targetSeconds: 100 * 3600,
               targetClock: "100:00:00",
               targetHours: 100,
               completionPercentage: 85,
               isLeader: true,
            },
         ],
         matchHeader: {
            hasMatchup: false,
            teamA: null,
            teamB: null,
            leadMarginSeconds: 0,
            leadMarginClock: "00:00:00",
            leadMarginHuman: "0s",
            leaderTeamId: null,
            leaderSide: "tie",
            ratioPercentageA: 0,
            ratioPercentageB: 0,
         },
         standings: [
            {
               rank: 1,
               participantId: "part_alice",
               userId: "user_alice",
               displayName: "Alice",
               username: "alice",
               image: null,
               teamId: "team_solo_scholars",
               teamName: "Solo Scholars",
               teamColor: "#3b82f6",
               teamIcon: "⚡",
               totalLoggedSeconds: 35 * 3600,
               totalLoggedClock: "35:00:00",
               todayLoggedSeconds: 5 * 3600,
               todayLoggedClock: "05:00:00",
               targetSeconds: 35 * 3600,
               targetClock: "35:00:00",
               completionPercentage: 100,
               weeklyTasksCompletedCount: 2,
               weeklyTasksTotalCount: 2,
               paceStatus: "serene",
               paceLabel: "Completed",
               deficitSeconds: 0,
               status: "NORMAL",
            },
            {
               rank: 2,
               participantId: "part_bob",
               userId: "user_bob",
               displayName: "Bob",
               username: "bob",
               image: null,
               teamId: "team_solo_scholars",
               teamName: "Solo Scholars",
               teamColor: "#3b82f6",
               teamIcon: "⚡",
               totalLoggedSeconds: 20 * 3600,
               totalLoggedClock: "20:00:00",
               todayLoggedSeconds: 0,
               todayLoggedClock: "00:00:00",
               targetSeconds: 35 * 3600,
               targetClock: "35:00:00",
               completionPercentage: 57,
               weeklyTasksCompletedCount: 1,
               weeklyTasksTotalCount: 1,
               paceStatus: "punished",
               paceLabel: "Punished",
               deficitSeconds: 15 * 3600,
               status: "PUNISHED",
            },
            {
               rank: 3,
               participantId: "part_charlie",
               userId: "user_charlie",
               displayName: "Charlie",
               username: "charlie",
               image: null,
               teamId: "team_solo_scholars",
               teamName: "Solo Scholars",
               teamColor: "#3b82f6",
               teamIcon: "⚡",
               totalLoggedSeconds: 30 * 3600,
               totalLoggedClock: "30:00:00",
               todayLoggedSeconds: 0,
               todayLoggedClock: "00:00:00",
               targetSeconds: 30 * 3600,
               targetClock: "30:00:00",
               completionPercentage: 100,
               weeklyTasksCompletedCount: 1,
               weeklyTasksTotalCount: 2,
               paceStatus: "punished",
               paceLabel: "Punished",
               deficitSeconds: 0,
               status: "PUNISHED",
            },
         ],
         currentUser: {
            isLoggedIn: true,
            isEnrolled: true,
            participantId: "part_alice",
            isWrappedSeen: false,
            isFeedbackFilled: false,
         },
      };

      // Alice's Wrapped: Target met & tasks complete -> SAVED, no losing_team penalty
      const aliceWrapped = buildChallengeWrappedViewModel(
         mockScoreboard,
         "part_alice"
      );
      expect(aliceWrapped.viewer?.verdict).toBe("saved");
      expect(aliceWrapped.viewer?.reasons).toHaveLength(0);
      expect(aliceWrapped.viewer?.teamResult).toBe("winner");

      // Bob's Wrapped: Target deficit -> PUNISHED (hours_deficit), no losing_team penalty
      const bobWrapped = buildChallengeWrappedViewModel(
         mockScoreboard,
         "part_bob"
      );
      expect(bobWrapped.viewer?.verdict).toBe("punished");
      expect(bobWrapped.viewer?.reasons).toContain("hours_deficit");
      expect(bobWrapped.viewer?.reasons).not.toContain("losing_team");
      expect(bobWrapped.viewer?.teamResult).toBe("winner");

      // Charlie's Wrapped: Incomplete weekly tasks -> PUNISHED (incomplete_weekly_tasks), no losing_team penalty
      const charlieWrapped = buildChallengeWrappedViewModel(
         mockScoreboard,
         "part_charlie"
      );
      expect(charlieWrapped.viewer?.verdict).toBe("punished");
      expect(charlieWrapped.viewer?.reasons).toContain(
         "incomplete_weekly_tasks"
      );
      expect(charlieWrapped.viewer?.reasons).not.toContain("losing_team");
      expect(charlieWrapped.viewer?.teamResult).toBe("winner");
   });
});
