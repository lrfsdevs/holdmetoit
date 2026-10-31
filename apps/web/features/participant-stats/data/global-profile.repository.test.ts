import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/core/db";
import {
   getGlobalUserProfile,
   getChallengeSnapshotForUser,
} from "./global-profile.repository";
import * as participantStatsRepo from "./participant-stats.repository";

vi.mock("@/core/db", () => ({
   prisma: {
      user: {
         findUnique: vi.fn(),
      },
      task: {
         count: vi.fn(),
      },
      userPokemon: {
         count: vi.fn(),
      },
      challengeParticipant: {
         findMany: vi.fn(),
      },
      trophyTransaction: {
         findMany: vi.fn(),
      },
   },
}));

vi.mock("./participant-stats.repository", () => ({
   getChallengeParticipantStats: vi.fn(),
}));

describe("global-profile.repository", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   const mockUser = {
      id: "user_1",
      displayName: "Alice Scholar",
      username: "alicescholar",
      name: "Alice",
      image: "https://example.com/alice.png",
      role: "PARTICIPANT",
      createdAt: new Date("2026-01-15T00:00:00.000Z"),
      trophyBalance: 1250,
   };

   describe("getGlobalUserProfile", () => {
      it("returns null when user is not found", async () => {
         vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

         const result = await getGlobalUserProfile("nonexistent_user");
         expect(result).toBeNull();
      });

      it("returns career stats for user with zero challenge enrollments", async () => {
         vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
         vi.mocked(prisma.task.count).mockResolvedValue(15);
         vi.mocked(prisma.userPokemon.count).mockResolvedValue(7);
         vi.mocked(prisma.challengeParticipant.findMany).mockResolvedValue([]);
         vi.mocked(prisma.trophyTransaction.findMany).mockResolvedValue([]);

         const result = await getGlobalUserProfile("user_1");

         expect(result).not.toBeNull();
         expect(result?.user).toEqual({
            id: "user_1",
            displayName: "Alice Scholar",
            username: "alicescholar",
            image: "https://example.com/alice.png",
            role: "PARTICIPANT",
            joinedAt: "2026-01-15T00:00:00.000Z",
            trophyBalance: 1250,
         });

         expect(result?.careerStats).toMatchObject({
            lifetimeStudyHours: 0,
            lifetimeStudySeconds: 0,
            lifetimeStudyClock: "00:00:00",
            totalActiveStudyDays: 0,
            currentStreak: 0,
            longestStreak: 0,
            totalChallengesEntered: 0,
            challengesCompleted: 0,
            totalTasksCompleted: 15,
            trophyTotal: 1250,
            pokedexCount: 7,
         });
         expect(result?.challengeHistory).toEqual([]);
      });

      it("aggregates stats across multiple participated challenges ordered newest first", async () => {
         vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
         vi.mocked(prisma.task.count).mockResolvedValue(42);
         vi.mocked(prisma.userPokemon.count).mockResolvedValue(12);

         const mockParticipations = [
            {
               id: "part_recent",
               challengeId: "chal_2",
               userId: "user_1",
               targetSeconds: 72000, // 20h
               isWithdrawn: false,
               challenge: {
                  id: "chal_2",
                  title: "Winter Sprint",
                  format: "DUOS",
                  status: "ACTIVE",
                  startAt: new Date("2026-10-25T00:00:00.000Z"),
                  endAt: new Date("2026-11-05T00:00:00.000Z"),
                  resultsLockedAt: null,
               },
               dailyStudyLogs: [
                  {
                     logDate: new Date("2026-10-25T00:00:00.000Z"),
                     durationSeconds: 14400, // 4h
                     isLeave: false,
                  },
               ],
            },
            {
               id: "part_older",
               challengeId: "chal_1",
               userId: "user_1",
               targetSeconds: 108000, // 30h
               isWithdrawn: false,
               challenge: {
                  id: "chal_1",
                  title: "Autumn Clash",
                  format: "TEAM_VS_TEAM",
                  status: "COMPLETED",
                  startAt: new Date("2026-10-01T00:00:00.000Z"),
                  endAt: new Date("2026-10-08T00:00:00.000Z"),
                  resultsLockedAt: new Date("2026-10-08T00:00:00.000Z"),
               },
               dailyStudyLogs: [
                  {
                     logDate: new Date("2026-10-01T00:00:00.000Z"),
                     durationSeconds: 18000, // 5h
                     isLeave: false,
                  },
                  {
                     logDate: new Date("2026-10-02T00:00:00.000Z"),
                     durationSeconds: 18000, // 5h
                     isLeave: false,
                  },
               ],
            },
         ];

         vi.mocked(prisma.challengeParticipant.findMany).mockResolvedValue(
            mockParticipations as any
         );

         vi.mocked(prisma.trophyTransaction.findMany).mockResolvedValue([
            {
               amount: 50,
               sourceId: "chal_1",
               groupId: null,
               metadata: null,
            } as any,
         ]);

         const result = await getGlobalUserProfile("user_1");

         expect(result).not.toBeNull();
         expect(result?.careerStats.totalChallengesEntered).toBe(2);
         expect(result?.careerStats.challengesCompleted).toBe(1);
         expect(result?.careerStats.lifetimeStudySeconds).toBe(50400); // 14h total
         expect(result?.careerStats.lifetimeStudyHours).toBe(14);
         expect(result?.careerStats.totalActiveStudyDays).toBe(3);

         // Challenge History
         expect(result?.challengeHistory).toHaveLength(2);
         expect(result?.challengeHistory[0]).toEqual({
            challengeId: "chal_2",
            participantId: "part_recent",
            title: "Winter Sprint",
            mode: "DUOS",
            status: "ACTIVE",
            startDate: "2026-10-25T00:00:00.000Z",
            endDate: "2026-11-05T00:00:00.000Z",
            targetHours: 20,
            loggedHours: 4,
            trophyDelta: 0,
         });

         expect(result?.challengeHistory[1]).toEqual({
            challengeId: "chal_1",
            participantId: "part_older",
            title: "Autumn Clash",
            mode: "TEAM_VS_TEAM",
            status: "COMPLETED",
            startDate: "2026-10-01T00:00:00.000Z",
            endDate: "2026-10-08T00:00:00.000Z",
            targetHours: 30,
            loggedHours: 10,
            trophyDelta: 50,
         });
      });
   });

   describe("getChallengeSnapshotForUser", () => {
      it("delegates to getChallengeParticipantStats with target userId and challengeId", async () => {
         const mockSnapshot = {
            profile: { challengeTitle: "Test Challenge" },
         } as any;

         vi.mocked(
            participantStatsRepo.getChallengeParticipantStats
         ).mockResolvedValue(mockSnapshot);

         const result = await getChallengeSnapshotForUser("user_1", "chal_1", {
            isAdmin: true,
         });

         expect(
            participantStatsRepo.getChallengeParticipantStats
         ).toHaveBeenCalledWith("chal_1", "user_1", {
            isAdmin: true,
            currentUserId: "user_1",
         });
         expect(result).toBe(mockSnapshot);
      });
   });
});
