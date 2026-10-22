import { beforeEach, describe, expect, it, vi } from "vitest";
import { processStudyReward } from "./study-reward.service";
import { prisma } from "@/core/db";
import { isFeatureEnabled } from "@/features/feature-flags/api/server";
import * as rewardRepo from "../data/study-reward.repository";

vi.mock("@/features/feature-flags/api/server", () => ({
   isFeatureEnabled: vi.fn(),
}));

vi.mock("@/core/db", () => ({
   prisma: {
      dailyStudyLog: {
         findUnique: vi.fn(),
      },
   },
}));

vi.mock("../data/study-reward.repository", () => ({
   recordStudyRewardTransaction: vi.fn(),
}));

describe("study-reward.service", () => {
   beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(isFeatureEnabled).mockResolvedValue(true);
   });

   it("skips reward processing when the wallet flag is off", async () => {
      vi.mocked(isFeatureEnabled).mockResolvedValue(false);

      const result = await processStudyReward({
         studyLogId: "log_123",
         userId: "usr_123",
      });

      expect(result.ok).toBe(true);
      expect(result.coinsCredited).toBe(0);
      expect(rewardRepo.recordStudyRewardTransaction).not.toHaveBeenCalled();
      expect(prisma.dailyStudyLog.findUnique).not.toHaveBeenCalled();
   });

   it("1. successfully processes an eligible study log and awards coins", async () => {
      vi.mocked(prisma.dailyStudyLog.findUnique).mockResolvedValue({
         id: "log_123",
         durationSeconds: 3600,
         isLeave: false,
         logDate: new Date("2026-10-15T00:00:00Z"),
         participant: {
            id: "part_123",
            userId: "usr_123",
            challenge: {
               id: "chal_123",
               isDeleted: false,
            },
         },
      } as any);

      vi.mocked(rewardRepo.recordStudyRewardTransaction).mockResolvedValue({
         rewardRecord: { id: "rec_1" },
         coinsCredited: 100,
         fractionalSecondsRemaining: 0,
         isDuplicate: false,
      });

      const result = await processStudyReward({
         studyLogId: "log_123",
         userId: "usr_123",
      });

      expect(result.ok).toBe(true);
      expect(result.coinsCredited).toBe(100);
      expect(result.isDuplicate).toBe(false);
      expect(rewardRepo.recordStudyRewardTransaction).toHaveBeenCalledWith(
         expect.objectContaining({
            userId: "usr_123",
            studySessionId: "log_123",
            eligibleSeconds: 3600,
            idempotencyKey: "study-log:log_123",
         })
      );
   });

   it("2. returns duplicate status idempotently when study session is already rewarded", async () => {
      vi.mocked(prisma.dailyStudyLog.findUnique).mockResolvedValue({
         id: "log_123",
         durationSeconds: 3600,
         isLeave: false,
         logDate: new Date("2026-10-15T00:00:00Z"),
         participant: {
            id: "part_123",
            userId: "usr_123",
            challenge: {
               id: "chal_123",
               isDeleted: false,
            },
         },
      } as any);

      vi.mocked(rewardRepo.recordStudyRewardTransaction).mockResolvedValue({
         rewardRecord: { id: "rec_1" },
         coinsCredited: 100,
         fractionalSecondsRemaining: 0,
         isDuplicate: true, // Already rewarded!
      });

      const result = await processStudyReward({
         studyLogId: "log_123",
         userId: "usr_123",
      });

      expect(result.ok).toBe(true);
      expect(result.isDuplicate).toBe(true);
      expect(result.coinsCredited).toBe(100);
   });

   it("3. rejects processing if study log does not exist", async () => {
      vi.mocked(prisma.dailyStudyLog.findUnique).mockResolvedValue(null);

      const result = await processStudyReward({
         studyLogId: "non_existent",
      });

      expect(result.ok).toBe(false);
      expect(result.message).toContain("not found");
      expect(rewardRepo.recordStudyRewardTransaction).not.toHaveBeenCalled();
   });

   it("4. rejects processing if user does not own the study log", async () => {
      vi.mocked(prisma.dailyStudyLog.findUnique).mockResolvedValue({
         id: "log_123",
         durationSeconds: 3600,
         isLeave: false,
         participant: {
            userId: "owner_usr",
            challenge: { id: "chal_1", isDeleted: false },
         },
      } as any);

      const result = await processStudyReward({
         studyLogId: "log_123",
         userId: "attacker_usr", // Mismatch!
      });

      expect(result.ok).toBe(false);
      expect(result.message).toContain("Unauthorized");
      expect(rewardRepo.recordStudyRewardTransaction).not.toHaveBeenCalled();
   });

   it("5. skips reward processing for soft-deleted challenges", async () => {
      vi.mocked(prisma.dailyStudyLog.findUnique).mockResolvedValue({
         id: "log_123",
         durationSeconds: 3600,
         isLeave: false,
         participant: {
            userId: "usr_123",
            challenge: { id: "chal_1", isDeleted: true }, // Deleted!
         },
      } as any);

      const result = await processStudyReward({
         studyLogId: "log_123",
         userId: "usr_123",
      });

      expect(result.ok).toBe(false);
      expect(result.message).toContain("deleted");
      expect(rewardRepo.recordStudyRewardTransaction).not.toHaveBeenCalled();
   });

   it("6. awards 0 coins for leave days without failing", async () => {
      vi.mocked(prisma.dailyStudyLog.findUnique).mockResolvedValue({
         id: "log_123",
         durationSeconds: 3600,
         isLeave: true, // Leave day!
         participant: {
            userId: "usr_123",
            challenge: { id: "chal_1", isDeleted: false },
         },
      } as any);

      const result = await processStudyReward({
         studyLogId: "log_123",
         userId: "usr_123",
      });

      expect(result.ok).toBe(true);
      expect(result.coinsCredited).toBe(0);
      expect(rewardRepo.recordStudyRewardTransaction).not.toHaveBeenCalled();
   });

   it("7. awards 0 coins for 0 duration logs without failing", async () => {
      vi.mocked(prisma.dailyStudyLog.findUnique).mockResolvedValue({
         id: "log_123",
         durationSeconds: 0,
         isLeave: false,
         participant: {
            userId: "usr_123",
            challenge: { id: "chal_1", isDeleted: false },
         },
      } as any);

      const result = await processStudyReward({
         studyLogId: "log_123",
         userId: "usr_123",
      });

      expect(result.ok).toBe(true);
      expect(result.coinsCredited).toBe(0);
      expect(rewardRepo.recordStudyRewardTransaction).not.toHaveBeenCalled();
   });
});
