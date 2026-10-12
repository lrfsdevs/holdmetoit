import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
   DEFAULT_CHALLENGE_FEEDBACK_CHANNEL_ID,
   resolveChallengeFeedbackChannelId,
   sendChallengeFeedbackToDiscord,
} from "./challenge-feedback.service";
import type { DiscordEmbed } from "@/features/wrapped/domain/challenge-feedback-embed";

const DUMMY_EMBED: DiscordEmbed = {
   title: "Test Embed",
   color: 0x22c55e,
   author: { name: "TEST" },
   fields: [],
   footer: { text: "Test Footer" },
};

describe("challenge-feedback.service", () => {
   const originalEnv = process.env;

   beforeEach(() => {
      vi.resetModules();
      process.env = { ...originalEnv };
      vi.restoreAllMocks();
   });

   afterEach(() => {
      process.env = originalEnv;
   });

   describe("resolveChallengeFeedbackChannelId", () => {
      it("defaults to 1558594247895289877 when env var is not set", () => {
         delete process.env.DISCORD_CHALLENGE_FEEDBACK_CHANNEL_ID;
         expect(resolveChallengeFeedbackChannelId()).toBe(
            DEFAULT_CHALLENGE_FEEDBACK_CHANNEL_ID
         );
      });

      it("uses DISCORD_CHALLENGE_FEEDBACK_CHANNEL_ID when set", () => {
         process.env.DISCORD_CHALLENGE_FEEDBACK_CHANNEL_ID =
            "custom_channel_999";
         expect(resolveChallengeFeedbackChannelId()).toBe("custom_channel_999");
      });
   });

   describe("sendChallengeFeedbackToDiscord", () => {
      it("returns failure when DISCORD_BOT_TOKEN is not configured", async () => {
         delete process.env.DISCORD_BOT_TOKEN;
         const result = await sendChallengeFeedbackToDiscord(DUMMY_EMBED);
         expect(result.success).toBe(false);
         expect(result.error).toContain("DISCORD_BOT_TOKEN");
      });

      it("posts to Discord API v10 and returns messageId on success", async () => {
         process.env.DISCORD_BOT_TOKEN = "test_bot_token";
         process.env.DISCORD_CHALLENGE_FEEDBACK_CHANNEL_ID =
            "1558594247895289877";

         global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ id: "discord_msg_123" }),
         } as Response);

         const result = await sendChallengeFeedbackToDiscord(DUMMY_EMBED);

         expect(result.success).toBe(true);
         expect(result.messageId).toBe("discord_msg_123");
         expect(result.channelId).toBe("1558594247895289877");
         expect(global.fetch).toHaveBeenCalledWith(
            "https://discord.com/api/v10/channels/1558594247895289877/messages",
            expect.objectContaining({
               method: "POST",
               headers: {
                  Authorization: "Bot test_bot_token",
                  "Content-Type": "application/json",
               },
               body: JSON.stringify({
                  embeds: [DUMMY_EMBED],
               }),
            })
         );
      });

      it("handles Discord API HTTP errors gracefully", async () => {
         process.env.DISCORD_BOT_TOKEN = "test_bot_token";

         global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 403,
            text: async () => "Missing Permissions",
         } as Response);

         const result = await sendChallengeFeedbackToDiscord(DUMMY_EMBED);

         expect(result.success).toBe(false);
         expect(result.error).toContain("403");
         expect(result.error).toContain("Missing Permissions");
      });

      it("handles network fetch exceptions safely", async () => {
         process.env.DISCORD_BOT_TOKEN = "test_bot_token";

         global.fetch = vi
            .fn()
            .mockRejectedValue(new Error("Connection timeout"));

         const result = await sendChallengeFeedbackToDiscord(DUMMY_EMBED);

         expect(result.success).toBe(false);
         expect(result.error).toContain("Connection timeout");
      });
   });
});
