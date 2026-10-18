import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
   AdminPardonModal,
   type AdminPardonParticipant,
} from "./admin-pardon-modal";

vi.mock("next/navigation", () => ({
   useRouter: () => ({
      refresh: vi.fn(),
   }),
}));

vi.mock("@/features/accountability/api/admin-pardon.actions", () => ({
   adminPardonAction: vi.fn(),
}));

vi.mock("@/core/observability/logrocket", () => ({
   trackLogRocketEvent: vi.fn(),
   captureLogRocketException: vi.fn(),
}));

describe("AdminPardonModal (Law L5 / FEAT-PUN-04)", () => {
   const sampleParticipant: AdminPardonParticipant = {
      participantId: "part_1",
      userId: "user_1",
      displayName: "Alice Scholar",
      username: "alice",
      teamName: "Solo Scholar",
      teamColor: "#3b82f6",
      status: "PUNISHED",
   };

   it("returns null when isOpen is false", () => {
      const html = renderToStaticMarkup(
         createElement(AdminPardonModal, {
            isOpen: false,
            onClose: vi.fn(),
            challengeId: "c_1",
            participant: sampleParticipant,
         })
      );

      expect(html).toBe("");
   });

   it("returns null when participant is null", () => {
      const html = renderToStaticMarkup(
         createElement(AdminPardonModal, {
            isOpen: true,
            onClose: vi.fn(),
            challengeId: "c_1",
            participant: null,
         })
      );

      expect(html).toBe("");
   });

   it("renders participant details, current status, and dialog title when open", () => {
      const html = renderToStaticMarkup(
         createElement(AdminPardonModal, {
            isOpen: true,
            onClose: vi.fn(),
            challengeId: "c_1",
            participant: sampleParticipant,
         })
      );

      expect(html).toContain("Issue Host Pardon / Excuse");
      expect(html).toContain("Alice Scholar");
      expect(html).toContain("@alice");
      expect(html).toContain("Solo Scholar");
      expect(html).toContain("PUNISHED");
      expect(html).toContain("Grant Pardon");
      expect(html).toContain("Relieve member from forfeit obligations");
      expect(html).toContain("Pardon / Excuse Rationale");
   });

   it("renders explainer notice regarding EXCUSED status and audit trail", () => {
      const html = renderToStaticMarkup(
         createElement(AdminPardonModal, {
            isOpen: true,
            onClose: vi.fn(),
            challengeId: "c_1",
            participant: sampleParticipant,
         })
      );

      expect(html).toContain("EXCUSED");
      expect(html).toContain("relieved of forfeit obligations");
      expect(html).toContain("audit log will preserve this action");
   });
});
