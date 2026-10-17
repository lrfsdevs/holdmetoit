import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncUserYptStudy } from "./ypt-sync.service";
import { prisma } from "@/core/db";
import { YptConnectionStatus } from "@prisma/client";
import {
   restoreYptClientSession,
   getYptUserStudyStatus,
} from "../data/ypt-client.service";
import { ingestYptActivity } from "./ypt-ingest.service";

vi.mock("@/core/db", () => ({
   prisma: {
      user: {
         findUnique: vi.fn(),
      },
      yptConnection: {
         updateMany: vi.fn(),
      },
      yptSyncRun: {
         create: vi.fn(),
      },
   },
}));

vi.mock("@/core/security/encryption", () => ({
   decryptSensitiveToken: vi.fn((cipher: string) => "decrypted-refresh-token"),
}));

vi.mock("../data/ypt-client.service", () => ({
   restoreYptClientSession: vi.fn(),
   getYptUserStudyStatus: vi.fn(),
}));

vi.mock("./ypt-ingest.service", () => ({
   ingestYptActivity: vi.fn(),
}));

describe("features/ypt/api/ypt-sync.service", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   it("rejects sync if user has no connection or is not VERIFIED", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
         id: "user-1",
         yptConnection: {
            id: "conn-1",
            status: YptConnectionStatus.PENDING_VERIFICATION,
         },
      } as any);

      const result = await syncUserYptStudy("user-1");

      expect(result.ok).toBe(false);
      expect(result.code).toBe("YPT_NOT_VERIFIED");
      expect(ingestYptActivity).not.toHaveBeenCalled();
   });

   it("handles session expiration by requesting reauthentication", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
         id: "user-1",
         yptConnection: {
            id: "conn-1",
            yptUserId: "11338944",
            status: YptConnectionStatus.VERIFIED,
            encryptedRefreshToken: "encrypted-token",
         },
      } as any);

      vi.mocked(restoreYptClientSession).mockRejectedValue(
         new Error("Session expired")
      );

      const result = await syncUserYptStudy("user-1");

      expect(result.ok).toBe(false);
      expect(result.code).toBe("REAUTHENTICATION_REQUIRED");
      expect(prisma.yptConnection.updateMany).toHaveBeenCalledWith(
         expect.objectContaining({
            data: expect.objectContaining({
               status: YptConnectionStatus.REAUTHENTICATION_REQUIRED,
            }),
         })
      );
   });

   it("successfully synchronizes study statistics and credits coins", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
         id: "user-1",
         yptConnection: {
            id: "conn-1",
            yptUserId: "11338944",
            status: YptConnectionStatus.VERIFIED,
            encryptedRefreshToken: "encrypted-token",
         },
      } as any);

      vi.mocked(restoreYptClientSession).mockResolvedValue({} as any);
      vi.mocked(getYptUserStudyStatus).mockResolvedValue({
         yptUserId: 11338944,
         nickname: "Afnan Pathan",
         todayStudyMs: 7200000,
         liveStudyMs: 7200000,
         todayStudySeconds: 7200, // 2 hours
         liveStudySeconds: 7200,
         isStudying: false,
         isPaused: false,
         currentSubject: "Chemistry",
         studyDate: "2026-10-16",
      });

      vi.mocked(ingestYptActivity).mockResolvedValue({
         ok: true,
         userId: "user-1",
         participantId: "part-1",
         studyLogId: "log-1",
         durationSeconds: 7200,
         coinsCredited: 200, // 7200 / 36 = 200 coins
         isDuplicate: false,
      });

      const result = await syncUserYptStudy("user-1");

      expect(result.ok).toBe(true);
      expect(result.importedDurationSeconds).toBe(7200);
      expect(result.coinsCredited).toBe(200);
      expect(prisma.yptSyncRun.create).toHaveBeenCalledWith(
         expect.objectContaining({
            data: expect.objectContaining({
               status: "SUCCESS",
               coinsCredited: 200,
               importedDurationSeconds: 7200,
            }),
         })
      );
   });
});
