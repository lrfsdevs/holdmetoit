import { formatFeedbackCode } from "@/features/feedback/domain/feedback-code";
import type { FeedbackType } from "@/features/feedback/domain/feedback.types";

export interface DiscordFeedbackPayloadInput {
   feedbackNumber: number;
   type: FeedbackType;
   title: string;
   description: string;
   url: string;
   logrocketSessionId?: string | null;
   reporter?: {
      username?: string | null;
      displayName?: string | null;
      discordId?: string | null;
   } | null;
   createdAt?: Date;
}

export interface DiscordEmbedField {
   name: string;
   value: string;
   inline?: boolean;
}

export interface DiscordEmbed {
   title: string;
   description: string;
   color: number;
   author: {
      name: string;
   };
   fields: DiscordEmbedField[];
   footer: {
      text: string;
   };
   timestamp?: string;
}

export function buildDiscordFeedbackEmbed(
   input: DiscordFeedbackPayloadInput
): DiscordEmbed {
   const code = formatFeedbackCode(input.feedbackNumber);
   const isBug = input.type === "bug";

   // Red for bugs (0xEF4444), Purple for suggestions (0x8B5CF6)
   const color = isBug ? 0xef4444 : 0x8b5cf6;
   const authorName = isBug
      ? `🐛 NEW BUG REPORT • ${code}`
      : `✨ NEW ENHANCEMENT • ${code}`;

   let reporterText = "Guest / Anonymous";
   if (input.reporter) {
      if (input.reporter.discordId) {
         reporterText = `<@${input.reporter.discordId}>`;
      } else if (input.reporter.displayName) {
         reporterText = input.reporter.displayName;
      } else if (input.reporter.username) {
         reporterText = input.reporter.username;
      }
   }

   const fields: DiscordEmbedField[] = [
      {
         name: "📍 Page",
         value:
            input.url.length > 250
               ? `${input.url.slice(0, 247)}...`
               : input.url,
         inline: true,
      },
      {
         name: "👤 Reported by",
         value: reporterText,
         inline: true,
      },
      {
         name: "⚡ Status",
         value: "OPEN",
         inline: true,
      },
   ];

   if (isBug && input.logrocketSessionId) {
      fields.push({
         name: "🎥 LogRocket Session",
         value: `[View Session Replay & Logs](${input.logrocketSessionId})`,
         inline: false,
      });
   }

   return {
      title: input.title.slice(0, 256),
      description: input.description.slice(0, 4000),
      color,
      author: {
         name: authorName,
      },
      fields,
      footer: {
         text: `HoldMeToIt Feedback Engine • ID: ${code}`,
      },
      timestamp: (input.createdAt ?? new Date()).toISOString(),
   };
}

export const DEFAULT_FEEDBACK_CHANNEL_ID = "1556790638593319063";

export function resolveDiscordFeedbackChannelId(type: FeedbackType): string {
   if (type === "bug") {
      return (
         process.env.DISCORD_FEEDBACK_BUG_CHANNEL_ID ||
         process.env.DISCORD_FEEDBACK_CHANNEL_ID ||
         process.env.DISCORD_FEEDBACK_SUGGESTIONS_CHANNEL_ID ||
         DEFAULT_FEEDBACK_CHANNEL_ID
      );
   }

   return (
      process.env.DISCORD_FEEDBACK_SUGGESTIONS_CHANNEL_ID ||
      process.env.DISCORD_FEEDBACK_CHANNEL_ID ||
      process.env.DISCORD_FEEDBACK_BUG_CHANNEL_ID ||
      DEFAULT_FEEDBACK_CHANNEL_ID
   );
}

export interface DiscordSendResult {
   success: boolean;
   messageId?: string;
   channelId?: string;
   error?: string;
}

export async function sendFeedbackToDiscord(
   input: DiscordFeedbackPayloadInput
): Promise<DiscordSendResult> {
   const botToken = process.env.DISCORD_BOT_TOKEN;
   if (!botToken) {
      return {
         success: false,
         error: "DISCORD_BOT_TOKEN is not configured in environment.",
      };
   }

   const channelId = resolveDiscordFeedbackChannelId(input.type);
   if (!channelId) {
      return {
         success: false,
         error: `No Discord channel configured for feedback type: ${input.type}`,
      };
   }

   const embed = buildDiscordFeedbackEmbed(input);

   try {
      const response = await fetch(
         `https://discord.com/api/v10/channels/${channelId}/messages`,
         {
            method: "POST",
            headers: {
               Authorization: `Bot ${botToken}`,
               "Content-Type": "application/json",
            },
            body: JSON.stringify({
               embeds: [embed],
            }),
         }
      );

      if (!response.ok) {
         const errorText = await response.text();
         return {
            success: false,
            channelId,
            error: `Discord API error (${response.status}): ${errorText}`,
         };
      }

      const data = (await response.json()) as { id?: string };
      return {
         success: true,
         channelId,
         messageId: data.id,
      };
   } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
         success: false,
         channelId,
         error: `Network exception dispatching to Discord: ${errorMsg}`,
      };
   }
}
