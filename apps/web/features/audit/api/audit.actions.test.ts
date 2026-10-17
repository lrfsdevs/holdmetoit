import { beforeEach, describe, expect, it, vi } from "vitest";

import { getChallengeAuditTrailAction } from "./audit.actions";
import * as authModule from "@/core/auth";
import * as auditRepoModule from "@/features/audit/data/audit-log.repository";

vi.mock("@/core/auth", () => ({
   auth: vi.fn(),
}));

vi.mock("@/features/audit/data/audit-log.repository", () => ({
   getAuditTrail: vi.fn(),
}));

describe("getChallengeAuditTrailAction (FEAT-AUDIT-01)", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   it("returns unauthorized when session is missing or user is not admin", async () => {
      vi.mocked(authModule.auth).mockResolvedValue(null as never);

      const res = await getChallengeAuditTrailAction("c_1");
      expect(res.ok).toBe(false);
      expect(res.message).toContain("Unauthorized");
      expect(res.logs).toEqual([]);
   });

   it("successfully returns audit trail logs for authenticated admin", async () => {
      vi.mocked(authModule.auth).mockResolvedValue({
         user: { id: "admin_1", role: "ADMIN" },
      } as never);

      const mockLogs = [
         {
            id: "audit_1",
            timestamp: "2026-10-06T10:00:00.000Z",
            actorId: "admin_1",
            actorUsername: "HostMod",
            actorDisplayName: "Host Mod",
            actionType: "EVENT_DETAILS_UPDATED" as const,
            targetEntityId: "c_1",
            targetEntityType: "CHALLENGE" as const,
            targetEntityName: "Midterm Sprint",
            challengeId: "c_1",
            previousValue: { title: "Old Title" },
            newValue: { title: "New Title" },
            auditReason: "Updated title",
         },
      ];

      vi.mocked(auditRepoModule.getAuditTrail).mockResolvedValue(mockLogs);

      const res = await getChallengeAuditTrailAction("c_1");
      expect(res.ok).toBe(true);
      expect(res.logs).toHaveLength(1);
      expect(res.logs[0].id).toBe("audit_1");
      expect(auditRepoModule.getAuditTrail).toHaveBeenCalledWith("c_1");
   });
});
