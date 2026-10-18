import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   saveChallengeFeedback,
   getChallengeFeedback,
   listChallengeFeedbacks,
   updateChallengeFeedbackDiscordMessageId,
} from "./challenge-feedback.repository";

vi.mock("@/core/db", () => ({
   prisma: {
      challengeFeedback: {
         upsert: vi.fn(),
         findUnique: vi.fn(),
         findMany: vi.fn(),
         update: vi.fn(),
      },
   },
}));

import { prisma } from "@/core/db";

describe("challenge-feedback.repository", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   const sampleFeedback = {
      challengeId: "chal_1",
      userId: "user_1",
      consistency: "Yes, significantly",
      fairnessRating: 5,
      trackingPreference: "Strictly YPT",
      teamBattleFeedback: "Great pacing!",
      workSchoolHours: "Yes, include work and school hours",
      soloStyle: "Competitive (Keep a leaderboard)",
      soloPunishment: "Yes, keep the punishment",
      soloIdeas: "Add weekly streaks",
      discordMessageId: "msg_123",
   };

   it("saveChallengeFeedback upserts feedback using composite unique key", async () => {
      const mockResult = { id: "fb_1", ...sampleFeedback };
      vi.mocked(prisma.challengeFeedback.upsert).mockResolvedValue(
         mockResult as any
      );

      const result = await saveChallengeFeedback(sampleFeedback);

      expect(prisma.challengeFeedback.upsert).toHaveBeenCalledWith({
         where: {
            challengeId_userId: {
               challengeId: "chal_1",
               userId: "user_1",
            },
         },
         create: {
            challengeId: "chal_1",
            userId: "user_1",
            consistency: "Yes, significantly",
            fairnessRating: 5,
            trackingPreference: "Strictly YPT",
            teamBattleFeedback: "Great pacing!",
            workSchoolHours: "Yes, include work and school hours",
            soloStyle: "Competitive (Keep a leaderboard)",
            soloPunishment: "Yes, keep the punishment",
            soloIdeas: "Add weekly streaks",
            discordMessageId: "msg_123",
         },
         update: {
            consistency: "Yes, significantly",
            fairnessRating: 5,
            trackingPreference: "Strictly YPT",
            teamBattleFeedback: "Great pacing!",
            workSchoolHours: "Yes, include work and school hours",
            soloStyle: "Competitive (Keep a leaderboard)",
            soloPunishment: "Yes, keep the punishment",
            soloIdeas: "Add weekly streaks",
            discordMessageId: "msg_123",
         },
      });
      expect(result).toEqual(mockResult);
   });

   it("getChallengeFeedback queries by challengeId_userId", async () => {
      const mockResult = { id: "fb_1", ...sampleFeedback };
      vi.mocked(prisma.challengeFeedback.findUnique).mockResolvedValue(
         mockResult as any
      );

      const result = await getChallengeFeedback("chal_1", "user_1");

      expect(prisma.challengeFeedback.findUnique).toHaveBeenCalledWith({
         where: {
            challengeId_userId: {
               challengeId: "chal_1",
               userId: "user_1",
            },
         },
      });
      expect(result).toEqual(mockResult);
   });

   it("listChallengeFeedbacks queries all feedbacks for challenge ordered by createdAt desc", async () => {
      const mockList = [{ id: "fb_1", ...sampleFeedback }];
      vi.mocked(prisma.challengeFeedback.findMany).mockResolvedValue(
         mockList as any
      );

      const result = await listChallengeFeedbacks("chal_1");

      expect(prisma.challengeFeedback.findMany).toHaveBeenCalledWith({
         where: { challengeId: "chal_1" },
         orderBy: { createdAt: "desc" },
      });
      expect(result).toEqual(mockList);
   });

   it("updateChallengeFeedbackDiscordMessageId updates discord_message_id", async () => {
      const mockResult = {
         id: "fb_1",
         ...sampleFeedback,
         discordMessageId: "msg_new",
      };
      vi.mocked(prisma.challengeFeedback.update).mockResolvedValue(
         mockResult as any
      );

      const result = await updateChallengeFeedbackDiscordMessageId(
         "fb_1",
         "msg_new"
      );

      expect(prisma.challengeFeedback.update).toHaveBeenCalledWith({
         where: { id: "fb_1" },
         data: { discordMessageId: "msg_new" },
      });
      expect(result).toEqual(mockResult);
   });
});
