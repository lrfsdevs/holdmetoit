import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/core/db";
import * as auditRepo from "@/features/audit/data/audit-log.repository";
import {
   adminEnrollParticipant,
   adminUpdateParticipantTarget,
   createAdminChallenge,
   deleteAdminChallenge,
   kickoffChallenge,
   listAllChallengesForAdmin,
   lockChallengeResults,
   reassignParticipantTeam,
   removeChallengeParticipant,
   unlockChallengeResults,
   updateAdminChallenge,
} from "./challenge-admin.repository";

vi.mock("@/core/db", () => {
   const mockPrisma = {
      challenge: {
         findMany: vi.fn(),
         findUnique: vi.fn(),
         create: vi.fn(),
         update: vi.fn(),
         delete: vi.fn(),
      },
      team: {
         findMany: vi.fn(),
         findUnique: vi.fn(),
         update: vi.fn(),
         updateMany: vi.fn(),
         create: vi.fn(),
         deleteMany: vi.fn(),
      },
      challengeParticipant: {
         findUnique: vi.fn(),
         create: vi.fn(),
         update: vi.fn(),
         updateMany: vi.fn(),
         delete: vi.fn(),
         deleteMany: vi.fn(),
      },
      dailyStudyLog: {
         deleteMany: vi.fn(),
      },
      task: {
         findMany: vi.fn(),
         updateMany: vi.fn(),
      },
      punishmentRecord: {
         upsert: vi.fn(),
         deleteMany: vi.fn(),
         createMany: vi.fn(),
      },
      $transaction: vi.fn((cb) => cb(mockPrisma)),
   };
   return { prisma: mockPrisma };
});

vi.mock("@/features/audit/data/audit-log.repository", () => ({
   recordAuditEvent: vi.fn().mockResolvedValue({ id: "audit_1" }),
   getAuditTrail: vi.fn().mockResolvedValue([]),
}));

