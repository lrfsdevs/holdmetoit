// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactElement } from "react";
import { cleanup, render } from "@testing-library/react";
import { AdminHoursOverrideModal } from "./admin-hours-override-modal";

afterEach(cleanup);

function renderToHtml(el: ReactElement): string {
   const { container } = render(el);
   return document.body.innerHTML.replace(container.outerHTML, "");
}

vi.mock("next/navigation", () => ({
   useRouter: () => ({
      refresh: vi.fn(),
   }),
}));

vi.mock("@/features/study-logs/api/admin-override.actions", () => ({
   adminOverrideStudyHoursAction: vi.fn(),
}));

describe("AdminHoursOverrideModal", () => {
   const sampleParticipant = {
      participantId: "p_1",
      displayName: "Alice Scholar",
      username: "alice",
      teamName: "Honey Bees",
      teamColor: "#FFB066",
      dailyLogs: {
         "2026-10-01": 7200, // Day 1: 2h
         "2026-10-02": 14400, // Day 2: 4h
      },
   };

   it("returns null when isOpen is false", () => {
      const html = renderToHtml(
         createElement(AdminHoursOverrideModal, {
            isOpen: false,
            onClose: vi.fn(),
            challengeId: "chal-1",
            challengeStartDate: "2026-10-01",
            participant: sampleParticipant,
         })
      );

      expect(html).toBe("");
   });

   it("renders participant details, all 7 challenge week days, and audit notice", () => {
      const html = renderToHtml(
         createElement(AdminHoursOverrideModal, {
            isOpen: true,
            onClose: vi.fn(),
            challengeId: "chal-1",
            challengeStartDate: "2026-10-01",
            totalChallengeDays: 7,
            participant: sampleParticipant,
            initialDayNumber: 1,
         })
      );

      expect(html).toContain("Alice Scholar");
      expect(html).toContain("@alice");
      expect(html).toContain("Honey Bees");
      expect(html).toContain("Correct Participant Study Session");
      expect(html).not.toContain("Law L5 Audit");
      expect(html).toContain("Clear Time");
      expect(html).not.toContain("Presets:");
      expect(html).toContain("Mandatory Technical Correction Reason");
      // All 7 days should be present in the day grid
      expect(html).toContain("D1");
      expect(html).toContain("D2");
      expect(html).toContain("D3");
      expect(html).toContain("D4");
      expect(html).toContain("D5");
      expect(html).toContain("D6");
      expect(html).toContain("D7");
   });

   it("pre-populates inputs for initialDayNumber when existing logs are present", () => {
      // Day 1 has 7200 seconds = 2h 0m 0s
      const html = renderToHtml(
         createElement(AdminHoursOverrideModal, {
            isOpen: true,
            onClose: vi.fn(),
            challengeId: "chal-1",
            challengeStartDate: "2026-10-01",
            totalChallengeDays: 7,
            participant: sampleParticipant,
            initialDayNumber: 1,
         })
      );

      expect(html).toContain('value="2"'); // 2 hours
      expect(html).toContain('value="0"'); // 0 minutes
      expect(html).toContain("Currently Logged on Day 1:");
      expect(html).toContain("02:00:00");
   });

   it("pre-populates Day 2 hours when initialDayNumber is 2", () => {
      // Day 2 has 14400 seconds = 4h 0m 0s
      const html = renderToHtml(
         createElement(AdminHoursOverrideModal, {
            isOpen: true,
            onClose: vi.fn(),
            challengeId: "chal-1",
            challengeStartDate: "2026-10-01",
            totalChallengeDays: 7,
            participant: sampleParticipant,
            initialDayNumber: 2,
         })
      );

      expect(html).toContain('value="4"'); // 4 hours
      expect(html).toContain("Currently Logged on Day 2:");
      expect(html).toContain("04:00:00");
   });

   it("enables all 7 day buttons for mods/devs without disabled attribute on past days", () => {
      const html = renderToHtml(
         createElement(AdminHoursOverrideModal, {
            isOpen: true,
            onClose: vi.fn(),
            challengeId: "chal-1",
            challengeStartDate: "2026-10-01",
            totalChallengeDays: 7,
            participant: sampleParticipant,
            initialDayNumber: 1,
         })
      );

      const dayButtonsHtml = html.slice(html.indexOf("Select Challenge Day"));
      expect(dayButtonsHtml).not.toMatch(
         /<button[^>]*disabled[^>]*>[^<]*<span[^>]*>[^<]*<\/span><span[^>]*>D1<\/span>/
      );
   });

   it("disables future day buttons in the 7-day selector with disabled attribute and Locked status", () => {
      const html = renderToHtml(
         createElement(AdminHoursOverrideModal, {
            isOpen: true,
            onClose: vi.fn(),
            challengeId: "chal-1",
            challengeStartDate: new Date().toISOString().slice(0, 10),
            totalChallengeDays: 7,
            participant: sampleParticipant,
            initialDayNumber: 1,
         })
      );

      expect(html).toContain("D1");
      expect(html).toContain("D2");
      expect(html).toContain("Locked");
      expect(html).toContain("cursor-not-allowed");
      expect(html).toContain("Future date (cannot log or edit yet)");
   });

   it("disables input fields and displays warning banner when all challenge days are in the future", () => {
      const futureDate = "2099-01-01";
      const html = renderToHtml(
         createElement(AdminHoursOverrideModal, {
            isOpen: true,
            onClose: vi.fn(),
            challengeId: "chal-1",
            challengeStartDate: futureDate,
            totalChallengeDays: 7,
            participant: sampleParticipant,
            initialDayNumber: 1,
         })
      );

      expect(html).toContain(
         "Future date (2099-01-01): moderators cannot add or edit study hours for future dates."
      );
      expect(html).toContain("Save Correction");
   });

   it("does NOT render arbitrary overall reset controls", () => {
      const html = renderToHtml(
         createElement(AdminHoursOverrideModal, {
            isOpen: true,
            onClose: vi.fn(),
            challengeId: "chal-1",
            challengeStartDate: "2026-10-01",
            totalChallengeDays: 7,
            participant: sampleParticipant,
            initialDayNumber: 1,
         })
      );

      expect(html).not.toContain("Overall Time (Reset to 0)");
      expect(html).not.toContain("Reset Overall Time to 0");
   });

   it("shows warning and disables inputs when no study session exists for selected day", () => {
      // Participant with no logs on Day 3 (2026-10-03)
      const html = renderToHtml(
         createElement(AdminHoursOverrideModal, {
            isOpen: true,
            onClose: vi.fn(),
            challengeId: "chal-1",
            challengeStartDate: "2026-10-01",
            totalChallengeDays: 7,
            participant: sampleParticipant,
            initialDayNumber: 3,
         })
      );

      expect(html).toContain(
         "No study session recorded on Day 3 (2026-10-03). In accordance with system policy, arbitrary additions are prohibited; technical corrections require an existing session record."
      );
      // Submit button is disabled
      const submitBtnMatch = html.match(
         /<button[^>]*type="submit"[^>]*>([\s\S]*?)<\/button>/
      );
      expect(submitBtnMatch).not.toBeNull();
      expect(submitBtnMatch?.[0]).toContain("disabled");
   });
   it("renders 14-hour daily cap notice in admin override modal when hours exceed 14", () => {
      const html = renderToHtml(
         createElement(AdminHoursOverrideModal, {
            isOpen: true,
            onClose: vi.fn(),
            challengeId: "chal-1",
            challengeStartDate: "2026-10-01",
            totalChallengeDays: 7,
            participant: {
               ...sampleParticipant,
               dailyLogs: {
                  "2026-10-01": 16 * 3600, // 16h
               },
            },
            initialDayNumber: 1,
         })
      );

      expect(html).toContain("14-Hour Scoring Cap Enforced");
      expect(html).toContain(
         "challenge scoring and deficit calculations will strictly count a maximum of 14:00:00"
      );
   });
});
