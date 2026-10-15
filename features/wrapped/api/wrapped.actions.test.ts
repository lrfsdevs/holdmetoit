import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/core/db";
import {
   markWrappedSeenAction,
   markWrappedSeenIfExpiredAction,
   submitChallengeFeedbackAction,
} from "./wrapped.actions";
import * as sessionModule from "@/features/auth/api/require-session";
import * as participantModule from "@/features/auth/api/require-participant";
import * as feedbackServiceModule from "@/features/wrapped/data/challenge-feedback.service";
import * as wrappedFlagModule from "@/features/wrapped/api/wrapped-flag";

vi.mock("next/cache", () => ({
   revalidatePath: vi.fn(),
   revalidateTag: vi.fn(),
}));

vi.mock("@/core/db", () => {
   const mockPrisma = {
      $transaction: vi.fn(async (cb: any) => cb(mockPrisma)),
      challenge: {
         findUnique: vi.fn(),
      },
      challengeParticipant: {
         update: vi.fn(),
      },
      challengeFeedback: {
         upsert: vi.fn(),
         update: vi.fn(),
      },
   };
   return { prisma: mockPrisma };
});

vi.mock("@/features/auth/api/require-session", () => ({
   AuthError: class AuthError extends Error {},
   requireSessionUser: vi.fn(),
}));

vi.mock("@/features/auth/api/require-participant", () => ({
   ParticipantAccessError: class ParticipantAccessError extends Error {
      code = "NOT_ENROLLED";
   },
   requireOwnedParticipant: vi.fn(),
}));

vi.mock("@/features/wrapped/data/challenge-feedback.service", () => ({
   sendChallengeFeedbackToDiscord: vi.fn(),
}));

vi.mock("@/features/wrapped/api/wrapped-flag", () => ({
   WRAPPED_FEATURE_FLAG_KEY: "challenge_wrapped_v1",
   isWrappedFeatureEnabled: vi.fn(),
}));

const DAY_MS = 86_400_000;
const PARTICIPANT = {
   id: "part_1",
   isWrappedSeen: false,
   isFeedbackFilled: false,
   challenge: {
      id: "chal_1",
      title: "October Sprint",
   },
};

