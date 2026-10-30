import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const discord = vi.hoisted(() => ({
   sendChannelMessage: vi.fn(),
}));

vi.mock("@holdmetoit/discord", () => ({
   MISSING_TOKEN_ERROR: "DISCORD_BOT_TOKEN is not configured in environment.",
   sendChannelMessage: discord.sendChannelMessage,
}));

import {
   buildDiscordFeedbackEmbed,
   resolveDiscordFeedbackChannelId,
   sendFeedbackToDiscord,
} from "./discord-feedback.service";

describe("buildDiscordFeedbackEmbed", () => {
   it("builds a bug report embed with red accent and LogRocket link", () => {
      const embed = buildDiscordFeedbackEmbed({
         feedbackNumber: 42,
         type: "bug",
         title: "Submit button unresponsive",
         description: "Clicking submit on mobile does nothing.",
         url: "/challenge/demo",
         logrocketSessionId: "https://app.logrocket.com/r/demo123",
         reporter: {
            username: "afnan",
            displayName: "Afnan",
            discordId: "123456789",
         },
         createdAt: new Date("2026-10-06T02:00:00.000Z"),
      });

      expect(embed.color).toBe(0xef4444);
      expect(embed.author?.name).toBe("🐛 NEW BUG REPORT • FB-42");
      expect(embed.title).toBe("Submit button unresponsive");
      expect(embed.description).toBe("Clicking submit on mobile does nothing.");
      expect(embed.footer?.text).toBe("HoldMeToIt Feedback Engine • ID: FB-42");
      expect(embed.fields).toEqual(
         expect.arrayContaining([
            { name: "📍 Page", value: "/challenge/demo", inline: true },
            { name: "👤 Reported by", value: "<@123456789>", inline: true },
            { name: "⚡ Status", value: "OPEN", inline: true },
            {
               name: "🎥 LogRocket Session",
               value: "[View Session Replay & Logs](https://app.logrocket.com/r/demo123)",
               inline: false,
            },
         ])
      );
   });

   it("builds an enhancement embed with purple accent and guest reporter", () => {
      const embed = buildDiscordFeedbackEmbed({
         feedbackNumber: 15,
         type: "enhancement",
         title: "Add dark violet theme",
         description: "Allow selecting a custom theme color.",
         url: "/settings",
         reporter: null,
      });

      expect(embed.color).toBe(0x8b5cf6);
      expect(embed.author?.name).toBe("✨ NEW ENHANCEMENT • FB-15");
      expect(
         (embed.fields ?? []).some((f) => f.name === "🎥 LogRocket Session")
      ).toBe(false);
      expect(
         (embed.fields ?? []).find((f) => f.name === "👤 Reported by")?.value
      ).toBe("Guest / Anonymous");
   });

   it("embeds the first image and links every attachment", () => {
      const embed = buildDiscordFeedbackEmbed({
         feedbackNumber: 7,
         type: "bug",
         title: "Visual glitch",
         description: "The banner overlaps the score.",
         url: "/challenge/demo",
         attachments: [
            {
               url: "https://cdn.example.com/attachments/one.png",
               kind: "image",
            },
            {
               url: "https://cdn.example.com/attachments/clip.mp4",
               kind: "video",
            },
            {
               url: "https://cdn.example.com/attachments/two.png",
               kind: "image",
            },
         ],
      });

      expect(embed.image).toEqual({
         url: "https://cdn.example.com/attachments/one.png",
      });
      expect(
         (embed.fields ?? []).find((f) => f.name === "📎 Attachments (3)")
      ).toEqual({
         name: "📎 Attachments (3)",
         value: [
            "• [Image 1](https://cdn.example.com/attachments/one.png)",
            "• [Video 2](https://cdn.example.com/attachments/clip.mp4)",
            "• [Image 3](https://cdn.example.com/attachments/two.png)",
         ].join("\n"),
         inline: false,
      });
   });

   it("omits attachment fields when there are none", () => {
      const embed = buildDiscordFeedbackEmbed({
         feedbackNumber: 7,
         type: "bug",
         title: "Text only",
         description: "No media attached to this report.",
         url: "/",
      });

      expect(embed.image).toBeUndefined();
      expect((embed.fields ?? []).some((f) => f.name.startsWith("📎"))).toBe(
         false
      );
   });
});

