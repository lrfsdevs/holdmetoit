import { describe, expect, it } from "vitest";

import {
   createAuditEnvelope,
   exportAuditTrailToJson,
   formatAuditActionHuman,
   type AuditEvent,
} from "./audit-log";

describe("audit log domain (FEAT-AUDIT-01)", () => {
   it("creates a complete normalized audit event envelope", () => {
      const event = createAuditEnvelope({
         actorId: "discord_123",
         actorUsername: "HostAdmin",
         actionType: "HOURS_OVERRIDE",
         targetEntityId: "log_456",
         targetEntityType: "DAILY_STUDY_LOG",
         challengeId: "chal_789",
         previousValue: { durationSeconds: 0 },
         newValue: { durationSeconds: 14400 },
         auditReason: "YPT mobile timer crashed on participant",
      });

      expect(event.id).toMatch(/^audit_/);
      expect(event.actorId).toBe("discord_123");
      expect(event.actorUsername).toBe("HostAdmin");
      expect(event.actionType).toBe("HOURS_OVERRIDE");
      expect(event.targetEntityId).toBe("log_456");
      expect(event.targetEntityType).toBe("DAILY_STUDY_LOG");
      expect(event.challengeId).toBe("chal_789");
      expect(event.auditReason).toBe("YPT mobile timer crashed on participant");
      expect(event.previousValue).toEqual({ durationSeconds: 0 });
      expect(event.newValue).toEqual({ durationSeconds: 14400 });
   });

   it("throws when required actor or target parameters are missing", () => {
      expect(() =>
         createAuditEnvelope({
            actorId: "",
            actorUsername: "Admin",
            actionType: "CHALLENGE_KICKOFF",
            targetEntityId: "chal_1",
            targetEntityType: "CHALLENGE",
         })
      ).toThrow("Audit actorId cannot be empty.");

      expect(() =>
         createAuditEnvelope({
            actorId: "admin_1",
            actorUsername: "   ",
            actionType: "CHALLENGE_KICKOFF",
            targetEntityId: "chal_1",
            targetEntityType: "CHALLENGE",
         })
      ).toThrow("Audit actorUsername cannot be empty.");

      expect(() =>
         createAuditEnvelope({
            actorId: "admin_1",
            actorUsername: "Admin",
            actionType: "CHALLENGE_KICKOFF",
            targetEntityId: "",
            targetEntityType: "CHALLENGE",
         })
      ).toThrow("Audit targetEntityId cannot be empty.");
   });

   it("maps action types to human-readable labels", () => {
      expect(formatAuditActionHuman("HOURS_OVERRIDE")).toBe(
         "Study Hours Adjusted"
      );
      expect(formatAuditActionHuman("STUDY_LOG_ADDED")).toBe(
         "Study Time Logged"
      );
      expect(formatAuditActionHuman("CHALLENGE_KICKOFF")).toBe(
         "Event Kickoff Triggered"
      );
      expect(formatAuditActionHuman("CHALLENGE_LOCKED")).toBe(
         "Final Results Locked"
      );
      expect(formatAuditActionHuman("CHALLENGE_UNLOCKED")).toBe(
         "Final Results Unlocked"
      );
      expect(formatAuditActionHuman("PARTICIPANT_PARDONED")).toBe(
         "Participant Pardoned"
      );
   });

   it("exports audit events to valid formatted JSON", () => {
      const mockEvents: AuditEvent[] = [
         createAuditEnvelope({
            actorId: "admin_1",
            actorUsername: "Admin",
            actionType: "CHALLENGE_CREATED",
            targetEntityId: "c_1",
            targetEntityType: "CHALLENGE",
            auditReason: "New weekly competition",
         }),
      ];

      const jsonString = exportAuditTrailToJson(mockEvents);
      const parsed = JSON.parse(jsonString);

      expect(parsed.totalEvents).toBe(1);
      expect(parsed.schemaVersion).toBe("1.0");
      expect(parsed.events[0].actionType).toBe("CHALLENGE_CREATED");
      expect(parsed.events[0].targetEntityId).toBe("c_1");
   });
});
