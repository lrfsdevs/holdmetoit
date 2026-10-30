import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const discord = vi.hoisted(() => ({
   sendChannelMessage: vi.fn(),
}));

vi.mock("@holdmetoit/discord", () => ({
   MISSING_TOKEN_ERROR: "DISCORD_BOT_TOKEN is not configured in environment.",
   sendChannelMessage: discord.sendChannelMessage,
}));

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
      process.env = { ...originalEnv };
      discord.sendChannelMessage.mockReset();
   });

   afterEach(() => {
      process.env = originalEnv;
   });

   describe("resolveChallengeFeedbackChannelId", () => {
      it("defaults to the configured fallback channel", () => {
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
         expect(discord.sendChannelMessage).not.toHaveBeenCalled();
      });

      it("delegates dispatch to the shared Discord client", async () => {
         process.env.DISCORD_BOT_TOKEN = "test_bot_token";
         process.env.DISCORD_CHALLENGE_FEEDBACK_CHANNEL_ID =
            "1558594247895289877";
         discord.sendChannelMessage.mockResolvedValue({
            success: true,
            messageId: "discord_msg_123",
            channelId: "1558594247895289877",
         });

         const result = await sendChallengeFeedbackToDiscord(DUMMY_EMBED);

         expect(result.success).toBe(true);
         expect(result.messageId).toBe("discord_msg_123");
         expect(result.channelId).toBe("1558594247895289877");
         expect(discord.sendChannelMessage).toHaveBeenCalledWith({
            channelId: "1558594247895289877",
            embeds: [DUMMY_EMBED],
         });
      });

      it("passes through Discord API HTTP errors", async () => {
         process.env.DISCORD_BOT_TOKEN = "test_bot_token";
         discord.sendChannelMessage.mockResolvedValue({
            success: false,
            channelId: "1558594247895289877",
            error: "Discord API error (403): Missing Permissions",
         });

         const result = await sendChallengeFeedbackToDiscord(DUMMY_EMBED);

         expect(result.success).toBe(false);
         expect(result.error).toContain("403");
         expect(result.error).toContain("Missing Permissions");
      });

      it("passes through network exceptions safely", async () => {
         process.env.DISCORD_BOT_TOKEN = "test_bot_token";
         discord.sendChannelMessage.mockResolvedValue({
            success: false,
            channelId: "1558594247895289877",
            error: "Network exception dispatching to Discord: Connection timeout",
         });

         const result = await sendChallengeFeedbackToDiscord(DUMMY_EMBED);

         expect(result.success).toBe(false);
         expect(result.error).toContain("Connection timeout");
      });
   });
});
