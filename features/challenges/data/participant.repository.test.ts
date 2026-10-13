import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/core/db";
import {
   enrollParticipantInChallenge,
   findOwnedParticipant,
   findParticipantForUser,
} from "@/features/challenges/data/participant.repository";

vi.mock("@/core/db", () => ({
   prisma: {
      challenge: {
         findUnique: vi.fn(),
      },
      team: {
         findUnique: vi.fn(),
      },
      challengeParticipant: {
         findFirst: vi.fn(),
         findUnique: vi.fn(),
         create: vi.fn(),
      },
   },
}));

describe("participant repository", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   describe("findParticipantForUser", () => {
      it("queries by specific challengeId when provided", async () => {
         const mockParticipant = {
            id: "part_1",
            challengeId: "chal_1",
            userId: "u_1",
         };
         vi.mocked(prisma.challengeParticipant.findFirst).mockResolvedValue(
            mockParticipant as never
         );

         const result = await findParticipantForUser("u_1", "chal_1");
         expect(result).toEqual(mockParticipant);
         expect(prisma.challengeParticipant.findFirst).toHaveBeenCalledWith({
            where: {
               userId: "u_1",
               challengeId: "chal_1",
               challenge: { isDeleted: false },
            },
            include: {
               challenge: true,
               team: true,
               user: true,
               dailyStudyLogsV2: { orderBy: { logDate: "asc" } },
            },
         });
      });

      it("prefers active challenge when challengeId is not specified", async () => {
         const activeParticipant = {
            id: "part_active",
            challenge: {
               startAt: new Date(Date.now() - 3600000),
               endAt: new Date(Date.now() + 7 * 86400000),
            },
         };
         vi.mocked(prisma.challengeParticipant.findFirst).mockResolvedValue(
            activeParticipant as never
         );

         const result = await findParticipantForUser("u_1");
         expect(result).toEqual(activeParticipant);
         expect(prisma.challengeParticipant.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
               where: expect.objectContaining({
                  userId: "u_1",
                  challenge: expect.objectContaining({
                     startAt: expect.any(Object),
                     endAt: expect.any(Object),
                  }),
               }),
            })
         );
      });

      it("falls back to upcoming challenge when no active challenge is found", async () => {
         const upcomingParticipant = {
            id: "part_upcoming",
            challenge: { status: "UPCOMING" },
         };

         vi.mocked(prisma.challengeParticipant.findFirst)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(upcomingParticipant as never);

         const result = await findParticipantForUser("u_1");
         expect(result).toEqual(upcomingParticipant);
         expect(prisma.challengeParticipant.findFirst).toHaveBeenCalledTimes(2);
      });

      it("falls back to completed challenge when neither active nor upcoming challenge is found", async () => {
         const completedParticipant = {
            id: "part_completed",
            challenge: { status: "COMPLETED" },
         };

         vi.mocked(prisma.challengeParticipant.findFirst)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(completedParticipant as never);

         const result = await findParticipantForUser("u_1");
         expect(result).toEqual(completedParticipant);
         expect(prisma.challengeParticipant.findFirst).toHaveBeenCalledTimes(3);
      });
   });

   describe("findOwnedParticipant", () => {
      it("queries participant by composite userId and challengeId", async () => {
         const mockRecord = {
            id: "part_1",
            userId: "u_1",
            challengeId: "c_1",
            challenge: { id: "c_1", status: "ACTIVE" },
         };

         vi.mocked(prisma.challengeParticipant.findFirst).mockResolvedValue(
            mockRecord as never
         );

         const result = await findOwnedParticipant("u_1", "c_1");
         expect(result).toEqual(mockRecord);
         expect(prisma.challengeParticipant.findFirst).toHaveBeenCalledWith({
            where: {
               userId: "u_1",
               challengeId: "c_1",
               challenge: { isDeleted: false },
            },
            include: { challenge: true },
         });
      });
   });

   describe("enrollParticipantInChallenge", () => {
      it("successfully enrolls a user into an upcoming challenge", async () => {
         vi.mocked(prisma.challenge.findUnique).mockResolvedValue({
            id: "c_1",
            status: "UPCOMING",
         } as never);

         vi.mocked(prisma.challengeParticipant.findUnique).mockResolvedValue(
            null
         );

         vi.mocked(prisma.team.findUnique).mockResolvedValue({
            id: "t_1",
            name: "Solar",
            challengeId: "c_1",
            maxMembers: 5,
            _count: { participants: 2 },
         } as never);

         const createdParticipant = {
            id: "part_new",
            userId: "u_1",
            challengeId: "c_1",
            teamId: "t_1",
            targetSeconds: 126000,
            status: "NORMAL",
         };

         vi.mocked(prisma.challengeParticipant.create).mockResolvedValue(
            createdParticipant as never
         );

         const result = await enrollParticipantInChallenge({
            challengeId: "c_1",
            userId: "u_1",
            teamId: "t_1",
            targetSeconds: 126000,
         });

         expect(result).toEqual(createdParticipant);
         expect(prisma.challengeParticipant.create).toHaveBeenCalledWith({
            data: {
               userId: "u_1",
               challengeId: "c_1",
               teamId: "t_1",
               targetSeconds: 126000,
               status: "NORMAL",
            },
            include: {
               team: true,
               challenge: true,
               user: true,
            },
         });
      });

      it("rejects enrollment when challenge is COMPLETED", async () => {
         vi.mocked(prisma.challenge.findUnique).mockResolvedValue({
            id: "c_1",
            startAt: new Date(Date.now() - 7 * 86400000),
            endAt: new Date(Date.now() - 3600000),
         } as never);

         await expect(
            enrollParticipantInChallenge({
               challengeId: "c_1",
               userId: "u_1",
               teamId: "t_1",
               targetSeconds: 126000,
            })
         ).rejects.toThrow("Cannot enroll in a completed challenge.");
      });

      it("rejects enrollment when user is already enrolled", async () => {
         vi.mocked(prisma.challenge.findUnique).mockResolvedValue({
            id: "c_1",
            startAt: new Date(Date.now() + 86400000),
            endAt: new Date(Date.now() + 7 * 86400000),
         } as never);

         vi.mocked(prisma.challengeParticipant.findUnique).mockResolvedValue({
            id: "part_existing",
         } as never);

         await expect(
            enrollParticipantInChallenge({
               challengeId: "c_1",
               userId: "u_1",
               teamId: "t_1",
               targetSeconds: 126000,
            })
         ).rejects.toThrow("User is already enrolled in this challenge.");
      });

      it("rejects enrollment when challenge is soft-deleted or not found", async () => {
         vi.mocked(prisma.challenge.findUnique).mockResolvedValue({
            id: "c_deleted",
            isDeleted: true,
         } as never);

         await expect(
            enrollParticipantInChallenge({
               challengeId: "c_deleted",
               userId: "u_1",
               teamId: "t_1",
               targetSeconds: 126000,
            })
         ).rejects.toThrow("Challenge not found.");

         expect(prisma.challenge.findUnique).toHaveBeenCalledWith({
            where: { id: "c_deleted" },
         });
      });

      it("rejects enrollment when team is soft-deleted or not found", async () => {
         vi.mocked(prisma.challenge.findUnique).mockResolvedValue({
            id: "c_1",
            isDeleted: false,
            startAt: new Date(Date.now() + 86400000),
            endAt: new Date(Date.now() + 7 * 86400000),
         } as never);

         vi.mocked(prisma.challengeParticipant.findUnique).mockResolvedValue(
            null
         );

         vi.mocked(prisma.team.findUnique).mockResolvedValue({
            id: "t_deleted",
            isDeleted: true,
            challengeId: "c_1",
            maxMembers: 5,
            _count: { participants: 0 },
         } as never);

         await expect(
            enrollParticipantInChallenge({
               challengeId: "c_1",
               userId: "u_1",
               teamId: "t_deleted",
               targetSeconds: 126000,
            })
         ).rejects.toThrow("Selected team does not belong to this challenge.");

         expect(prisma.team.findUnique).toHaveBeenCalledWith({
            where: { id: "t_deleted" },
            include: { _count: { select: { participants: true } } },
         });
      });

      it("rejects enrollment when selected team is full", async () => {
         vi.mocked(prisma.challenge.findUnique).mockResolvedValue({
            id: "c_1",
            startAt: new Date(Date.now() + 86400000),
            endAt: new Date(Date.now() + 7 * 86400000),
         } as never);

         vi.mocked(prisma.challengeParticipant.findUnique).mockResolvedValue(
            null
         );

         vi.mocked(prisma.team.findUnique).mockResolvedValue({
            id: "t_1",
            name: "Solar",
            challengeId: "c_1",
            maxMembers: 2,
            _count: { participants: 2 },
         } as never);

         await expect(
            enrollParticipantInChallenge({
               challengeId: "c_1",
               userId: "u_1",
               teamId: "t_1",
               targetSeconds: 126000,
            })
         ).rejects.toThrow("Team Solar is full (max 2 members).");
      });

      it("successfully enrolls as unassigned when teamId is omitted or no-assigned", async () => {
         vi.mocked(prisma.challenge.findUnique).mockResolvedValue({
            id: "c_1",
            startAt: new Date(Date.now() + 86400000),
            endAt: new Date(Date.now() + 7 * 86400000),
         } as never);

         vi.mocked(prisma.challengeParticipant.findUnique).mockResolvedValue(
            null
         );

         const createdParticipant = {
            id: "part_unassigned",
            userId: "u_1",
            challengeId: "c_1",
            teamId: null,
            targetSeconds: 126000,
            status: "NORMAL",
         };

         vi.mocked(prisma.challengeParticipant.create).mockResolvedValue(
            createdParticipant as never
         );

         const result = await enrollParticipantInChallenge({
            challengeId: "c_1",
            userId: "u_1",
            targetSeconds: 126000,
         });

         expect(result).toEqual(createdParticipant);
         expect(prisma.challengeParticipant.create).toHaveBeenCalledWith({
            data: {
               userId: "u_1",
               challengeId: "c_1",
               teamId: null,
               targetSeconds: 126000,
               status: "NORMAL",
            },
            include: {
               team: true,
               challenge: true,
               user: true,
            },
         });
      });
   });
});