describe("challenge admin repository (FEAT-CHAL-01, FEAT-CHAL-02, FEAT-CHAL-05)", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   describe("listAllChallengesForAdmin", () => {
      it("queries challenges with host, teams, and participant counts", async () => {
         const mockList = [
            {
               id: "c_1",
               title: "Battle",
               startAt: new Date(Date.now() - 3600000),
               endAt: new Date(Date.now() + 7 * 86400000),
            },
         ];
         vi.mocked(prisma.challenge.findMany).mockResolvedValue(
            mockList as never
         );

         const result = await listAllChallengesForAdmin();
         expect(result).toEqual([
            {
               ...mockList[0],
               status: "ACTIVE",
            },
         ]);
         expect(prisma.challenge.findMany).toHaveBeenCalled();
      });
   });

   describe("createAdminChallenge", () => {
      it("creates challenge and teams within transaction with audit logging", async () => {
         const mockCreated = {
            id: "c_new",
            title: "Sprint Battle",
            teams: [{ id: "t_1" }, { id: "t_2" }],
         };
         vi.mocked(prisma.challenge.create).mockResolvedValue(
            mockCreated as never
         );

         const result = await createAdminChallenge(
            {
               title: "Sprint Battle",
               format: "TEAM_VS_TEAM",
               startAt: new Date("2026-09-01T08:00:00Z"),
               endAt: new Date("2026-09-08T08:00:00Z"),
               eventBannerUrl: " https://example.com/banner.webp ",
               punishmentPfpUrl: " https://example.com/pfp.png ",
               teams: [{ name: "Bees" }, { name: "Butterflies" }],
            },
            { id: "admin_1", username: "HostAdmin" }
         );

         expect(result).toEqual(mockCreated);
         expect(prisma.challenge.create).toHaveBeenCalledWith(
            expect.objectContaining({
               data: expect.objectContaining({
                  title: "Sprint Battle",
                  eventBannerUrl: "https://example.com/banner.webp",
                  punishmentPfpUrl: "https://example.com/pfp.png",
               }),
            })
         );
      });

      it("creates challenge with custom description", async () => {
         const mockCreated = {
            id: "c_desc",
            title: "Custom Desc Battle",
            description: "Custom study battle description",
            teams: [{ id: "t_1" }],
         };
         vi.mocked(prisma.challenge.create).mockResolvedValue(
            mockCreated as never
         );

         const result = await createAdminChallenge(
            {
               title: "Custom Desc Battle",
               description: "  Custom study battle description  ",
               format: "SOLOS",
               startAt: new Date("2026-09-01T08:00:00Z"),
               endAt: new Date("2026-09-08T08:00:00Z"),
               teams: [{ name: "Solos" }],
            },
            { id: "admin_1", username: "HostAdmin" }
         );

         expect(result).toEqual(mockCreated);
         expect(prisma.challenge.create).toHaveBeenCalledWith(
            expect.objectContaining({
               data: expect.objectContaining({
                  title: "Custom Desc Battle",
                  description: "Custom study battle description",
               }),
            })
         );
      });
   });

   describe("optional challenge creation images", () => {
      it("stores null for omitted images without deriving a banner from a PFP", async () => {
         vi.mocked(prisma.challenge.create).mockResolvedValue({
            id: "c_new",
            title: "Study Battle",
            format: "SOLOS",
            teams: [],
         } as never);

         await createAdminChallenge(
            {
               title: "Study Battle",
               format: "SOLOS",
               startAt: "2026-09-01T00:00:00.000Z",
               endAt: "2026-09-08T00:00:00.000Z",
               punishmentPfpUrl: "https://example.com/pfp.png",
               teams: [{ name: "Solo" }],
            },
            { id: "admin_1", username: "HostAdmin" }
         );

         expect(prisma.challenge.create).toHaveBeenCalledWith(
            expect.objectContaining({
               data: expect.objectContaining({
                  eventBannerUrl: null,
                  punishmentPfpUrl: "https://example.com/pfp.png",
               }),
            })
         );
      });
   });

   describe("kickoffChallenge", () => {
      it("transitions challenge from UPCOMING to ACTIVE", async () => {
         vi.mocked(prisma.challenge.findUnique).mockResolvedValue({
            id: "c_up",
            startAt: new Date(Date.now() + 86400000),
            endAt: new Date(Date.now() + 7 * 86400000),
         } as never);
         vi.mocked(prisma.challenge.update).mockResolvedValue({
            id: "c_up",
            startAt: new Date(Date.now() - 3600000),
            endAt: new Date(Date.now() + 7 * 86400000),
         } as never);

         const result = await kickoffChallenge("c_up", {
            id: "admin_1",
            username: "HostAdmin",
         });
         expect(result.status).toBe("ACTIVE");
         expect(prisma.challenge.update).toHaveBeenCalledWith(
            expect.objectContaining({
               where: { id: "c_up" },
            })
         );
      });

      it("throws when challenge is already ACTIVE", async () => {
         vi.mocked(prisma.challenge.findUnique).mockResolvedValue({
            id: "c_act",
            startAt: new Date(Date.now() - 3600000),
            endAt: new Date(Date.now() + 7 * 86400000),
         } as never);

         await expect(
            kickoffChallenge("c_act", { id: "admin_1", username: "HostAdmin" })
         ).rejects.toThrow("Challenge is already active.");
      });
   });

   describe("lockChallengeResults", () => {
      function mockLockChallenge(
         participants: Array<Record<string, unknown>>,
         teams: Array<{ id: string }> = [{ id: "t_1" }, { id: "t_2" }]
      ) {
         return {
            id: "c_act",
            title: "October Team Battle",
            startAt: new Date(Date.now() - 7 * 86400000),
            endAt: new Date(Date.now() + 86400000),
            resultsLockedAt: null,
            teams,
            participants,
         };
      }

      function mockParticipant(overrides: Record<string, unknown> = {}) {
         return {
            id: "p_1",
            userId: "u_1",
            teamId: "t_1",
            targetSeconds: 36000,
            status: "NORMAL",
            dailyStudyLogs: [{ durationSeconds: 36000 }],
            punishmentRecords: [],
            ...overrides,
         };
      }

      function mockCompletedChallenge() {
         return {
            id: "c_act",
            title: "October Team Battle",
            startAt: new Date(Date.now() - 7 * 86400000),
            endAt: new Date(Date.now() - 3600000),
            resultsLockedAt: new Date(),
         };
      }

      it("saves a winning-team participant with all weekly tasks complete and hours met", async () => {
         vi.mocked(prisma.challenge.findUnique).mockResolvedValue(
            mockLockChallenge([
               mockParticipant({
                  dailyStudyLogs: [{ durationSeconds: 40000 }],
               }),
            ]) as never
         );
         vi.mocked(prisma.task.findMany).mockResolvedValue([
            { userId: "u_1", status: "COMPLETED" },
         ] as never);
         vi.mocked(prisma.challenge.update).mockResolvedValue(
            mockCompletedChallenge() as never
         );

         const result = await lockChallengeResults("c_act", {
            id: "admin_1",
            username: "HostAdmin",
         });

         expect(result.status).toBe("COMPLETED");
         expect(prisma.task.findMany).toHaveBeenCalledWith({
            where: {
               challengeId: "c_act",
               taskType: "WEEKLY",
               userId: { in: ["u_1"] },
            },
            select: { userId: true, status: true },
         });
         expect(auditRepo.recordAuditEvent).toHaveBeenCalledWith(
            expect.objectContaining({
               actionType: "CHALLENGE_LOCKED",
               previousValue: expect.objectContaining({
                  endAt: expect.any(String),
               }),
            })
         );
         expect(prisma.challengeParticipant.updateMany).toHaveBeenCalledWith({
            where: { id: { in: ["p_1"] } },
            data: { status: "NORMAL" },
         });
         expect(prisma.punishmentRecord.createMany).not.toHaveBeenCalled();
         expect(prisma.punishmentRecord.deleteMany).toHaveBeenCalledWith({
            where: { challengeId: "c_act", isPardoned: false },
         });
      });

      it("skips withdrawn participants during lock evaluation", async () => {
         vi.mocked(prisma.challenge.findUnique).mockResolvedValue(
            mockLockChallenge([
               mockParticipant({
                  dailyStudyLogs: [{ durationSeconds: 40000 }],
               }),
               mockParticipant({
                  id: "p_withdrawn",
                  userId: "u_withdrawn",
                  isWithdrawn: true,
                  dailyStudyLogs: [],
               }),
            ]) as never
         );
         vi.mocked(prisma.task.findMany).mockResolvedValue([
            { userId: "u_1", status: "COMPLETED" },
         ] as never);
         vi.mocked(prisma.challenge.update).mockResolvedValue(
            mockCompletedChallenge() as never
         );

         await lockChallengeResults("c_act", {
            id: "admin_1",
            username: "HostAdmin",
         });

         expect(prisma.task.findMany).toHaveBeenCalledWith({
            where: {
               challengeId: "c_act",
               taskType: "WEEKLY",
               userId: { in: ["u_1"] },
            },
            select: { userId: true, status: true },
         });
         expect(prisma.challengeParticipant.updateMany).toHaveBeenCalledWith({
            where: { id: { in: ["p_1"] } },
            data: { status: "NORMAL" },
         });
         expect(prisma.punishmentRecord.createMany).not.toHaveBeenCalled();
         expect(auditRepo.recordAuditEvent).toHaveBeenCalledWith(
            expect.objectContaining({
               actionType: "CHALLENGE_LOCKED",
               newValue: expect.objectContaining({
                  withdrawnParticipants: 1,
                  participantsEvaluated: 1,
               }),
            })
         );
      });

      it("punishes a winning-team participant when a weekly task is incomplete", async () => {
         vi.mocked(prisma.challenge.findUnique).mockResolvedValue(
            mockLockChallenge([
               mockParticipant({
                  dailyStudyLogs: [{ durationSeconds: 40000 }],
               }),
            ]) as never
         );
         vi.mocked(prisma.task.findMany).mockResolvedValue([
            { userId: "u_1", status: "IN_PROGRESS" },
         ] as never);
         vi.mocked(prisma.challenge.update).mockResolvedValue(
            mockCompletedChallenge() as never
         );

         await lockChallengeResults("c_act", {
            id: "admin_1",
            username: "HostAdmin",
         });

         expect(prisma.challengeParticipant.updateMany).toHaveBeenCalledWith({
            where: { id: { in: ["p_1"] } },
            data: { status: "PUNISHED" },
         });
         expect(prisma.punishmentRecord.createMany).toHaveBeenCalledWith({
            data: [{ challengeId: "c_act", participantId: "p_1" }],
         });
      });

      it("punishes a losing-team participant even with tasks complete and hours met", async () => {
         vi.mocked(prisma.challenge.findUnique).mockResolvedValue(
            mockLockChallenge([
               mockParticipant({
                  dailyStudyLogs: [{ durationSeconds: 36000 }],
               }),
               mockParticipant({
                  id: "p_2",
                  userId: "u_2",
                  teamId: "t_2",
                  dailyStudyLogs: [{ durationSeconds: 72000 }],
               }),
            ]) as never
         );
         vi.mocked(prisma.task.findMany).mockResolvedValue([
            { userId: "u_1", status: "COMPLETED" },
            { userId: "u_2", status: "COMPLETED" },
         ] as never);
         vi.mocked(prisma.challenge.update).mockResolvedValue(
            mockCompletedChallenge() as never
         );

         await lockChallengeResults("c_act", {
            id: "admin_1",
            username: "HostAdmin",
         });

         expect(prisma.challengeParticipant.updateMany).toHaveBeenCalledWith({
            where: { id: { in: ["p_1"] } },
            data: { status: "PUNISHED" },
         });
         expect(prisma.challengeParticipant.updateMany).toHaveBeenCalledWith({
            where: { id: { in: ["p_2"] } },
            data: { status: "NORMAL" },
         });
         expect(prisma.punishmentRecord.createMany).toHaveBeenCalledWith({
            data: [{ challengeId: "c_act", participantId: "p_1" }],
         });
      });

      it("never punishes via the team condition when combined hours are tied", async () => {
         vi.mocked(prisma.challenge.findUnique).mockResolvedValue(
            mockLockChallenge([
               mockParticipant({}),
               mockParticipant({ id: "p_2", userId: "u_2", teamId: "t_2" }),
            ]) as never
         );
         vi.mocked(prisma.task.findMany).mockResolvedValue([
            { userId: "u_1", status: "COMPLETED" },
            { userId: "u_2", status: "COMPLETED" },
         ] as never);
         vi.mocked(prisma.challenge.update).mockResolvedValue(
            mockCompletedChallenge() as never
         );

         await lockChallengeResults("c_act", {
            id: "admin_1",
            username: "HostAdmin",
         });

         expect(prisma.challengeParticipant.updateMany).toHaveBeenCalledWith({
            where: { id: { in: ["p_1", "p_2"] } },
            data: { status: "NORMAL" },
         });
         expect(prisma.punishmentRecord.createMany).not.toHaveBeenCalled();
      });

      it("keeps pardoned participants excused and preserves their records", async () => {
         vi.mocked(prisma.challenge.findUnique).mockResolvedValue(
            mockLockChallenge([
               mockParticipant({
                  status: "EXCUSED",
                  punishmentRecords: [{ isPardoned: true }],
               }),
            ]) as never
         );
         vi.mocked(prisma.task.findMany).mockResolvedValue([] as never);
         vi.mocked(prisma.challenge.update).mockResolvedValue(
            mockCompletedChallenge() as never
         );

         await lockChallengeResults("c_act", {
            id: "admin_1",
            username: "HostAdmin",
         });

         expect(prisma.challengeParticipant.updateMany).not.toHaveBeenCalled();
         expect(prisma.punishmentRecord.createMany).not.toHaveBeenCalled();
         expect(prisma.punishmentRecord.deleteMany).toHaveBeenCalledWith({
            where: { challengeId: "c_act", isPardoned: false },
         });
      });

      it("evaluates SOLOS format participants individually on target hours and weekly tasks without losing-team penalty", async () => {
         const soloChallenge = {
            ...mockLockChallenge([
               mockParticipant({
                  id: "p_1",
                  userId: "u_1",
                  teamId: null,
                  targetSeconds: 36000,
                  dailyStudyLogs: [{ durationSeconds: 36000 }],
               }),
               mockParticipant({
                  id: "p_2",
                  userId: "u_2",
                  teamId: null,
                  targetSeconds: 36000,
                  dailyStudyLogs: [{ durationSeconds: 18000 }],
               }),
            ]),
            format: "SOLOS",
         };

         vi.mocked(prisma.challenge.findUnique).mockResolvedValue(
            soloChallenge as never
         );
         vi.mocked(prisma.task.findMany).mockResolvedValue([
            { userId: "u_1", status: "COMPLETED" },
            { userId: "u_2", status: "COMPLETED" },
         ] as never);
         vi.mocked(prisma.challenge.update).mockResolvedValue(
            mockCompletedChallenge() as never
         );

         await lockChallengeResults("c_act", {
            id: "admin_1",
            username: "HostAdmin",
         });

         // p_1 (met target hours + tasks) is SAVED (status: NORMAL) even though teamId is null
         expect(prisma.challengeParticipant.updateMany).toHaveBeenCalledWith({
            where: { id: { in: ["p_1"] } },
            data: { status: "NORMAL" },
         });
         // p_2 (deficit) is PUNISHED
         expect(prisma.challengeParticipant.updateMany).toHaveBeenCalledWith({
            where: { id: { in: ["p_2"] } },
            data: { status: "PUNISHED" },
         });
         expect(prisma.punishmentRecord.createMany).toHaveBeenCalledWith({
            data: [{ challengeId: "c_act", participantId: "p_2" }],
         });
      });

      it("successfully locks an expired challenge (COMPLETED status) when results are not yet locked (Fix D1)", async () => {
         const pastEnd = new Date(Date.now() - 3600000); // Ended 1 hour ago
         vi.mocked(prisma.challenge.findUnique).mockResolvedValue({
            id: "c_expired",
            title: "Sprint Battle",
            startAt: new Date(Date.now() - 7 * 86400000),
            endAt: pastEnd,
            resultsLockedAt: null,
            teams: [{ id: "t_1" }],
            participants: [
               {
                  id: "p_expired_1",
                  userId: "u_expired_1",
                  teamId: "t_1",
                  targetSeconds: 20000,
                  status: "NORMAL",
                  dailyStudyLogs: [{ durationSeconds: 25000 }], // Exceeded target
                  punishmentRecords: [],
               },
            ],
         } as never);
         vi.mocked(prisma.task.findMany).mockResolvedValue([] as never);

         vi.mocked(prisma.challenge.update).mockResolvedValue({
            id: "c_expired",
            title: "Sprint Battle",
            startAt: new Date(Date.now() - 7 * 86400000),
            endAt: pastEnd,
            resultsLockedAt: new Date(),
         } as never);

         const result = await lockChallengeResults("c_expired", {
            id: "admin_host",
            username: "HostAdmin",
         });

         expect(result.status).toBe("COMPLETED");
         expect(prisma.challenge.update).toHaveBeenCalledWith({
            where: { id: "c_expired" },
            data: {
               endAt: pastEnd,
               resultsLockedAt: expect.any(Date),
            },
         });
         expect(prisma.challengeParticipant.updateMany).toHaveBeenCalledWith({
            where: { id: { in: ["p_expired_1"] } },
            data: { status: "NORMAL" },
         });
      });

      it("rejects locking a challenge whose results are already locked", async () => {
         vi.mocked(prisma.challenge.findUnique).mockResolvedValue({
            id: "c_already_locked",
            startAt: new Date(Date.now() - 7 * 86400000),
            endAt: new Date(Date.now() - 3600000),
            resultsLockedAt: new Date(Date.now() - 1800000),
            participants: [],
         } as never);

         await expect(
            lockChallengeResults("c_already_locked", {
               id: "admin_1",
               username: "HostAdmin",
            })
         ).rejects.toThrow(
            "Challenge results are already locked and finalized."
         );
      });

      it("rejects locking an UPCOMING challenge", async () => {
         vi.mocked(prisma.challenge.findUnique).mockResolvedValue({
            id: "c_upcoming",
            startAt: new Date(Date.now() + 86400000),
            endAt: new Date(Date.now() + 7 * 86400000),
            resultsLockedAt: null,
            participants: [],
         } as never);

         await expect(
            lockChallengeResults("c_upcoming", {
               id: "admin_1",
               username: "HostAdmin",
            })
         ).rejects.toThrow(
            "Cannot lock final results on an event that has not started yet."
         );
      });
   });

   describe("unlockChallengeResults", () => {
      function mockLockedChallenge(overrides: Record<string, unknown> = {}) {
         return {
            id: "c_act",
            title: "October Team Battle",
            startAt: new Date(Date.now() - 7 * 86400000),
            endAt: new Date(Date.now() - 3600000),
            resultsLockedAt: new Date(),
            ...overrides,
         };
      }

      it("reverts everything the lock produced and restores the original endAt", async () => {
         vi.mocked(prisma.challenge.findUnique).mockResolvedValue(
            mockLockedChallenge() as never
         );
         vi.mocked(auditRepo.getAuditTrail).mockResolvedValue([
            {
               actionType: "CHALLENGE_LOCKED",
               previousValue: { endAt: "2026-10-12T00:00:00.000Z" },
            },
         ] as never);
         vi.mocked(prisma.challenge.update).mockResolvedValue(
            mockLockedChallenge({
               resultsLockedAt: null,
               endAt: new Date("2026-10-12T00:00:00.000Z"),
            }) as never
         );
         vi.mocked(prisma.challengeParticipant.updateMany)
            .mockResolvedValueOnce({ count: 3 } as never)
            .mockResolvedValueOnce({ count: 3 } as never);
         vi.mocked(prisma.punishmentRecord.deleteMany).mockResolvedValue({
            count: 2,
         } as never);

         const result = await unlockChallengeResults("c_act", {
            id: "admin_1",
            username: "HostAdmin",
         });

         expect(prisma.challenge.update).toHaveBeenCalledWith({
            where: { id: "c_act" },
            data: {
               resultsLockedAt: null,
               endAt: new Date("2026-10-12T00:00:00.000Z"),
            },
         });
         expect(prisma.challengeParticipant.updateMany).toHaveBeenCalledWith({
            where: { challengeId: "c_act" },
            data: { status: "NORMAL" },
         });
         expect(prisma.punishmentRecord.deleteMany).toHaveBeenCalledWith({
            where: { challengeId: "c_act" },
         });
         expect(prisma.challengeParticipant.updateMany).toHaveBeenCalledWith({
            where: { challengeId: "c_act" },
            data: { isWrappedSeen: false, isFeedbackFilled: false },
         });
         expect(result.participantsReset).toBe(3);
         expect(result.recordsDeleted).toBe(2);
         expect(result.wrappedFlagsReset).toBe(true);
         expect(result.restoredEndAt?.toISOString()).toBe(
            "2026-10-12T00:00:00.000Z"
         );
         expect(auditRepo.recordAuditEvent).toHaveBeenCalledWith(
            expect.objectContaining({
               actionType: "CHALLENGE_UNLOCKED",
               previousValue: expect.objectContaining({
                  resultsLockedAt: expect.any(String),
                  endAt: expect.any(String),
               }),
               newValue: expect.objectContaining({
                  resultsLockedAt: null,
                  participantsReset: 3,
                  recordsDeleted: 2,
                  wrappedFlagsReset: true,
               }),
            })
         );
      });

      it("prefers an explicit endAt over the audit history", async () => {
         vi.mocked(prisma.challenge.findUnique).mockResolvedValue(
            mockLockedChallenge() as never
         );
         vi.mocked(prisma.challenge.update).mockResolvedValue(
            mockLockedChallenge({ resultsLockedAt: null }) as never
         );
         vi.mocked(prisma.challengeParticipant.updateMany).mockResolvedValue({
            count: 0,
         } as never);
         vi.mocked(prisma.punishmentRecord.deleteMany).mockResolvedValue({
            count: 0,
         } as never);

         const explicitEndAt = new Date("2026-10-20T00:00:00.000Z");
         await unlockChallengeResults(
            "c_act",
            { id: "admin_1", username: "HostAdmin" },
            { endAt: explicitEndAt }
         );

         expect(auditRepo.getAuditTrail).not.toHaveBeenCalled();
         expect(prisma.challenge.update).toHaveBeenCalledWith({
            where: { id: "c_act" },
            data: { resultsLockedAt: null, endAt: explicitEndAt },
         });
      });

      it("keeps wrapped flags when requested", async () => {
         vi.mocked(prisma.challenge.findUnique).mockResolvedValue(
            mockLockedChallenge() as never
         );
         vi.mocked(prisma.challenge.update).mockResolvedValue(
            mockLockedChallenge({ resultsLockedAt: null }) as never
         );
         vi.mocked(prisma.challengeParticipant.updateMany).mockResolvedValue({
            count: 1,
         } as never);
         vi.mocked(prisma.punishmentRecord.deleteMany).mockResolvedValue({
            count: 0,
         } as never);

         const result = await unlockChallengeResults(
            "c_act",
            { id: "admin_1", username: "HostAdmin" },
            { keepWrappedFlags: true }
         );

         expect(prisma.challengeParticipant.updateMany).toHaveBeenCalledTimes(
            1
         );
         expect(result.wrappedFlagsReset).toBe(false);
      });

      it("rejects when the results are not locked", async () => {
         vi.mocked(prisma.challenge.findUnique).mockResolvedValue(
            mockLockedChallenge({ resultsLockedAt: null }) as never
         );

         await expect(
            unlockChallengeResults("c_act", {
               id: "admin_1",
               username: "HostAdmin",
            })
         ).rejects.toThrow("Challenge results are not locked.");
      });

      it("rejects when the challenge does not exist", async () => {
         vi.mocked(prisma.challenge.findUnique).mockResolvedValue(null);

         await expect(
            unlockChallengeResults("missing", {
               id: "admin_1",
               username: "HostAdmin",
            })
         ).rejects.toThrow("Challenge not found.");
      });
   });

   describe("adminEnrollParticipant", () => {
      it("successfully enrolls user and records audit trail (Law L5)", async () => {
         vi.mocked(prisma.challenge.findUnique).mockResolvedValue({
            id: "c_1",
         } as never);

         vi.mocked(prisma.challengeParticipant.findUnique).mockResolvedValue(
            null
         );

         vi.mocked(prisma.team.findUnique).mockResolvedValue({
            id: "t_1",
            name: "Butterflies",
            challengeId: "c_1",
            maxMembers: 10,
            _count: { participants: 3 },
         } as never);

         const mockParticipant = {
            id: "part_admin_assigned",
            userId: "u_2",
            challengeId: "c_1",
            teamId: "t_1",
            targetSeconds: 126000,
            status: "NORMAL",
         };

         vi.mocked(prisma.challengeParticipant.create).mockResolvedValue(
            mockParticipant as never
         );

         const result = await adminEnrollParticipant({
            challengeId: "c_1",
            userId: "u_2",
            teamId: "t_1",
            targetSeconds: 126000,
            reason: "Manual host placement from Discord",
            admin: { id: "admin_1", username: "HostAdmin" },
         });

         expect(result).toEqual(mockParticipant);
         expect(prisma.challengeParticipant.create).toHaveBeenCalledWith({
            data: {
               userId: "u_2",
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

      it("rejects when user is already enrolled", async () => {
         vi.mocked(prisma.challenge.findUnique).mockResolvedValue({
            id: "c_1",
         } as never);

         vi.mocked(prisma.challengeParticipant.findUnique).mockResolvedValue({
            id: "part_existing",
         } as never);

         await expect(
            adminEnrollParticipant({
               challengeId: "c_1",
               userId: "u_2",
               teamId: "t_1",
               reason: "Host override",
               admin: { id: "admin_1", username: "HostAdmin" },
            })
         ).rejects.toThrow("User is already enrolled in this challenge.");
      });
   });

   describe("updateAdminChallenge", () => {
      it("updates challenge details and teams with audit trail", async () => {
         vi.mocked(prisma.challenge.findUnique).mockResolvedValue({
            id: "c_1",
            title: "Old Title",
            format: "TEAM_VS_TEAM",
            startAt: new Date("2026-09-01"),
            endAt: new Date("2026-09-08"),
            teams: [{ id: "t_1", name: "Old Team" }],
         } as never);

         const mockUpdated = {
            id: "c_1",
            title: "New Title",
            startAt: new Date("2026-09-02"),
            endAt: new Date("2026-09-09"),
         };
         vi.mocked(prisma.challenge.update).mockResolvedValue(
            mockUpdated as never
         );
         vi.mocked(prisma.team.create).mockResolvedValue({
            id: "t_created",
         } as never);

         const result = await updateAdminChallenge(
            "c_1",
            {
               title: "New Title",
               startAt: "2026-09-02T00:00:00.000Z",
               endAt: "2026-09-09T00:00:00.000Z",
               eventBannerUrl: " https://example.com/banner.webp ",
               punishmentPfpUrl: " https://example.com/pfp.png ",
               teams: [
                  {
                     id: "t_1",
                     name: "Updated Bees",
                     color: "#FFB066",
                     iconEmoji: "🐝",
                  },
                  {
                     name: "New Butterflies",
                     color: "#A29DAE",
                     iconEmoji: "🦋",
                  },
               ],
            },
            { id: "admin_1", username: "HostAdmin" }
         );

         expect(result).toEqual(mockUpdated);
         expect(prisma.challenge.update).toHaveBeenCalledWith({
            where: { id: "c_1" },
            data: {
               title: "New Title",
               startAt: new Date("2026-09-02T00:00:00.000Z"),
               endAt: new Date("2026-09-09T00:00:00.000Z"),
               eventBannerUrl: " https://example.com/banner.webp ",
               punishmentPfpUrl: " https://example.com/pfp.png ",
            },
         });
         expect(prisma.team.update).toHaveBeenCalled();
         expect(prisma.team.create).toHaveBeenCalled();
      });

      it("updates challenge description and records audit diff", async () => {
         vi.mocked(prisma.challenge.findUnique).mockResolvedValue({
            id: "c_1",
            title: "Battle",
            description: "Old description",
            format: "SOLOS",
            startAt: new Date("2026-09-01"),
            endAt: new Date("2026-09-08"),
            teams: [],
         } as never);

         const mockUpdated = {
            id: "c_1",
            title: "Battle",
            description: "New updated description",
            startAt: new Date("2026-09-01"),
            endAt: new Date("2026-09-08"),
         };
         vi.mocked(prisma.challenge.update).mockResolvedValue(
            mockUpdated as never
         );

         const result = await updateAdminChallenge(
            "c_1",
            {
               title: "Battle",
               description: "  New updated description  ",
               startAt: "2026-09-01T00:00:00.000Z",
               endAt: "2026-09-08T00:00:00.000Z",
               eventBannerUrl: null,
               punishmentPfpUrl: null,
               teams: [],
            },
            { id: "admin_1", username: "HostAdmin" }
         );

         expect(result).toEqual(mockUpdated);
         expect(prisma.challenge.update).toHaveBeenCalledWith({
            where: { id: "c_1" },
            data: {
               title: "Battle",
               description: "New updated description",
               startAt: new Date("2026-09-01T00:00:00.000Z"),
               endAt: new Date("2026-09-08T00:00:00.000Z"),
               eventBannerUrl: null,
               punishmentPfpUrl: null,
            },
         });
      });
   });

   describe("nullable and legacy challenge image updates", () => {
      it.each([
         { eventBannerUrl: null, punishmentPfpUrl: null },
         {
            eventBannerUrl: "https://example.com/banner.webp",
            punishmentPfpUrl: null,
         },
         {
            eventBannerUrl: null,
            punishmentPfpUrl: "https://example.com/pfp.png",
         },
         { eventBannerUrl: "", punishmentPfpUrl: "   " },
         { eventBannerUrl: "   ", punishmentPfpUrl: "" },
         {
            eventBannerUrl:
               "  https://example.com/legacy-banner.webp?download=banner.webp#preview  ",
            punishmentPfpUrl: "  https://example.com/legacy-pfp.png#avatar  ",
         },
      ])(
         "preserves unchanged raw legacy image fields independently (%j)",
         async (images) => {
            vi.mocked(prisma.challenge.findUnique).mockResolvedValue({
               id: "c_1",
               title: "Study Battle",
               format: "SOLOS",
               startAt: new Date("2026-09-01"),
               endAt: new Date("2026-09-08"),
               teams: [],
               ...images,
            } as never);
            vi.mocked(prisma.challenge.update).mockResolvedValue({
               id: "c_1",
            } as never);

            await updateAdminChallenge(
               "c_1",
               {
                  title: "Study Battle",
                  startAt: "2026-09-01T00:00:00.000Z",
                  endAt: "2026-09-08T00:00:00.000Z",
                  teams: [],
                  ...images,
               },
               { id: "admin_1", username: "HostAdmin" }
            );

            expect(prisma.challenge.update).toHaveBeenCalledWith(
               expect.objectContaining({
                  data: expect.objectContaining(images),
               })
            );
         }
      );
   });

   describe("reassignParticipantTeam", () => {
      it("reassigns a participant to a new team in the challenge", async () => {
         vi.mocked(prisma.challengeParticipant.findUnique).mockResolvedValue({
            id: "part_1",
            challengeId: "c_1",
            teamId: "t_1",
            team: { id: "t_1", name: "Bees" },
            user: { id: "u_1", displayName: "Afnan", username: "afnan" },
         } as never);

         vi.mocked(prisma.team.findUnique).mockResolvedValue({
            id: "t_2",
            challengeId: "c_1",
            name: "Butterflies",
            maxMembers: null,
            _count: { participants: 3 },
         } as never);

         const mockUpdated = {
            id: "part_1",
            teamId: "t_2",
            team: { id: "t_2", name: "Butterflies" },
            user: { id: "u_1", displayName: "Afnan" },
         };
         vi.mocked(prisma.challengeParticipant.update).mockResolvedValue(
            mockUpdated as never
         );

         const result = await reassignParticipantTeam({
            participantId: "part_1",
            newTeamId: "t_2",
            reason: "Rebalance teams",
            admin: { id: "admin_1", username: "HostAdmin" },
         });

         expect(result).toEqual(mockUpdated);
         expect(prisma.challengeParticipant.update).toHaveBeenCalledWith({
            where: { id: "part_1" },
            data: { teamId: "t_2" },
            include: { team: true, user: true },
         });
      });

      it("rejects when destination team belongs to a different challenge", async () => {
         vi.mocked(prisma.challengeParticipant.findUnique).mockResolvedValue({
            id: "part_1",
            challengeId: "c_1",
            teamId: "t_1",
            team: { id: "t_1", name: "Bees" },
            user: { id: "u_1", displayName: "Afnan" },
         } as never);

         vi.mocked(prisma.team.findUnique).mockResolvedValue({
            id: "t_other",
            challengeId: "c_other",
            name: "Foreign Team",
            maxMembers: null,
            _count: { participants: 0 },
         } as never);

         await expect(
            reassignParticipantTeam({
               participantId: "part_1",
               newTeamId: "t_other",
               admin: { id: "admin_1", username: "HostAdmin" },
            })
         ).rejects.toThrow(
            "Selected destination team does not belong to this challenge."
         );
      });

      it("unassigns participant when newTeamId is no-assigned", async () => {
         vi.mocked(prisma.challengeParticipant.findUnique).mockResolvedValue({
            id: "part_1",
            challengeId: "c_1",
            teamId: "t_1",
            team: { id: "t_1", name: "Bees" },
            user: { id: "u_1", displayName: "Afnan", username: "afnan" },
         } as never);

         const mockUnassigned = {
            id: "part_1",
            teamId: null,
            team: null,
            user: { id: "u_1", displayName: "Afnan" },
         };
         vi.mocked(prisma.challengeParticipant.update).mockResolvedValue(
            mockUnassigned as never
         );

         const result = await reassignParticipantTeam({
            participantId: "part_1",
            newTeamId: "no-assigned",
            reason: "Reset to unassigned",
            admin: { id: "admin_1", username: "HostAdmin" },
         });

         expect(result).toEqual(mockUnassigned);
         expect(prisma.challengeParticipant.update).toHaveBeenCalledWith({
            where: { id: "part_1" },
            data: { teamId: null },
            include: { team: true, user: true },
         });
      });
   });

   describe("deleteAdminChallenge", () => {
      it("soft-deletes challenge, teams, and tasks while recording audit trail", async () => {
         vi.mocked(prisma.challenge.findUnique).mockResolvedValue({
            id: "c_1",
            title: "Test Challenge",
            startAt: new Date(Date.now() + 86400000),
            endAt: new Date(Date.now() + 7 * 86400000),
         } as never);

         const mockDeleted = {
            id: "c_1",
            title: "Test Challenge",
            isDeleted: true,
            deletionTime: new Date(),
         };
         vi.mocked(prisma.challenge.update).mockResolvedValue(
            mockDeleted as never
         );

         const result = await deleteAdminChallenge("c_1", {
            id: "admin_1",
            username: "HostAdmin",
         });

         expect(result).toEqual(mockDeleted);
         expect(prisma.team.updateMany).toHaveBeenCalledWith({
            where: { challengeId: "c_1", isDeleted: false },
            data: {
               isDeleted: true,
               deletionTime: expect.any(Date),
            },
         });
         expect(prisma.task.updateMany).toHaveBeenCalledWith({
            where: { challengeId: "c_1", isDeleted: false },
            data: {
               isDeleted: true,
               deletionTime: expect.any(Date),
            },
         });
         expect(prisma.challenge.update).toHaveBeenCalledWith({
            where: { id: "c_1" },
            data: {
               isDeleted: true,
               deletionTime: expect.any(Date),
            },
         });
         expect(prisma.challenge.delete).not.toHaveBeenCalled();
      });
   });

   describe("removeChallengeParticipant", () => {
      function mockParticipant(overrides: Record<string, unknown> = {}) {
         return {
            id: "p_1",
            userId: "u_1",
            challengeId: "c_1",
            teamId: "t_1",
            targetSeconds: 126000,
            status: "NORMAL",
            isWithdrawn: false,
            user: { id: "u_1", displayName: "Afnan", username: "afnan" },
            team: { id: "t_1", name: "Bees" },
            challenge: {
               id: "c_1",
               title: "Battle",
               startAt: new Date(Date.now() + 86400000),
               endAt: new Date(Date.now() + 7 * 86400000),
               resultsLockedAt: null,
            },
            dailyStudyLogs: [{ durationSeconds: 3600 }],
            ...overrides,
         };
      }

      it("soft-withdraws the participant and records PARTICIPANT_REMOVED", async () => {
         vi.mocked(prisma.challengeParticipant.findUnique).mockResolvedValue(
            mockParticipant() as never
         );

         const result = await removeChallengeParticipant({
            participantId: "p_1",
            reason: "Duplicate enrollment",
            admin: { id: "admin_1", username: "HostAdmin" },
         });

         expect(result).toEqual({
            participantId: "p_1",
            removedName: "Afnan",
         });
         expect(prisma.challengeParticipant.update).toHaveBeenCalledWith({
            where: { id: "p_1" },
            data: { isWithdrawn: true, withdrawalAt: expect.any(Date) },
         });
         expect(prisma.dailyStudyLog.deleteMany).not.toHaveBeenCalled();
         expect(prisma.punishmentRecord.deleteMany).not.toHaveBeenCalled();
         expect(prisma.challengeParticipant.delete).not.toHaveBeenCalled();
         expect(auditRepo.recordAuditEvent).toHaveBeenCalledWith(
            expect.objectContaining({
               actorId: "admin_1",
               actionType: "PARTICIPANT_REMOVED",
               targetEntityType: "PARTICIPANT",
               challengeId: "c_1",
               auditReason: "Duplicate enrollment",
               newValue: expect.objectContaining({ isWithdrawn: true }),
            })
         );
      });

      it("rejects when the participant does not exist", async () => {
         vi.mocked(prisma.challengeParticipant.findUnique).mockResolvedValue(
            null
         );

         await expect(
            removeChallengeParticipant({
               participantId: "missing",
               reason: "Host cleanup",
               admin: { id: "admin_1", username: "HostAdmin" },
            })
         ).rejects.toThrow("Participant not found.");
      });

      it("rejects when the challenge is COMPLETED", async () => {
         vi.mocked(prisma.challengeParticipant.findUnique).mockResolvedValue(
            mockParticipant({
               challenge: {
                  id: "c_1",
                  title: "Battle",
                  startAt: new Date(Date.now() - 14 * 86400000),
                  endAt: new Date(Date.now() - 7 * 86400000),
                  resultsLockedAt: null,
               },
            }) as never
         );

         await expect(
            removeChallengeParticipant({
               participantId: "p_1",
               reason: "Too late",
               admin: { id: "admin_1", username: "HostAdmin" },
            })
         ).rejects.toThrow("This challenge has already concluded.");
         expect(prisma.challengeParticipant.update).not.toHaveBeenCalled();
      });

      it("rejects when results are locked", async () => {
         vi.mocked(prisma.challengeParticipant.findUnique).mockResolvedValue(
            mockParticipant({
               challenge: {
                  id: "c_1",
                  title: "Battle",
                  startAt: new Date(Date.now() - 86400000),
                  endAt: new Date(Date.now() + 86400000),
                  resultsLockedAt: new Date(),
               },
            }) as never
         );

         await expect(
            removeChallengeParticipant({
               participantId: "p_1",
               reason: "Too late",
               admin: { id: "admin_1", username: "HostAdmin" },
            })
         ).rejects.toThrow(
            "Results are locked; withdrawal is no longer possible."
         );
         expect(prisma.challengeParticipant.update).not.toHaveBeenCalled();
      });

      it("rejects an already-withdrawn participant", async () => {
         vi.mocked(prisma.challengeParticipant.findUnique).mockResolvedValue(
            mockParticipant({ isWithdrawn: true }) as never
         );

         await expect(
            removeChallengeParticipant({
               participantId: "p_1",
               reason: "Duplicate removal",
               admin: { id: "admin_1", username: "HostAdmin" },
            })
         ).rejects.toThrow("You have already withdrawn from this challenge.");
      });
   });

   describe("adminUpdateParticipantTarget (Law L5 / FEAT-DECL-04)", () => {
      it("successfully updates participant target hours and records audit log", async () => {
         const mockParticipant = {
            id: "p_1",
            challengeId: "c_1",
            userId: "u_1",
            targetSeconds: 72000,
            user: { displayName: "Alice", username: "alice" },
            team: { name: "Bees" },
         };
         const mockUpdated = {
            ...mockParticipant,
            targetSeconds: 90000,
         };

         vi.mocked(prisma.challengeParticipant.findUnique).mockResolvedValue(
            mockParticipant as never
         );
         vi.mocked(prisma.challengeParticipant.update).mockResolvedValue(
            mockUpdated as never
         );

         const result = await adminUpdateParticipantTarget({
            challengeId: "c_1",
            participantId: "p_1",
            targetSeconds: 90000,
            reason: "Adjusted due to illness accommodation",
            admin: { id: "admin_1", username: "HostAdmin" },
         });

         expect(result.targetSeconds).toBe(90000);
         expect(prisma.challengeParticipant.update).toHaveBeenCalledWith({
            where: { id: "p_1" },
            data: { targetSeconds: 90000 },
            include: { user: true, team: true, challenge: true },
         });
      });

      it("rejects when participant is not found", async () => {
         vi.mocked(prisma.challengeParticipant.findUnique).mockResolvedValue(
            null
         );

         await expect(
            adminUpdateParticipantTarget({
               challengeId: "c_1",
               participantId: "nonexistent",
               targetSeconds: 90000,
               admin: { id: "admin_1", username: "HostAdmin" },
            })
         ).rejects.toThrow("Participant not found.");
      });

      it("rejects when participant belongs to a different challenge", async () => {
         vi.mocked(prisma.challengeParticipant.findUnique).mockResolvedValue({
            id: "p_1",
            challengeId: "other_challenge",
         } as never);

         await expect(
            adminUpdateParticipantTarget({
               challengeId: "c_1",
               participantId: "p_1",
               targetSeconds: 90000,
               admin: { id: "admin_1", username: "HostAdmin" },
            })
         ).rejects.toThrow("Participant does not belong to this challenge.");
      });
   });
});
