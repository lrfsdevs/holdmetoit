import { describe, it, expect, vi, beforeEach } from "vitest";
import {
   getYptConnectionStatusAction,
   syncYptStudyNowAction,
} from "./ypt-connection.actions";
import { requireSessionUser } from "@/features/auth/api/require-session";
import { getUserYptConnection } from "../data/ypt-connection.repository";
import { syncUserYptStudy } from "./ypt-sync.service";
import { YptConnectionStatus } from "@prisma/client";

vi.mock("@/features/auth/api/require-session", () => ({
   requireSessionUser: vi.fn(),
}));

vi.mock("../data/ypt-connection.repository", () => ({
   getUserYptConnection: vi.fn(),
}));

vi.mock("./ypt-sync.service", () => ({
   syncUserYptStudy: vi.fn(),
}));

vi.mock("next/cache", () => ({
   revalidatePath: vi.fn(),
}));

describe("features/ypt/api/ypt-connection.actions", () => {
   beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(requireSessionUser).mockResolvedValue({
         id: "user-1",
         email: "user@example.com",
         role: "PARTICIPANT",
      } as any);
   });

   it("retrieves connection status for the session user", async () => {
      vi.mocked(getUserYptConnection).mockResolvedValue({
         userId: "user-1",
         yptUserId: "11338944",
         yptNickname: "Afnan",
         status: YptConnectionStatus.VERIFIED,
         lastSyncedAt: new Date(),
         lastSyncError: null,
      });

      const res = await getYptConnectionStatusAction();

      expect(res.ok).toBe(true);
      expect(res.data?.status).toBe(YptConnectionStatus.VERIFIED);
      expect(getUserYptConnection).toHaveBeenCalledWith("user-1");
   });

   it("returns an error envelope when status lookup throws", async () => {
      vi.mocked(getUserYptConnection).mockRejectedValue(
         new Error("db unavailable")
      );

      const res = await getYptConnectionStatusAction();

      expect(res.ok).toBe(false);
      expect(res.data).toBeNull();
      expect(res.message).toContain("db unavailable");
   });

   it("triggers manual sync for a verified user", async () => {
      vi.mocked(syncUserYptStudy).mockResolvedValue({
         ok: true,
         message: "Synced",
         importedDurationSeconds: 3600,
         coinsCredited: 100,
         isDuplicate: false,
         lastSyncedAt: new Date(),
      });

      const res = await syncYptStudyNowAction();

      expect(res.ok).toBe(true);
      expect(res.coinsCredited).toBe(100);
      expect(syncUserYptStudy).toHaveBeenCalledWith("user-1");
   });

   it("returns an error envelope when sync fails", async () => {
      vi.mocked(syncUserYptStudy).mockRejectedValue(new Error("boom"));

      const res = await syncYptStudyNowAction();

      expect(res.ok).toBe(false);
      expect(res.code).toBe("SYNC_ERROR");
      expect(res.importedDurationSeconds).toBe(0);
   });
});
