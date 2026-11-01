// @vitest-environment jsdom
import {
   cleanup,
   fireEvent,
   render,
   screen,
   waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { SickReminderBanner } from "./sick-reminder-banner";
import * as actions from "../api/sick-mode.actions";

vi.mock("../api/sick-mode.actions", () => ({
   respondSickReminderAction: vi.fn(),
}));

afterEach(cleanup);

describe("features/participant-status/presentation/sick-reminder-banner", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   it("renders nothing if user is not sick", () => {
      const { container } = render(
         <SickReminderBanner isSick={false} activatedAt={null} />
      );
      expect(container.firstChild).toBeNull();
   });

   it("renders nothing if activated less than 72 hours ago", () => {
      const oneDayAgo = new Date(Date.now() - 24 * 3600 * 1000);
      const { container } = render(
         <SickReminderBanner isSick={true} activatedAt={oneDayAgo} />
      );
      expect(container.firstChild).toBeNull();
   });

   it("renders reminder banner when 72 hours have elapsed", () => {
      const threeDaysAgo = new Date(Date.now() - 73 * 3600 * 1000);
      render(<SickReminderBanner isSick={true} activatedAt={threeDaysAgo} />);

      expect(screen.getByTestId("sick-reminder-banner")).toBeDefined();
      expect(
         screen.getByText("Checking In: How are you feeling?")
      ).toBeDefined();
      expect(screen.getByText("I'm Better (Turn Off)")).toBeDefined();
      expect(screen.getByText("Still Recovering (+2 Days)")).toBeDefined();
   });

   it("calls respondSickReminderAction with turn_off when clicking Turn Off", async () => {
      const threeDaysAgo = new Date(Date.now() - 73 * 3600 * 1000);
      const onStatusChange = vi.fn();
      vi.mocked(actions.respondSickReminderAction).mockResolvedValue({
         ok: true,
         status: {
            isSick: false,
            activatedAt: null,
            note: null,
            lastDeactivatedAt: new Date(),
         },
      });

      render(
         <SickReminderBanner
            isSick={true}
            activatedAt={threeDaysAgo}
            onStatusChange={onStatusChange}
         />
      );

      const turnOffBtn = screen.getByText("I'm Better (Turn Off)");
      fireEvent.click(turnOffBtn);

      await waitFor(() => {
         expect(actions.respondSickReminderAction).toHaveBeenCalledWith({
            action: "turn_off",
         });
      });
   });

   it("calls respondSickReminderAction with extend when clicking Still Recovering", async () => {
      const threeDaysAgo = new Date(Date.now() - 73 * 3600 * 1000);
      vi.mocked(actions.respondSickReminderAction).mockResolvedValue({
         ok: true,
         status: {
            isSick: true,
            activatedAt: threeDaysAgo,
            note: "Flu",
            reminderSnoozedUntil: new Date(),
            lastDeactivatedAt: null,
         },
      });

      render(<SickReminderBanner isSick={true} activatedAt={threeDaysAgo} />);

      const extendBtn = screen.getByText("Still Recovering (+2 Days)");
      fireEvent.click(extendBtn);

      await waitFor(() => {
         expect(actions.respondSickReminderAction).toHaveBeenCalledWith({
            action: "extend",
         });
      });
   });
});
