import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { EventAuditTab } from "./event-audit-tab";

vi.mock("@/features/audit/api/audit.actions", () => ({
   getChallengeAuditTrailAction: vi.fn().mockResolvedValue({
      ok: true,
      logs: [
         {
            id: "audit_1",
            timestamp: "2026-10-06T10:00:00.000Z",
            actorId: "admin_1",
            actorUsername: "HostMod",
            actorDisplayName: "Host Moderator",
            actionType: "EVENT_DETAILS_UPDATED",
            targetEntityId: "c_1",
            targetEntityType: "CHALLENGE",
            targetEntityName: "Midterm Marathon",
            challengeId: "c_1",
            previousValue: { title: "Old Title" },
            newValue: { title: "Midterm Marathon" },
            auditReason: "Updated challenge title for midterm sprint",
         },
      ],
   }),
}));

describe("EventAuditTab presentation (FEAT-AUDIT-01)", () => {
   it("renders audit log tab header, search bar, and action filter controls", () => {
      const html = renderToStaticMarkup(
         createElement(EventAuditTab, {
            challengeId: "c_1",
            challengeTitle: "Midterm Marathon",
         })
      );

      expect(html).toContain("Event Audit Log");
      expect(html).toContain("Midterm Marathon");
      expect(html).toContain("Export JSON");
      expect(html).toContain("Search audit trail");
      expect(html).toContain("All Actions");
      expect(html).toContain("Event Details");
      expect(html).toContain("Roster Edits");
      expect(html).toContain("Hours Overrides");
      expect(html).toContain("Study Hour Logs");
      expect(html).toContain("Status &amp; Lifecycle");
   });
});
