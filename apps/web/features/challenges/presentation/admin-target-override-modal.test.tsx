import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
   AdminTargetOverrideModal,
   type AdminTargetOverrideParticipant,
} from "./admin-target-override-modal";

vi.mock("next/navigation", () => ({
   useRouter: () => ({
      refresh: vi.fn(),
   }),
}));

vi.mock("@/features/challenges/api/challenge-admin.actions", () => ({
   adminUpdateParticipantTargetAction: vi.fn(),
}));

describe("AdminTargetOverrideModal (Law L5 / FEAT-DECL-04)", () => {
   const sampleParticipant: AdminTargetOverrideParticipant = {
      participantId: "p_1",
      displayName: "Alice Scholar",
      username: "alice",
      teamName: "Honey Bees",
      teamColor: "#FFB066",
      targetSeconds: 126000, // 35:00:00
      targetClock: "35:00:00",
   };

   it("returns null when isOpen is false", () => {
      const html = renderToStaticMarkup(
         createElement(AdminTargetOverrideModal, {
            isOpen: false,
            onClose: vi.fn(),
            challengeId: "chal-1",
            participant: sampleParticipant,
         })
      );

      expect(html).toBe("");
   });

   it("returns null when participant is null", () => {
      const html = renderToStaticMarkup(
         createElement(AdminTargetOverrideModal, {
            isOpen: true,
            onClose: vi.fn(),
            challengeId: "chal-1",
            participant: null,
         })
      );

      expect(html).toBe("");
   });

   it("renders participant details, current target, and dialog title when open", () => {
      const html = renderToStaticMarkup(
         createElement(AdminTargetOverrideModal, {
            isOpen: true,
            onClose: vi.fn(),
            challengeId: "chal-1",
            participant: sampleParticipant,
         })
      );

      expect(html).toContain("Edit Weekly Target Hours");
      expect(html).toContain("Alice Scholar");
      expect(html).toContain("@alice");
      expect(html).toContain("Honey Bees");
      expect(html).toContain("35:00:00");
      expect(html).toContain("Current Target");
      expect(html).toContain("Save Target Hours");
   });

   it("renders quick presets and audit notice", () => {
      const html = renderToStaticMarkup(
         createElement(AdminTargetOverrideModal, {
            isOpen: true,
            onClose: vi.fn(),
            challengeId: "chal-1",
            participant: sampleParticipant,
         })
      );

      expect(html).toContain("15h");
      expect(html).toContain("20h");
      expect(html).toContain("25h");
      expect(html).toContain("30h");
      expect(html).toContain("35h");
      expect(html).toContain("40h");
      expect(html).toContain("50h");
      expect(html).toContain("60h");
      expect(html).toContain("Recorded in the immutable event audit trail");
      expect(html).toContain("catch-up deficit pace");
   });

   it("renders decomposed initial target hours (35h) in input", () => {
      const html = renderToStaticMarkup(
         createElement(AdminTargetOverrideModal, {
            isOpen: true,
            onClose: vi.fn(),
            challengeId: "chal-1",
            participant: sampleParticipant,
         })
      );

      expect(html).toContain('value="35"');
   });

   it("renders cleanly without throwing when current target is greater than 35h (negative delta)", () => {
      // Regression test for negative duration crash when participant target > input
      const highTargetParticipant: AdminTargetOverrideParticipant = {
         ...sampleParticipant,
         targetSeconds: 180000, // 50 hours
         targetClock: "50:00:00",
      };

      const html = renderToStaticMarkup(
         createElement(AdminTargetOverrideModal, {
            isOpen: true,
            onClose: vi.fn(),
            challengeId: "chal-1",
            participant: highTargetParticipant,
         })
      );

      expect(html).toContain("50:00:00");
      expect(html).toContain('value="50"');
   });

   it("renders fallback user icon when participant avatar is empty string or null", () => {
      const noImageParticipant: AdminTargetOverrideParticipant = {
         ...sampleParticipant,
         image: "",
      };

      const html = renderToStaticMarkup(
         createElement(AdminTargetOverrideModal, {
            isOpen: true,
            onClose: vi.fn(),
            challengeId: "chal-1",
            participant: noImageParticipant,
         })
      );

      expect(html).not.toContain("<img");
   });
});