describe("resolveDiscordFeedbackChannelId", () => {
   const origEnv = process.env;

   beforeEach(() => {
      process.env = { ...origEnv };
      delete process.env.DISCORD_FEEDBACK_BUG_CHANNEL_ID;
      delete process.env.DISCORD_FEEDBACK_SUGGESTIONS_CHANNEL_ID;
      delete process.env.DISCORD_FEEDBACK_CHANNEL_ID;
   });

   afterEach(() => {
      process.env = origEnv;
   });

   it("prioritizes the specific channel for each feedback type", () => {
      process.env.DISCORD_FEEDBACK_BUG_CHANNEL_ID = "bug-123";
      process.env.DISCORD_FEEDBACK_SUGGESTIONS_CHANNEL_ID = "sug-456";

      expect(resolveDiscordFeedbackChannelId("bug")).toBe("bug-123");
      expect(resolveDiscordFeedbackChannelId("enhancement")).toBe("sug-456");
   });

   it("falls back to the general feedback channel", () => {
      process.env.DISCORD_FEEDBACK_CHANNEL_ID = "general-789";

      expect(resolveDiscordFeedbackChannelId("bug")).toBe("general-789");
      expect(resolveDiscordFeedbackChannelId("enhancement")).toBe(
         "general-789"
      );
   });

   it("falls back to the default channel id", () => {
      expect(resolveDiscordFeedbackChannelId("bug")).toBe(
         "1556790638593319063"
      );
   });
});

describe("sendFeedbackToDiscord", () => {
   const origEnv = process.env;

   beforeEach(() => {
      process.env = { ...origEnv };
      process.env.DISCORD_BOT_TOKEN = "test-token";
      process.env.DISCORD_FEEDBACK_BUG_CHANNEL_ID = "chan-999";
      discord.sendChannelMessage.mockReset();
   });

   afterEach(() => {
      process.env = origEnv;
   });

   it("returns an error when the bot token is missing", async () => {
      delete process.env.DISCORD_BOT_TOKEN;

      const result = await sendFeedbackToDiscord({
         feedbackNumber: 1,
         type: "bug",
         title: "Test",
         description: "Test description",
         url: "/",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("DISCORD_BOT_TOKEN");
      expect(discord.sendChannelMessage).not.toHaveBeenCalled();
   });

   it("delegates dispatch to the shared Discord client", async () => {
      discord.sendChannelMessage.mockResolvedValue({
         success: true,
         messageId: "msg-12345",
         channelId: "chan-999",
      });

      const result = await sendFeedbackToDiscord({
         feedbackNumber: 1,
         type: "bug",
         title: "Test Bug",
         description: "Test description text",
         url: "/dashboard",
      });

      expect(result).toEqual({
         success: true,
         messageId: "msg-12345",
         channelId: "chan-999",
      });
      expect(discord.sendChannelMessage).toHaveBeenCalledWith({
         channelId: "chan-999",
         embeds: [expect.objectContaining({ title: "Test Bug" })],
      });
   });

   it("passes through Discord API failures without throwing", async () => {
      discord.sendChannelMessage.mockResolvedValue({
         success: false,
         channelId: "chan-999",
         error: "Discord API error (403): Missing Permissions",
      });

      const result = await sendFeedbackToDiscord({
         feedbackNumber: 1,
         type: "bug",
         title: "Test Bug",
         description: "Test description text",
         url: "/dashboard",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Discord API error (403)");
   });
});
