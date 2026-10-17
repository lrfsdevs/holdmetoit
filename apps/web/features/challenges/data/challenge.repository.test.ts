import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/core/db";
import {
   findChallengeWithTeamsById,
   findLatestAvailableChallenge,
   findLatestCompletedChallengeForWrapped,
   listAllChallenges,
} from "./challenge.repository";

vi.mock("@/core/db", () => ({
   prisma: {
      challenge: {
         findUnique: vi.fn(),
         findFirst: vi.fn(),
         findMany: vi.fn(),
      },
      challengeParticipant: {
         findFirst: vi.fn(),
      },
   },
}));

describe("challenge.repository", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   describe("findChallengeWithTeamsById", () => {
      it("finds a challenge by ID with ordered teams", async () => {
         const mockChallenge = {
            id: "chal-1",
            title: "Test Challenge",
            teams: [{ id: "t-1", sortOrder: 0 }],
         };
         vi.mocked(prisma.challenge.findUnique).mockResolvedValueOnce(
            mockChallenge as any
         );

         const result = await findChallengeWithTeamsById("chal-1");
         expect(prisma.challenge.findUnique).toHaveBeenCalledWith({
            where: { id: "chal-1" },
            include: {
               teams: {
                  where: { isDeleted: false },
                  orderBy: { sortOrder: "asc" },
               },
            },
         });
         expect(result).toEqual(mockChallenge);
      });

      it("returns null if challenge is soft-deleted", async () => {
         vi.mocked(prisma.challenge.findUnique).mockResolvedValueOnce({
            id: "chal-del",
            title: "Deleted Challenge",
            isDeleted: true,
            teams: [],
         } as any);

         const result = await findChallengeWithTeamsById("chal-del");
         expect(result).toBeNull();
      });
   });

   describe("findLatestAvailableChallenge", () => {
      it("prioritizes upcoming challenges if available", async () => {
         const mockUpcoming = { id: "upcoming-1", title: "Upcoming" };
         vi.mocked(prisma.challenge.findFirst).mockResolvedValueOnce(
            mockUpcoming as any
         );

         const result = await findLatestAvailableChallenge();
         expect(result).toEqual(mockUpcoming);
      });

      it("falls back to active challenge if no upcoming challenge", async () => {
         vi.mocked(prisma.challenge.findFirst)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: "active-1", title: "Active" } as any);

         const result = await findLatestAvailableChallenge();
         expect(result).toEqual({ id: "active-1", title: "Active" });
      });
   });

   describe("listAllChallenges", () => {
      it("lists all challenges with calculated status", async () => {
         const mockChallenges = [
            {
               id: "c-1",
               title: "Challenge 1",
               startAt: new Date(Date.now() - 86400000),
               endAt: new Date(Date.now() + 86400000),
               host: { id: "u-1" },
               teams: [],
               _count: { participants: 5 },
            },
         ];
         vi.mocked(prisma.challenge.findMany).mockResolvedValueOnce(
            mockChallenges as any
         );

         const result = await listAllChallenges();
         expect(result).toHaveLength(1);
         expect(result[0].status).toBe("ACTIVE");
      });
   });

   describe("findLatestCompletedChallengeForWrapped", () => {
      const now = new Date("2026-10-13T12:00:00.000Z");

      it("prioritizes user participation challenge if userId is given", async () => {
         const mockChallenge = {
            id: "chal-user",
            title: "User Challenge",
            resultsLockedAt: new Date("2026-10-12T00:00:00.000Z"),
            teams: [],
         };
         vi.mocked(prisma.challengeParticipant.findFirst).mockResolvedValueOnce(
            {
               challenge: mockChallenge,
            } as any
         );

         const result = await findLatestCompletedChallengeForWrapped(
            "user-1",
            now
         );
         expect(prisma.challengeParticipant.findFirst).toHaveBeenCalled();
         expect(result).toEqual(mockChallenge);
      });

      it("finds latest completed challenge when userId is not provided or not found", async () => {
         const mockChallenge = {
            id: "chal-public",
            title: "Public Challenge",
            resultsLockedAt: new Date("2026-10-12T00:00:00.000Z"),
            teams: [],
         };
         vi.mocked(prisma.challengeParticipant.findFirst).mockResolvedValueOnce(
            null
         );
         vi.mocked(prisma.challenge.findFirst).mockResolvedValueOnce(
            mockChallenge as any
         );

         const result = await findLatestCompletedChallengeForWrapped(
            "user-1",
            now
         );
         expect(result).toEqual(mockChallenge);
      });
   });
});
