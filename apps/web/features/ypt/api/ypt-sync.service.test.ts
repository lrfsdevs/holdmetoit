import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncUserYptStudy } from "./ypt-sync.service";
import { prisma } from "@/core/db";
import { YptConnectionStatus } from "@prisma/client";
import { findYptServiceMember } from "../data/ypt-service-account";
import { ingestYptActivity } from "./ypt-ingest.service";

vi.mock("@/core/db", () => ({
   prisma: {
      user: {
         findUnique: vi.fn(),
      },
      yptConnection: {
         upsert: vi.fn(),
         updateMany: vi.fn(),
      },
      yptSyncRun: {
         create: vi.fn(),
      },
   },
}));

vi.mock("../data/ypt-service-account", () => ({
   findYptServiceMember: vi.fn(),
}));

vi.mock("./ypt-ingest.service", () => ({
   ingestYptActivity: vi.fn(),
}));

const rosterMember = {
   yptUserId: "11338944",
   nickname: "Afnan Pathan",
   avatarUrl: null,
   todayStudySeconds: 7200,
   isStudying: false,
   currentSubject: "Chemistry",
   studyDate: "2026-10-16",
   groupIds: ["111"],
};

describe("features/ypt/api/ypt-sync.service", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   it("rejects sync when the user has no verified yptId", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
         id: "user-1",
         yptId: null,
         yptConnection: null,
      } as any);

      const result = await syncUserYptStudy("user-1");

      expect(result.ok).toBe(false);
      expect(result.code).toBe("YPT_NOT_VERIFIED");
      expect(findYptServiceMember).not.toHaveBeenCalled();
      expect(ingestYptActivity).not.toHaveBeenCalled();
   });

   it("returns MEMBER_NOT_FOUND when the roster has no matching member", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
         id: "user-1",
         yptId: "11338944",
         yptConnection: {
            id: "conn-1",
            lastSyncedAt: null,
         },
      } as any);
      vi.mocked(findYptServiceMember).mockResolvedValue(null);

      const result = await syncUserYptStudy("user-1");

      expect(result.ok).toBe(false);
      expect(result.code).toBe("MEMBER_NOT_FOUND");
      expect(prisma.yptConnection.updateMany).toHaveBeenCalledWith(
         expect.objectContaining({
            data: expect.objectContaining({
               status: YptConnectionStatus.SYNC_ERROR,
            }),
         })
      );
   });

   it("synchronizes study time from the service account and credits coins", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
         id: "user-1",
         yptId: "11338944",
         yptConnection: {
            id: "conn-1",
            lastSyncedAt: null,
         },
      } as any);
      vi.mocked(findYptServiceMember).mockResolvedValue(rosterMember as any);
      vi.mocked(ingestYptActivity).mockResolvedValue({
         ok: true,
         userId: "user-1",
         participantId: "part-1",
         studyLogId: "log-1",
         durationSeconds: 7200,
         coinsCredited: 200,
         isDuplicate: false,
      });

      const result = await syncUserYptStudy("user-1");

      expect(result.ok).toBe(true);
      expect(result.importedDurationSeconds).toBe(7200);
      expect(result.coinsCredited).toBe(200);
      expect(findYptServiceMember).toHaveBeenCalledWith("11338944");
      expect(ingestYptActivity).toHaveBeenCalledWith(
         expect.objectContaining({
            yptId: "11338944",
            date: "2026-10-16",
            durationSeconds: 7200,
         }),
         "YPT_MANUAL"
      );
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

   it("marks SYNC_ERROR when the roster cannot be fetched", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
         id: "user-1",
         yptId: "11338944",
         yptConnection: {
            id: "conn-1",
            lastSyncedAt: null,
         },
      } as any);
      vi.mocked(findYptServiceMember).mockRejectedValue(
         new Error("YPT unreachable")
      );

      const result = await syncUserYptStudy("user-1");

      expect(result.ok).toBe(false);
      expect(result.code).toBe("RETRIEVAL_FAILED");
      expect(prisma.yptConnection.updateMany).toHaveBeenCalledWith(
         expect.objectContaining({
            data: expect.objectContaining({
               status: YptConnectionStatus.SYNC_ERROR,
            }),
         })
      );
   });
});
