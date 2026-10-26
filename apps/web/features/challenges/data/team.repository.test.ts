import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/core/db";
import { recordAuditEvent } from "@/features/audit/data/audit-log.repository";
import { DuoTeamIdentityError } from "@/features/challenges/domain/duo-team-identity";
import { updateDuoTeamIdentity } from "./team.repository";

const prismaMock = vi.hoisted(() => {
   const mock = {
      challenge: { findUnique: vi.fn() },
      challengeParticipant: { findUnique: vi.fn() },
      team: {
         findUnique: vi.fn(),
         findFirst: vi.fn(),
         update: vi.fn(),
      },
      $transaction: vi.fn(),
   };

   mock.$transaction.mockImplementation(
      async (callback: (tx: typeof mock) => unknown) => callback(mock)
   );

   return mock;
});

vi.mock("@/core/db", () => ({
   prisma: prismaMock,
}));

vi.mock("@/features/audit/data/audit-log.repository", () => ({
   recordAuditEvent: vi.fn(),
}));

const DAY = 24 * 60 * 60 * 1000;

function activeChallenge(overrides: Record<string, unknown> = {}) {
   const now = Date.now();
   return {
      id: "chal-1",
      isDeleted: false,
      format: "DUOS",
      startAt: new Date(now - DAY),
      endAt: new Date(now + DAY),
      resultsLockedAt: null,
      ...overrides,
   };
}

function duoParticipant(overrides: Record<string, unknown> = {}) {
   return {
      id: "part-1",
      teamId: "team-1",
      isWithdrawn: false,
      ...overrides,
   };
}

function duoTeam(overrides: Record<string, unknown> = {}) {
   return {
      id: "team-1",
      challengeId: "chal-1",
      name: "Old Duo Name",
      iconEmoji: "🔥",
      isDeleted: false,
      ...overrides,
   };
}

const actor = { username: "afnan", displayName: "Afnan" };

function baseParams(overrides: Record<string, unknown> = {}) {
   return {
      challengeId: "chal-1",
      userId: "user-1",
      name: "Old Duo Name",
      iconEmoji: "🔥",
      actor,
      ...overrides,
   };
}

