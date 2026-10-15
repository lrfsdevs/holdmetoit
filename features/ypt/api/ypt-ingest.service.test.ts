import { beforeEach, describe, expect, it, vi } from "vitest";
import { ingestYptActivity } from "./ypt-ingest.service";
import * as yptRepo from "../data/ypt.repository";
import * as studyLogRepo from "@/features/study-logs/data/daily-study-log.repository";
import * as studyRewardService from "@/features/economy/api/study-reward.service";

vi.mock("../data/ypt.repository", () => ({
   findUserByYptOrDiscordId: vi.fn(),
   findActiveParticipantForUserOnDate: vi.fn(),
   findExistingLogByExternalId: vi.fn(),
}));

vi.mock("@/features/study-logs/data/daily-study-log.repository", () => ({
   upsertDailyStudyLog: vi.fn(),
}));

vi.mock("@/features/economy/api/study-reward.service", () => ({
   processStudyReward: vi.fn(),
}));

vi.mock("@/core/cache", () => ({
   cacheTags: {
      challengeScoreboard: vi.fn(() => "mock-tag"),
      participantCockpit: vi.fn(() => "mock-cockpit"),
   },
   invalidateTags: vi.fn(),
}));

vi.mock("next/cache", () => ({
   revalidatePath: vi.fn(),
}));

describe("ingestYptActivity", () => {
   const mockUser = {
      id: "usr_100",
      discordId: "disc_100",
      username: "alex",
      displayName: "Alex G",
      avatar: "avatar.png",
      yptId: "alex_ypt",
   };

   const mockParticipant = {
      id: "part_100",
      userId: "usr_100",
      challengeId: "chal_100",
      challenge: {
         id: "chal_100",
         title: "Fall Sprint",
         isDeleted: false,
         resultsLockedAt: null,
      },
   };

   beforeEach(() => {
      vi.clearAllMocks();
   });

   it("returns USER_NOT_FOUND if neither discordId nor yptId matches an account", async () => {
      vi.mocked(yptRepo.findUserByYptOrDiscordId).mockResolvedValue(null);

      const result = await ingestYptActivity({
         discordId: "unknown_id",
         date: "2026-10-14",
         durationSeconds: 3600,
      });

      expect(result.ok).toBe(false);
      expect(result.code).toBe("USER_NOT_FOUND");
   });

   it("rejects future date entries", async () => {
      vi.mocked(yptRepo.findUserByYptOrDiscordId).mockResolvedValue(
         mockUser as any
      );

      const result = await ingestYptActivity({
         discordId: "disc_100",
         date: "2099-01-01",
         durationSeconds: 3600,
      });

      expect(result.ok).toBe(false);
      expect(result.code).toBe("FUTURE_DATE_NOT_ALLOWED");
   });

   it("returns NOT_ENROLLED_IN_ACTIVE_CHALLENGE if no active challenge covers the date", async () => {
      vi.mocked(yptRepo.findUserByYptOrDiscordId).mockResolvedValue(
         mockUser as any
      );
      vi.mocked(yptRepo.findActiveParticipantForUserOnDate).mockResolvedValue(
         null as any
      );

      const result = await ingestYptActivity({
         discordId: "disc_100",
         date: "2026-10-14",
         durationSeconds: 3600,
      });

      expect(result.ok).toBe(false);
      expect(result.code).toBe("NOT_ENROLLED_IN_ACTIVE_CHALLENGE");
   });

   it("detects duplicate activity when externalActivityId already processed with equal or greater duration", async () => {
      vi.mocked(yptRepo.findUserByYptOrDiscordId).mockResolvedValue(
         mockUser as any
      );
      vi.mocked(yptRepo.findActiveParticipantForUserOnDate).mockResolvedValue(
         mockParticipant as any
      );
      vi.mocked(yptRepo.findExistingLogByExternalId).mockResolvedValue({
         id: "log_existing",
         durationSeconds: 3600,
      } as any);

      const result = await ingestYptActivity({
         discordId: "disc_100",
         date: "2026-10-14",
         durationSeconds: 3600,
         externalActivityId: "ext_abc123",
      });

      expect(result.ok).toBe(true);
      expect(result.isDuplicate).toBe(true);
      expect(result.coinsCredited).toBe(0);
      expect(studyLogRepo.upsertDailyStudyLog).not.toHaveBeenCalled();
   });

   it("successfully upserts study log and credits study reward", async () => {
      vi.mocked(yptRepo.findUserByYptOrDiscordId).mockResolvedValue(
         mockUser as any
      );
      vi.mocked(yptRepo.findActiveParticipantForUserOnDate).mockResolvedValue(
         mockParticipant as any
      );
      vi.mocked(yptRepo.findExistingLogByExternalId).mockResolvedValue(null);
      vi.mocked(studyLogRepo.upsertDailyStudyLog).mockResolvedValue({
         id: "log_new_456",
         durationSeconds: 3600,
      } as any);
      vi.mocked(studyRewardService.processStudyReward).mockResolvedValue({
         ok: true,
         coinsCredited: 100,
         fractionalSecondsRemaining: 0,
         isDuplicate: false,
         eligibleSeconds: 3600,
      });

      const result = await ingestYptActivity({
         discordId: "disc_100",
         date: "2026-10-14",
         durationSeconds: 3600,
         externalActivityId: "act_fresh",
         yptSubject: "English Literature",
      });

      expect(result.ok).toBe(true);
      expect(result.userId).toBe("usr_100");
      expect(result.participantId).toBe("part_100");
      expect(result.studyLogId).toBe("log_new_456");
      expect(result.coinsCredited).toBe(100);
      expect(result.isDuplicate).toBe(false);
      expect(studyLogRepo.upsertDailyStudyLog).toHaveBeenCalledWith(
         expect.objectContaining({
            participantId: "part_100",
            challengeId: "chal_100",
            durationSeconds: 3600,
            source: "YPT_BOT",
            externalActivityId: "act_fresh",
            yptSubject: "English Literature",
         })
      );
   });
});
