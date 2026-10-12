import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/core/db";
import { getChallengeScoreboard } from "@/features/leaderboard/data/leaderboard-data";
import { getChallengeParticipantStats } from "./participant-stats.repository";

vi.mock("@/core/db", () => ({
   prisma: {
      challengeParticipant: {
         findUnique: vi.fn(),
      },
   },
}));

vi.mock("@/features/leaderboard/data/leaderboard-data", () => ({
   getChallengeScoreboard: vi.fn(),
}));

describe("getChallengeParticipantStats repository", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   const mockParticipant = {
      id: "part_1",
      challengeId: "chal_1",
      userId: "user_1",
      teamId: "team_1",
      targetSeconds: 72000, // 20h
      status: "NORMAL" as const,
      user: {
         id: "user_1",
         displayName: "Alice",
         username: "alice",
         name: "Alice Smith",
         image: "https://example.com/alice.png",
      },
      team: {
         id: "team_1",
         name: "Honey Bees",
         color: "#eab308",
         iconEmoji: "🐝",
      },
      challenge: {
         id: "chal_1",
         title: "Battle of the Bees",
         format: "TEAM_VS_TEAM" as const,
         startAt: new Date("2026-10-01T00:00:00.000Z"),
         endAt: new Date("2026-10-08T00:00:00.000Z"),
         hostId: "admin_user",
      },
      dailyStudyLogsV2: [
         {
            id: "log_1",
            logDate: new Date("2026-10-01T00:00:00.000Z"),
            durationSeconds: 14400, // 4h
            isOverride: false,
         },
         {
            id: "log_2",
            logDate: new Date("2026-10-02T00:00:00.000Z"),
            durationSeconds: 18000, // 5h
            isOverride: true,
         },
      ],
      punishmentRecords: [],
   };

   const mockScoreboard = {
      id: "chal_1",
      title: "Battle of the Bees",
      format: "TEAM_VS_TEAM",
      status: "ACTIVE",
      totalDays: 7,
      daysRemaining: 5,
      teams: [
         {
            id: "team_1",
            name: "Honey Bees",
            color: "#eab308",
            iconEmoji: "🐝",
            totalLoggedSeconds: 32400,
            companionCount: 1,
         },
      ],
      standings: [
         {
            rank: 1,
            participantId: "part_1",
            userId: "user_1",
            displayName: "Alice",
            username: "alice",
            image: "https://example.com/alice.png",
            teamId: "team_1",
            totalLoggedSeconds: 32400, // 9h
            todayLoggedSeconds: 18000,
            paceStatus: "catch-up",
            paceLabel: "Catch-Up",
         },
      ],
   };

   it("returns null if participant does not exist", async () => {
      vi.mocked(prisma.challengeParticipant.findUnique).mockResolvedValue(null);

      const result = await getChallengeParticipantStats(
         "chal_1",
         "part_nonexistent"
      );
      expect(result).toBeNull();
   });

   it("enforces cross-challenge isolation: returns null if participant belongs to another challenge", async () => {
      vi.mocked(prisma.challengeParticipant.findUnique).mockResolvedValue({
         ...mockParticipant,
         challengeId: "chal_different",
      } as any);

      const result = await getChallengeParticipantStats("chal_1", "part_1");
      expect(result).toBeNull();
   });

   it("returns complete structured stats when participant exists in challenge", async () => {
      vi.mocked(prisma.challengeParticipant.findUnique).mockResolvedValue(
         mockParticipant as any
      );
      vi.mocked(getChallengeScoreboard).mockResolvedValue(
         mockScoreboard as any
      );

      const result = await getChallengeParticipantStats("chal_1", "part_1", {
         currentUserId: "user_1",
         isAdmin: false,
      });

      expect(result).not.toBeNull();
      expect(result?.profile.displayName).toBe("Alice");
      expect(result?.profile.rank).toBe(1);
      expect(result?.profile.teamName).toBe("Honey Bees");
      expect(result?.profile.challengeTitle).toBe("Battle of the Bees");
      expect(result?.summary.totalLoggedSeconds).toBe(32400);
      expect(result?.summary.todayLoggedSeconds).toBe(18000);
      expect(result?.summary.targetSeconds).toBe(72000);
      expect(result?.summary.completionPercentage).toBe(45);
      expect(result?.summary.remainingSeconds).toBe(39600);
      expect(result?.teamStats?.teamName).toBe("Honey Bees");
      expect(result?.teamStats?.teamRank).toBe(1);
      expect(result?.teamStats?.participantTeamRank).toBe(1);
      expect(result?.teamStats?.participantContributionPercentage).toBe(100);
      expect(result?.accountability.deficitSeconds).toBe(39600);
      expect(result?.viewer.isOwner).toBe(true);
      expect(result?.viewer.isAdmin).toBe(false);
   });

   it("sets viewer.isAdmin when viewer is admin or host", async () => {
      vi.mocked(prisma.challengeParticipant.findUnique).mockResolvedValue(
         mockParticipant as any
      );
      vi.mocked(getChallengeScoreboard).mockResolvedValue(
         mockScoreboard as any
      );

      const hostResult = await getChallengeParticipantStats(
         "chal_1",
         "part_1",
         {
            currentUserId: "admin_user",
            isAdmin: false,
         }
      );
      expect(hostResult?.viewer.isAdmin).toBe(true);

      const roleAdminResult = await getChallengeParticipantStats(
         "chal_1",
         "part_1",
         {
            currentUserId: "other_user",
            isAdmin: true,
         }
      );
      expect(roleAdminResult?.viewer.isAdmin).toBe(true);
   });

   it("omits teamStats on SOLOS challenge", async () => {
      vi.mocked(prisma.challengeParticipant.findUnique).mockResolvedValue({
         ...mockParticipant,
         challenge: {
            ...mockParticipant.challenge,
            format: "SOLOS",
         },
      } as any);
      vi.mocked(getChallengeScoreboard).mockResolvedValue({
         ...mockScoreboard,
         format: "SOLOS",
      } as any);

      const result = await getChallengeParticipantStats("chal_1", "part_1");
      expect(result?.teamStats).toBeNull();
   });
});