describe("wrapped.actions", () => {
   beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(wrappedFlagModule.isWrappedFeatureEnabled).mockResolvedValue(
         true
      );
      vi.mocked(sessionModule.requireSessionUser).mockResolvedValue({
         id: "user_1",
         name: "Afnan",
         displayName: "Afnan P",
         discordId: "123456789",
      } as never);
      vi.mocked(participantModule.requireOwnedParticipant).mockResolvedValue(
         PARTICIPANT as never
      );
      vi.mocked(prisma.challengeParticipant.update).mockResolvedValue(
         {} as never
      );
      vi.mocked(prisma.challengeFeedback.upsert).mockResolvedValue({
         id: "cf_1",
      } as never);
      vi.mocked(prisma.challengeFeedback.update).mockResolvedValue({
         id: "cf_1",
      } as never);
      vi.mocked(
         feedbackServiceModule.sendChallengeFeedbackToDiscord
      ).mockResolvedValue({
         success: true,
         channelId: "1558594247895289877",
         messageId: "msg_999",
      });
   });

   describe("markWrappedSeenAction", () => {
      it("flips isWrappedSeen for the owned participant", async () => {
         const result = await markWrappedSeenAction("chal_1");

         expect(result).toEqual({ ok: true });
         expect(prisma.challengeParticipant.update).toHaveBeenCalledWith({
            where: { id: "part_1" },
            data: { isWrappedSeen: true },
         });
      });

      it("is idempotent when the wrapped was already seen", async () => {
         vi.mocked(participantModule.requireOwnedParticipant).mockResolvedValue(
            {
               ...PARTICIPANT,
               isWrappedSeen: true,
            } as never
         );

         const result = await markWrappedSeenAction("chal_1");

         expect(result).toEqual({ ok: true });
         expect(prisma.challengeParticipant.update).not.toHaveBeenCalled();
      });

      it("maps AuthError to UNAUTHORIZED", async () => {
         vi.mocked(sessionModule.requireSessionUser).mockRejectedValue(
            new sessionModule.AuthError()
         );

         const result = await markWrappedSeenAction("chal_1");

         expect(result.ok).toBe(false);
         if (!result.ok) {
            expect(result.code).toBe("UNAUTHORIZED");
         }
      });

      it("maps enrollment failures to NOT_ENROLLED", async () => {
         vi.mocked(participantModule.requireOwnedParticipant).mockRejectedValue(
            new participantModule.ParticipantAccessError() as never
         );

         const result = await markWrappedSeenAction("chal_1");

         expect(result.ok).toBe(false);
         if (!result.ok) {
            expect(result.code).toBe("NOT_ENROLLED");
         }
      });
   });

   describe("markWrappedSeenIfExpiredAction", () => {
      it("does nothing while the 3-day window is still open", async () => {
         vi.mocked(prisma.challenge.findUnique).mockResolvedValue({
            resultsLockedAt: new Date(Date.now() - 1 * DAY_MS),
         } as never);

         const result = await markWrappedSeenIfExpiredAction("chal_1");

         expect(result).toEqual({ ok: true });
         expect(prisma.challengeParticipant.update).not.toHaveBeenCalled();
      });

      it("auto-marks seen once the window has expired", async () => {
         vi.mocked(prisma.challenge.findUnique).mockResolvedValue({
            resultsLockedAt: new Date(Date.now() - 4 * DAY_MS),
         } as never);

         const result = await markWrappedSeenIfExpiredAction("chal_1");

         expect(result).toEqual({ ok: true });
         expect(prisma.challengeParticipant.update).toHaveBeenCalledWith({
            where: { id: "part_1" },
            data: { isWrappedSeen: true },
         });
      });

      it("never forces the flag when the challenge is not locked", async () => {
         vi.mocked(prisma.challenge.findUnique).mockResolvedValue({
            resultsLockedAt: null,
         } as never);

         const result = await markWrappedSeenIfExpiredAction("chal_1");

         expect(result).toEqual({ ok: true });
         expect(prisma.challengeParticipant.update).not.toHaveBeenCalled();
      });
   });

   const validFeedbackInput = {
      challengeId: "chal_1",
      consistency: "Yes, significantly" as const,
      fairnessRating: 5,
      trackingPreference: "Strictly YPT" as const,
      teamBattleFeedback: "Loved the competition!",
      workSchoolHours: "No, dont include them" as const,
      soloStyle: "Competitive (Keep a leaderboard)" as const,
      soloPunishment: "Yes, keep the punishment" as const,
      soloIdeas: "More challenges please",
   };

   describe("challenge_wrapped_v1 kill switch", () => {
      it("no-ops seen-marking without touching auth or the database when disabled", async () => {
         vi.mocked(wrappedFlagModule.isWrappedFeatureEnabled).mockResolvedValue(
            false
         );

         const result = await markWrappedSeenAction("chal_1");

         expect(result).toEqual({ ok: true });
         expect(sessionModule.requireSessionUser).not.toHaveBeenCalled();
         expect(
            participantModule.requireOwnedParticipant
         ).not.toHaveBeenCalled();
         expect(prisma.challengeParticipant.update).not.toHaveBeenCalled();
      });

      it("rejects feedback submission when disabled", async () => {
         vi.mocked(wrappedFlagModule.isWrappedFeatureEnabled).mockResolvedValue(
            false
         );

         const result = await submitChallengeFeedbackAction(validFeedbackInput);

         expect(result.ok).toBe(false);
         if (!result.ok) {
            expect(result.code).toBe("FEATURE_DISABLED");
         }
         expect(prisma.challengeFeedback.upsert).not.toHaveBeenCalled();
         expect(
            feedbackServiceModule.sendChallengeFeedbackToDiscord
         ).not.toHaveBeenCalled();
      });

      it("no-ops the expired auto-seen check when disabled", async () => {
         vi.mocked(wrappedFlagModule.isWrappedFeatureEnabled).mockResolvedValue(
            false
         );

         const result = await markWrappedSeenIfExpiredAction("chal_1");

         expect(result).toEqual({ ok: true });
         expect(prisma.challenge.findUnique).not.toHaveBeenCalled();
         expect(prisma.challengeParticipant.update).not.toHaveBeenCalled();
      });
   });

   describe("submitChallengeFeedbackAction", () => {
      it("validates input and rejects invalid ratings", async () => {
         const result = await submitChallengeFeedbackAction({
            ...validFeedbackInput,
            fairnessRating: 6,
         });

         expect(result.ok).toBe(false);
         if (!result.ok) {
            expect(result.code).toBe("INVALID_INPUT");
            expect(result.message).toContain(
               "Fairness rating must be between 1 and 5"
            );
         }
         expect(prisma.challengeParticipant.update).not.toHaveBeenCalled();
      });

      it("submits valid feedback, updates isFeedbackFilled, and dispatches to Discord", async () => {
         const result = await submitChallengeFeedbackAction(validFeedbackInput);

         expect(result).toEqual({
            ok: true,
            isFeedbackFilled: true,
            discordDelivered: true,
            feedbackId: "cf_1",
         });

         expect(prisma.challengeParticipant.update).toHaveBeenCalledWith({
            where: { id: "part_1" },
            data: { isFeedbackFilled: true },
         });

         expect(prisma.challengeFeedback.upsert).toHaveBeenCalledWith({
            where: {
               challengeId_userId: {
                  challengeId: "chal_1",
                  userId: "user_1",
               },
            },
            create: expect.objectContaining({
               challengeId: "chal_1",
               userId: "user_1",
               fairnessRating: 5,
               consistency: "Yes, significantly",
            }),
            update: expect.objectContaining({
               fairnessRating: 5,
               consistency: "Yes, significantly",
            }),
         });

         expect(
            feedbackServiceModule.sendChallengeFeedbackToDiscord
         ).toHaveBeenCalledWith(
            expect.objectContaining({
               title: "💬 Challenge Feedback · October Sprint",
               color: 0x22c55e,
               fields: expect.arrayContaining([
                  expect.objectContaining({
                     name: "⚖️ Fairness Rating",
                     value: "⭐⭐⭐⭐⭐ (5/5)",
                  }),
                  expect.objectContaining({
                     name: "👤 Submitter",
                     value: "<@123456789>",
                  }),
               ]),
            })
         );
      });

      it("is idempotent when isFeedbackFilled is already true", async () => {
         vi.mocked(participantModule.requireOwnedParticipant).mockResolvedValue(
            {
               ...PARTICIPANT,
               isFeedbackFilled: true,
            } as never
         );

         const result = await submitChallengeFeedbackAction(validFeedbackInput);

         expect(result.ok).toBe(true);
         expect(prisma.challengeParticipant.update).not.toHaveBeenCalled();
         expect(prisma.challengeFeedback.upsert).toHaveBeenCalled();
         expect(
            feedbackServiceModule.sendChallengeFeedbackToDiscord
         ).toHaveBeenCalled();
      });

      it("succeeds for user even if Discord API dispatch fails (fail-soft)", async () => {
         vi.mocked(
            feedbackServiceModule.sendChallengeFeedbackToDiscord
         ).mockResolvedValue({
            success: false,
            channelId: "1558594247895289877",
            error: "Discord rate limit",
         });

         const result = await submitChallengeFeedbackAction(validFeedbackInput);

         expect(result).toEqual({
            ok: true,
            isFeedbackFilled: true,
            discordDelivered: false,
            feedbackId: "cf_1",
         });

         expect(prisma.challengeParticipant.update).toHaveBeenCalledWith({
            where: { id: "part_1" },
            data: { isFeedbackFilled: true },
         });
         expect(prisma.challengeFeedback.upsert).toHaveBeenCalled();
      });

      it("maps AuthError to UNAUTHORIZED", async () => {
         vi.mocked(sessionModule.requireSessionUser).mockRejectedValue(
            new sessionModule.AuthError()
         );

         const result = await submitChallengeFeedbackAction(validFeedbackInput);

         expect(result.ok).toBe(false);
         if (!result.ok) {
            expect(result.code).toBe("UNAUTHORIZED");
         }
      });

      it("maps non-enrolled user to NOT_ENROLLED", async () => {
         vi.mocked(participantModule.requireOwnedParticipant).mockRejectedValue(
            new participantModule.ParticipantAccessError() as never
         );

         const result = await submitChallengeFeedbackAction(validFeedbackInput);

         expect(result.ok).toBe(false);
         if (!result.ok) {
            expect(result.code).toBe("NOT_ENROLLED");
         }
      });
   });
});