describe("updateDuoTeamIdentity", () => {
   beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(prisma.challenge.findUnique).mockResolvedValue(
         activeChallenge() as never
      );
      vi.mocked(prisma.challengeParticipant.findUnique).mockResolvedValue(
         duoParticipant() as never
      );
      vi.mocked(prisma.team.findUnique).mockResolvedValue(duoTeam() as never);
      vi.mocked(prisma.team.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.team.update).mockResolvedValue(duoTeam() as never);
   });

   it("updates only the name and audits the name change", async () => {
      vi.mocked(prisma.team.update).mockResolvedValue(
         duoTeam({ name: "Caffeine & Calculus" }) as never
      );

      const result = await updateDuoTeamIdentity(
         baseParams({ name: "  Caffeine & Calculus  " })
      );

      expect(prisma.team.update).toHaveBeenCalledWith({
         where: { id: "team-1" },
         data: { name: "Caffeine & Calculus", iconEmoji: "🔥" },
      });
      expect(result.name).toBe("Caffeine & Calculus");
      expect(recordAuditEvent).toHaveBeenCalledWith(
         expect.objectContaining({
            actorId: "user-1",
            actionType: "HOUSE_IDENTITY_UPDATED",
            targetEntityId: "team-1",
            targetEntityType: "TEAM",
            targetEntityName: "Caffeine & Calculus",
            previousValue: { name: "Old Duo Name", iconEmoji: "🔥" },
            newValue: { name: "Caffeine & Calculus", iconEmoji: "🔥" },
            auditReason: "Afnan updated their duo team name",
         }),
         { transactionClient: expect.anything() }
      );
   });

   it("updates only the emoji without running the duplicate-name check", async () => {
      vi.mocked(prisma.team.update).mockResolvedValue(
         duoTeam({ iconEmoji: "🦊" }) as never
      );

      await updateDuoTeamIdentity(baseParams({ iconEmoji: "🦊" }));

      expect(prisma.team.findFirst).not.toHaveBeenCalled();
      expect(prisma.team.update).toHaveBeenCalledWith({
         where: { id: "team-1" },
         data: { name: "Old Duo Name", iconEmoji: "🦊" },
      });
      expect(recordAuditEvent).toHaveBeenCalledWith(
         expect.objectContaining({
            previousValue: { name: "Old Duo Name", iconEmoji: "🔥" },
            newValue: { name: "Old Duo Name", iconEmoji: "🦊" },
            auditReason: "Afnan updated their duo team emoji",
         }),
         { transactionClient: expect.anything() }
      );
   });

   it("updates name and emoji together with one combined audit event", async () => {
      vi.mocked(prisma.team.update).mockResolvedValue(
         duoTeam({ name: "Night Owls", iconEmoji: "🦉" }) as never
      );

      await updateDuoTeamIdentity(
         baseParams({ name: "Night Owls", iconEmoji: "🦉" })
      );

      expect(recordAuditEvent).toHaveBeenCalledTimes(1);
      expect(recordAuditEvent).toHaveBeenCalledWith(
         expect.objectContaining({
            previousValue: { name: "Old Duo Name", iconEmoji: "🔥" },
            newValue: { name: "Night Owls", iconEmoji: "🦉" },
            auditReason: "Afnan updated their duo team name and emoji",
         }),
         { transactionClient: expect.anything() }
      );
   });

   it("clears the emoji to null", async () => {
      vi.mocked(prisma.team.update).mockResolvedValue(
         duoTeam({ iconEmoji: null }) as never
      );

      await updateDuoTeamIdentity(baseParams({ iconEmoji: "" }));

      expect(prisma.team.update).toHaveBeenCalledWith({
         where: { id: "team-1" },
         data: { name: "Old Duo Name", iconEmoji: null },
      });
      expect(recordAuditEvent).toHaveBeenCalledWith(
         expect.objectContaining({
            newValue: { name: "Old Duo Name", iconEmoji: null },
            auditReason: "Afnan updated their duo team emoji",
         }),
         { transactionClient: expect.anything() }
      );
   });

   it("is a no-op when both fields are unchanged", async () => {
      await updateDuoTeamIdentity(baseParams());

      expect(prisma.team.update).not.toHaveBeenCalled();
      expect(recordAuditEvent).not.toHaveBeenCalled();
   });

   it("propagates audit failures so the transaction rolls back", async () => {
      vi.mocked(recordAuditEvent).mockRejectedValue(
         new Error("audit store down")
      );

      await expect(
         updateDuoTeamIdentity(baseParams({ iconEmoji: "🦊" }))
      ).rejects.toThrow("audit store down");

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.team.update).toHaveBeenCalled();
   });

   it("rejects an invalid emoji before touching the database", async () => {
      await expect(
         updateDuoTeamIdentity(baseParams({ iconEmoji: "🐝🐝" }))
      ).rejects.toMatchObject({ code: "INVALID_EMOJI" });

      expect(prisma.challenge.findUnique).not.toHaveBeenCalled();
      expect(prisma.team.update).not.toHaveBeenCalled();
   });

   it("rejects non-duo challenges", async () => {
      vi.mocked(prisma.challenge.findUnique).mockResolvedValue(
         activeChallenge({ format: "TEAM_VS_TEAM" }) as never
      );

      await expect(
         updateDuoTeamIdentity(baseParams({ name: "New Name" }))
      ).rejects.toMatchObject({ code: "INVALID_FORMAT" });
   });

   it("rejects completed challenges", async () => {
      const now = Date.now();
      vi.mocked(prisma.challenge.findUnique).mockResolvedValue(
         activeChallenge({
            startAt: new Date(now - 2 * DAY),
            endAt: new Date(now - DAY),
         }) as never
      );

      await expect(
         updateDuoTeamIdentity(baseParams({ name: "New Name" }))
      ).rejects.toMatchObject({ code: "CHALLENGE_COMPLETED" });
   });

   it("rejects locked results", async () => {
      vi.mocked(prisma.challenge.findUnique).mockResolvedValue(
         activeChallenge({ resultsLockedAt: new Date() }) as never
      );

      await expect(
         updateDuoTeamIdentity(baseParams({ name: "New Name" }))
      ).rejects.toMatchObject({ code: "RESULTS_LOCKED" });
   });

   it("rejects participants without a team", async () => {
      vi.mocked(prisma.challengeParticipant.findUnique).mockResolvedValue(
         duoParticipant({ teamId: null }) as never
      );

      await expect(
         updateDuoTeamIdentity(baseParams({ name: "New Name" }))
      ).rejects.toMatchObject({ code: "NOT_IN_TEAM" });
   });

   it("rejects withdrawn participants", async () => {
      vi.mocked(prisma.challengeParticipant.findUnique).mockResolvedValue(
         duoParticipant({ isWithdrawn: true }) as never
      );

      await expect(
         updateDuoTeamIdentity(baseParams({ name: "New Name" }))
      ).rejects.toMatchObject({ code: "NOT_IN_TEAM" });
   });

   it("rejects a case-insensitive duplicate name", async () => {
      vi.mocked(prisma.team.findFirst).mockResolvedValue({
         id: "team-2",
      } as never);

      await expect(
         updateDuoTeamIdentity(baseParams({ name: "midnight chai" }))
      ).rejects.toBeInstanceOf(DuoTeamIdentityError);

      expect(prisma.team.findFirst).toHaveBeenCalledWith(
         expect.objectContaining({
            where: expect.objectContaining({
               challengeId: "chal-1",
               id: { not: "team-1" },
               name: { equals: "midnight chai", mode: "insensitive" },
            }),
         })
      );
   });

   it("rejects a deleted team", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue(
         duoTeam({ isDeleted: true }) as never
      );

      await expect(
         updateDuoTeamIdentity(baseParams({ name: "New Name" }))
      ).rejects.toMatchObject({ code: "NOT_IN_TEAM" });
   });
});
