import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { YptSettingsCard } from "./ypt-settings-card";
import { getYptConnectionStatusAction } from "../api/ypt-connection.actions";
import { YptConnectionStatus } from "@prisma/client";

vi.mock("../api/ypt-connection.actions", () => ({
   getYptConnectionStatusAction: vi.fn(),
   syncYptStudyNowAction: vi.fn(),
}));

vi.mock("../api/ypt-claim.actions", () => ({
   getYptRosterAction: vi.fn().mockResolvedValue({ ok: true, data: [] }),
   submitYptSelectionAction: vi.fn(),
}));

describe("features/ypt/presentation/ypt-settings-card", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   it("renders the roster selector when not linked", () => {
      vi.mocked(getYptConnectionStatusAction).mockResolvedValue({
         ok: true,
         data: {
            userId: "user-1",
            yptUserId: "",
            yptNickname: null,
            status: YptConnectionStatus.NOT_CONNECTED,
            lastSyncedAt: null,
            lastSyncError: null,
         },
      });

      const html = renderToStaticMarkup(<YptSettingsCard />);

      expect(html).toContain("Yeolpumta (YPT) Study Integration");
      expect(html).toContain("Find your Yeolpumta account");
      expect(html).toContain("Request Verification");
      expect(html).toContain("Not linked");
      // No credential collection anywhere.
      expect(html).not.toContain("ypt-password");
      expect(html).not.toContain("Yeolpumta Password");
   });

   it("renders the verified state with the refresh action", () => {
      const html = renderToStaticMarkup(
         <YptSettingsCard initialYptId="11338944" />
      );

      expect(html).toContain("Verified Participant");
      expect(html).toContain("11338944");
      expect(html).toContain("Refresh my hours");
      expect(html).not.toContain("Find your Yeolpumta account");
   });
});
