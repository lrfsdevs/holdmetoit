import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { YptSettingsCard } from "./ypt-settings-card";
import { getYptConnectionStatusAction } from "../api/ypt-connection.actions";
import { YptConnectionStatus } from "@prisma/client";

vi.mock("../api/ypt-connection.actions", () => ({
   getYptConnectionStatusAction: vi.fn(),
   connectYptAccountAction: vi.fn(),
   getRealYptGroupMembersAction: vi
      .fn()
      .mockResolvedValue({ ok: true, data: [] }),
   submitYptSelectionAction: vi.fn(),
   syncYptStudyNowAction: vi.fn(),
   disconnectYptAccountAction: vi.fn(),
}));

describe("features/ypt/presentation/ypt-settings-card", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   it("renders 'Connect Yeolpumta Account' and card title when not connected", () => {
      vi.mocked(getYptConnectionStatusAction).mockResolvedValue({
         ok: true,
         data: {
            userId: "user-1",
            yptUserId: "",
            yptNickname: null,
            status: YptConnectionStatus.NOT_CONNECTED,
            hasSavedSession: false,
            lastSyncedAt: null,
            lastSyncError: null,
         },
      });

      const element = <YptSettingsCard />;
      const html = renderToStaticMarkup(element);

      expect(html).toContain("Yeolpumta (YPT) Study Integration");
      expect(html).toContain("Connect Yeolpumta Account");
      expect(html).toContain("Connect YPT");
      expect(html).toContain("Not connected");
   });

   it("renders session inactive notice when verified but hasSavedSession is false (CASE 3)", () => {
      const element = <YptSettingsCard initialYptId="11338944" />;
      const html = renderToStaticMarkup(element);

      expect(html).toContain("Verified Participant");
      expect(html).toContain("11338944");
      expect(html).toContain("Verified • Session Inactive");
      expect(html).toContain(
         "Identity verified, but Yeolpumta session is not connected"
      );
      expect(html).toContain("Connect YPT Session");
      expect(html).not.toContain("Study synchronization is active.");
   });
});
