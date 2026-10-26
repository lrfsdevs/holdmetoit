import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/core/db";
import {
   _clearAuditTrailForTests,
   _setUseInMemoryAuditTrailForTests,
   getAuditTrail,
   recordAuditEvent,
} from "./audit-log.repository";

vi.mock("@/core/db", () => ({
   prisma: {
      user: { findUnique: vi.fn() },
      auditLog: { create: vi.fn(), findMany: vi.fn() },
   },
}));

describe("audit log repository (FEAT-AUDIT-01)", () => {
   beforeEach(() => {
      _clearAuditTrailForTests();
      _setUseInMemoryAuditTrailForTests(true);
   });

   it("records and retrieves immutable audit events in chronological descending order", async () => {
      await recordAuditEvent({
         actorId: "admin_1",
         actorUsername: "HostMod",
         actionType: "CHALLENGE_CREATED",
         targetEntityId: "c_1",
         targetEntityType: "CHALLENGE",
         challengeId: "c_1",
         auditReason: "Initial tournament creation",
      });

      await recordAuditEvent({
         actorId: "admin_1",
         actorUsername: "HostMod",
         actionType: "CHALLENGE_KICKOFF",
         targetEntityId: "c_1",
         targetEntityType: "CHALLENGE",
         challengeId: "c_1",
         auditReason: "Verified all member goals",
      });

      const events = await getAuditTrail("c_1");
      expect(events).toHaveLength(2);
      expect(events[0].actionType).toBe("CHALLENGE_KICKOFF");
      expect(events[1].actionType).toBe("CHALLENGE_CREATED");
   });

   it("filters audit events by challengeId when provided", async () => {
      await recordAuditEvent({
         actorId: "admin_1",
         actorUsername: "HostMod",
         actionType: "CHALLENGE_CREATED",
         targetEntityId: "c_1",
         targetEntityType: "CHALLENGE",
         challengeId: "c_1",
      });

      await recordAuditEvent({
         actorId: "admin_2",
         actorUsername: "OtherMod",
         actionType: "CHALLENGE_CREATED",
         targetEntityId: "c_2",
         targetEntityType: "CHALLENGE",
         challengeId: "c_2",
      });

      const c1Events = await getAuditTrail("c_1");
      expect(c1Events).toHaveLength(1);
      expect(c1Events[0].targetEntityId).toBe("c_1");

      const allEvents = await getAuditTrail();
      expect(allEvents).toHaveLength(2);
   });

   it("uses the transaction client and rethrows on persistence failure", async () => {
      _setUseInMemoryAuditTrailForTests(false);

      const tx = {
         user: { findUnique: vi.fn().mockResolvedValue(null) },
         auditLog: {
            create: vi
               .fn()
               .mockRejectedValue(new Error("transaction insert failed")),
         },
      };

      await expect(
         recordAuditEvent(
            {
               actorId: "user_1",
               actorUsername: "Afnan",
               actionType: "HOUSE_IDENTITY_UPDATED",
               targetEntityId: "team_1",
               targetEntityType: "TEAM",
               challengeId: "c_1",
            },
            { transactionClient: tx as never }
         )
      ).rejects.toThrow("transaction insert failed");

      expect(tx.auditLog.create).toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
   });

   it("keeps swallowing persistence failures for non-transactional callers", async () => {
      _setUseInMemoryAuditTrailForTests(false);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.auditLog.create).mockRejectedValue(
         new Error("audit db down")
      );

      await expect(
         recordAuditEvent({
            actorId: "user_1",
            actorUsername: "Afnan",
            actionType: "HOUSE_IDENTITY_UPDATED",
            targetEntityId: "team_1",
            targetEntityType: "TEAM",
            challengeId: "c_1",
         })
      ).resolves.toBeTruthy();
   });
});
