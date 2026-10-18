import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
   buildDiscordFeedbackEmbed,
   resolveDiscordFeedbackChannelId,
   sendFeedbackToDiscord,
} from "./discord-feedback.service";

describe("buildDiscordFeedbackEmbed", () => {
   it("builds bug report embed with red accent and LogRocket link", () => {
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
      expect(embed.author.name).toBe("🐛 NEW BUG REPORT • FB-42");
      expect(embed.title).toBe("Submit button unresponsive");
      expect(embed.description).toBe("Clicking submit on mobile does nothing.");
      expect(embed.footer.text).toBe("HoldMeToIt Feedback Engine • ID: FB-42");
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

   it("builds enhancement embed with purple accent and guest reporter", () => {
      const embed = buildDiscordFeedbackEmbed({
         feedbackNumber: 15,
         type: "enhancement",
         title: "Add dark violet theme",
         description: "Allow selecting a custom theme color.",
         url: "/settings",
         reporter: null,
      });

      expect(embed.color).toBe(0x8b5cf6);
      expect(embed.author.name).toBe("✨ NEW ENHANCEMENT • FB-15");
      expect(embed.fields.some((f) => f.name === "🎥 LogRocket Session")).toBe(
         false
      );
      expect(embed.fields.find((f) => f.name === "👤 Reported by")?.value).toBe(
         "Guest / Anonymous"
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

   it("prioritizes specific bug channel for bug type", () => {
      process.env.DISCORD_FEEDBACK_BUG_CHANNEL_ID = "bug-123";
      process.env.DISCORD_FEEDBACK_SUGGESTIONS_CHANNEL_ID = "sug-456";

      expect(resolveDiscordFeedbackChannelId("bug")).toBe("bug-123");
      expect(resolveDiscordFeedbackChannelId("enhancement")).toBe("sug-456");
   });

   it("falls back to general feedback channel if specific channel is missing", () => {
      process.env.DISCORD_FEEDBACK_CHANNEL_ID = "general-789";

      expect(resolveDiscordFeedbackChannelId("bug")).toBe("general-789");
      expect(resolveDiscordFeedbackChannelId("enhancement")).toBe(
         "general-789"
      );
   });

   it("falls back to DEFAULT_FEEDBACK_CHANNEL_ID if no environment variables are set", () => {
      expect(resolveDiscordFeedbackChannelId("bug")).toBe(
         "1556790638593319063"
      );
      expect(resolveDiscordFeedbackChannelId("enhancement")).toBe(
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
   });

   afterEach(() => {
      process.env = origEnv;
      vi.restoreAllMocks();
   });

   it("returns error if bot token is missing", async () => {
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
   });

   it("sends message successfully via fetch", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
         ok: true,
         json: async () => ({ id: "msg-12345" }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await sendFeedbackToDiscord({
         feedbackNumber: 1,
         type: "bug",
         title: "Test Bug",
         description: "Test description text",
         url: "/dashboard",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("msg-12345");
      expect(result.channelId).toBe("chan-999");
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
         "https://discord.com/api/v10/channels/chan-999/messages",
         expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
               Authorization: "Bot test-token",
            }),
         })
      );
   });

   it("handles Discord API failure without throwing", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
         ok: false,
         status: 403,
         text: async () => "Missing Permissions",
      });
      vi.stubGlobal("fetch", mockFetch);

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
