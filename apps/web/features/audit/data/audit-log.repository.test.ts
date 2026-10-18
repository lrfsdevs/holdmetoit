import { beforeEach, describe, expect, it } from "vitest";

import {
   _clearAuditTrailForTests,
   _setUseInMemoryAuditTrailForTests,
   getAuditTrail,
   recordAuditEvent,
} from "./audit-log.repository";

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
});
