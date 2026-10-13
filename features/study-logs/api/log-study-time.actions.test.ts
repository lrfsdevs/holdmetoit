import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logStudyTimeAction } from "@/features/study-logs/api/log-study-time.actions";
import * as requireSessionModule from "@/features/auth/api/require-session";
import * as requireParticipantModule from "@/features/auth/api/require-participant";
import * as dailyStudyLogRepo from "@/features/study-logs/data/daily-study-log.repository";

import { revalidatePath } from "next/cache";
import { revalidateTag } from "next/cache";

vi.mock("next/cache", () => ({
   revalidatePath: vi.fn(),
   revalidateTag: vi.fn(),
}));

vi.mock("@/features/auth/api/require-session", () => ({
   AuthError: class AuthError extends Error {},
   requireSessionUser: vi.fn(),
}));

vi.mock("@/features/auth/api/require-participant", () => ({
   ParticipantAccessError: class ParticipantAccessError extends Error {
      readonly code = "NOT_ENROLLED";
   },
   requireOwnedParticipant: vi.fn(),
}));

vi.mock("@/features/study-logs/data/daily-study-log.repository", () => ({
   upsertDailyStudyLog: vi.fn(),
}));

describe("logStudyTimeAction", () => {
   beforeEach(() => {
      vi.clearAllMocks();
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-06T00:30:00.000Z"));
   });

   afterEach(() => {
      vi.useRealTimers();
   });

   it("saves valid study duration during ACTIVE challenges", async () => {
      vi.mocked(requireSessionModule.requireSessionUser).mockResolvedValue({
         id: "usr_1",
      } as never);

      vi.mocked(
         requireParticipantModule.requireOwnedParticipant
      ).mockResolvedValue({
         id: "part_1",
         challenge: {
            startAt: new Date("2026-10-05T18:00:00.000Z"),
            endAt: new Date("2026-10-12T18:00:00.000Z"),
         },
      } as never);

      const result = await logStudyTimeAction({
         challengeId: "chal_1",
         challengeDay: 1,
         hours: 4,
         minutes: 30,
         seconds: 0,
      });

      expect(result).toEqual({ ok: true });
      expect(dailyStudyLogRepo.upsertDailyStudyLog).toHaveBeenCalledWith(
         expect.objectContaining({
            participantId: "part_1",
            challengeId: "chal_1",
            logDate: "2026-10-05",
            durationSeconds: 16_200,
            actor: expect.objectContaining({ id: "usr_1" }),
         })
      );
      expect(revalidatePath).toHaveBeenCalledWith("/");
      expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
      expect(revalidatePath).toHaveBeenCalledWith("/challenge/chal_1");
      expect(revalidateTag).toHaveBeenCalledWith("challenge:chal_1:scoreboard");
      expect(revalidateTag).toHaveBeenCalledWith(
         "user:usr_1:challenge:chal_1:cockpit"
      );
   });

   it("accepts exactly 24:00:00 boundary", async () => {
      vi.mocked(requireSessionModule.requireSessionUser).mockResolvedValue({
         id: "usr_1",
      } as never);

      vi.mocked(
         requireParticipantModule.requireOwnedParticipant
      ).mockResolvedValue({
         id: "part_1",
         challenge: {
            startAt: new Date("2026-10-05T18:00:00.000Z"),
            endAt: new Date("2026-10-12T18:00:00.000Z"),
         },
      } as never);

      const result = await logStudyTimeAction({
         challengeId: "chal_1",
         challengeDay: 1,
         hours: 24,
         minutes: 0,
         seconds: 0,
      });

      expect(result).toEqual({ ok: true });
      expect(dailyStudyLogRepo.upsertDailyStudyLog).toHaveBeenCalledWith(
         expect.objectContaining({
            participantId: "part_1",
            challengeId: "chal_1",
            logDate: "2026-10-05",
            durationSeconds: 86_400,
            actor: expect.objectContaining({ id: "usr_1" }),
         })
      );
   });

   it("rejects durations exceeding 24 hours (e.g. 24:00:01)", async () => {
      vi.mocked(requireSessionModule.requireSessionUser).mockResolvedValue({
         id: "usr_1",
      } as never);

      vi.mocked(
         requireParticipantModule.requireOwnedParticipant
      ).mockResolvedValue({
         id: "part_1",
         challenge: {
            startAt: new Date("2026-10-05T18:00:00.000Z"),
            endAt: new Date("2026-10-12T18:00:00.000Z"),
         },
      } as never);

      const result = await logStudyTimeAction({
         challengeId: "chal_1",
         challengeDay: 1,
         hours: 24,
         minutes: 0,
         seconds: 1,
      });

      expect(result).toEqual({
         ok: false,
         code: "DAILY_LIMIT_EXCEEDED",
         message: "A single day cannot exceed 24:00:00 of study time.",
      });
      expect(dailyStudyLogRepo.upsertDailyStudyLog).not.toHaveBeenCalled();
   });

   it("rejects study logging when challenge is not ACTIVE", async () => {
      vi.mocked(requireSessionModule.requireSessionUser).mockResolvedValue({
         id: "usr_1",
      } as never);

      vi.mocked(
         requireParticipantModule.requireOwnedParticipant
      ).mockResolvedValue({
         id: "part_1",
         challenge: {
            startAt: new Date("2026-10-06T18:00:00.000Z"),
            endAt: new Date("2026-10-13T18:00:00.000Z"),
         },
      } as never);

      const result = await logStudyTimeAction({
         challengeId: "chal_1",
         challengeDay: 1,
         hours: 2,
         minutes: 0,
         seconds: 0,
      });

      expect(result).toEqual({
         ok: false,
         code: "CHALLENGE_NOT_ACTIVE",
         message: "Study logging is only available during active challenges.",
      });
      expect(dailyStudyLogRepo.upsertDailyStudyLog).not.toHaveBeenCalled();
   });

   it("rejects unauthenticated attempts with UNAUTHORIZED", async () => {
      vi.mocked(requireSessionModule.requireSessionUser).mockRejectedValue(
         new requireSessionModule.AuthError()
      );

      const result = await logStudyTimeAction({
         challengeId: "chal_1",
         challengeDay: 1,
         hours: 1,
         minutes: 0,
         seconds: 0,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
         expect(result.code).toBe("UNAUTHORIZED");
      }
   });

   it("rejects non-enrolled users with NOT_ENROLLED", async () => {
      vi.mocked(requireSessionModule.requireSessionUser).mockResolvedValue({
         id: "usr_1",
      } as never);

      vi.mocked(
         requireParticipantModule.requireOwnedParticipant
      ).mockRejectedValue(
         new requireParticipantModule.ParticipantAccessError()
      );

      const result = await logStudyTimeAction({
         challengeId: "chal_1",
         challengeDay: 1,
         hours: 1,
         minutes: 0,
         seconds: 0,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
         expect(result.code).toBe("NOT_ENROLLED");
      }
   });

   it("rejects future challenge day with FUTURE_DATE_NOT_ALLOWED", async () => {
      vi.mocked(requireSessionModule.requireSessionUser).mockResolvedValue({
         id: "usr_1",
      } as never);

      vi.mocked(
         requireParticipantModule.requireOwnedParticipant
      ).mockResolvedValue({
         id: "part_1",
         challenge: {
            startAt: new Date("2026-10-05T18:00:00.000Z"),
            endAt: new Date("2026-10-12T18:00:00.000Z"),
         },
      } as never);

      // Currently Day 1 (system time is 2026-10-06T00:30:00.000Z)
      const result = await logStudyTimeAction({
         challengeId: "chal_1",
         challengeDay: 2, // Future day
         hours: 2,
         minutes: 0,
         seconds: 0,
      });

      expect(result).toEqual({
         ok: false,
         code: "FUTURE_DATE_NOT_ALLOWED",
         message: "Cannot log study time for future dates.",
      });
      expect(dailyStudyLogRepo.upsertDailyStudyLog).not.toHaveBeenCalled();
   });

   it("allows logging yesterday when currently on Day 4", async () => {
      // Fast forward to Day 4
      vi.setSystemTime(new Date("2026-10-08T20:00:00.000Z"));

      vi.mocked(requireSessionModule.requireSessionUser).mockResolvedValue({
         id: "usr_1",
      } as never);

      vi.mocked(
         requireParticipantModule.requireOwnedParticipant
      ).mockResolvedValue({
         id: "part_1",
         challenge: {
            startAt: new Date("2026-10-05T18:00:00.000Z"),
            endAt: new Date("2026-10-12T18:00:00.000Z"),
         },
      } as never);

      // Logging Day 3 (yesterday)
      const result = await logStudyTimeAction({
         challengeId: "chal_1",
         challengeDay: 3,
         hours: 3,
         minutes: 15,
         seconds: 0,
      });

      expect(result).toEqual({ ok: true });
      expect(dailyStudyLogRepo.upsertDailyStudyLog).toHaveBeenCalledWith(
         expect.objectContaining({
            participantId: "part_1",
            challengeId: "chal_1",
            logDate: "2026-10-07",
            durationSeconds: 11_700,
            actor: expect.objectContaining({ id: "usr_1" }),
         })
      );
   });

   it("rejects logging days before yesterday with ONLY_TODAY_OR_YESTERDAY_ALLOWED", async () => {
      // Fast forward to Day 4
      vi.setSystemTime(new Date("2026-10-08T20:00:00.000Z"));

      vi.mocked(requireSessionModule.requireSessionUser).mockResolvedValue({
         id: "usr_1",
      } as never);

      vi.mocked(
         requireParticipantModule.requireOwnedParticipant
      ).mockResolvedValue({
         id: "part_1",
         challenge: {
            startAt: new Date("2026-10-05T18:00:00.000Z"),
            endAt: new Date("2026-10-12T18:00:00.000Z"),
         },
      } as never);

      // Logging Day 1 (3 days ago - not today or yesterday)
      const result = await logStudyTimeAction({
         challengeId: "chal_1",
         challengeDay: 1,
         hours: 2,
         minutes: 0,
         seconds: 0,
      });

      expect(result).toEqual({
         ok: false,
         code: "ONLY_TODAY_OR_YESTERDAY_ALLOWED",
         message:
            "Participants can only log study time for today or yesterday. Contact a moderator to adjust earlier days.",
      });
      expect(dailyStudyLogRepo.upsertDailyStudyLog).not.toHaveBeenCalled();
   });

   it("rejects future date string with FUTURE_DATE_NOT_ALLOWED", async () => {
      vi.mocked(requireSessionModule.requireSessionUser).mockResolvedValue({
         id: "usr_1",
      } as never);

      vi.mocked(
         requireParticipantModule.requireOwnedParticipant
      ).mockResolvedValue({
         id: "part_1",
         challenge: {
            startAt: new Date("2026-10-05T18:00:00.000Z"),
            endAt: new Date("2026-10-12T18:00:00.000Z"),
         },
      } as never);

      const result = await logStudyTimeAction({
         challengeId: "chal_1",
         date: "2026-10-10",
         hours: 2,
         minutes: 0,
         seconds: 0,
      });

      expect(result).toEqual({
         ok: false,
         code: "FUTURE_DATE_NOT_ALLOWED",
         message: "Cannot log study time for future dates.",
      });
      expect(dailyStudyLogRepo.upsertDailyStudyLog).not.toHaveBeenCalled();
   });

   it("handles MaximumLeavesExceededError with MAX_LEAVES_REACHED and exact message", async () => {
      vi.mocked(requireSessionModule.requireSessionUser).mockResolvedValue({
         id: "usr_1",
      } as never);

      vi.mocked(
         requireParticipantModule.requireOwnedParticipant
      ).mockResolvedValue({
         id: "part_1",
         challenge: {
            startAt: new Date("2026-10-05T18:00:00.000Z"),
            endAt: new Date("2026-10-12T18:00:00.000Z"),
         },
      } as never);

      vi.mocked(dailyStudyLogRepo.upsertDailyStudyLog).mockRejectedValue(
         new Error("Maximum leaves taken for the challenge")
      );

      const result = await logStudyTimeAction({
         challengeId: "chal_1",
         challengeDay: 1,
         hours: 0,
         minutes: 0,
         seconds: 0,
         isLeave: true,
      });

      expect(result).toEqual({
         ok: false,
         code: "MAX_LEAVES_REACHED",
         message: "Maximum leaves taken for the challenge",
      });
   });
});
