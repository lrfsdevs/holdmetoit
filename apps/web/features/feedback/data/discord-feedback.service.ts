import { MISSING_TOKEN_ERROR, sendChannelMessage } from "@holdmetoit/discord";
import type {
   DiscordEmbed,
   DiscordEmbedField,
   DiscordSendResult,
} from "@holdmetoit/discord";
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
   attachments?: { url: string; kind: "image" | "video" }[];
}

export type { DiscordEmbed, DiscordEmbedField, DiscordSendResult };

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

   const attachments = input.attachments ?? [];
   if (attachments.length > 0) {
      fields.push({
         name: `📎 Attachments (${attachments.length})`,
         value: attachments
            .map(
               (attachment, index) =>
                  `• [${attachment.kind === "image" ? "Image" : "Video"} ${index + 1}](${attachment.url})`
            )
            .join("\n")
            .slice(0, 1024),
         inline: false,
      });
   }

   const firstImage = attachments.find(
      (attachment) => attachment.kind === "image"
   );

   return {
      title: input.title.slice(0, 256),
      description: input.description.slice(0, 4000),
      color,
      author: {
         name: authorName,
      },
      fields,
      ...(firstImage ? { image: { url: firstImage.url } } : {}),
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

export async function sendFeedbackToDiscord(
   input: DiscordFeedbackPayloadInput
): Promise<DiscordSendResult> {
   if (!process.env.DISCORD_BOT_TOKEN) {
      return { success: false, error: MISSING_TOKEN_ERROR };
   }

   const channelId = resolveDiscordFeedbackChannelId(input.type);
   if (!channelId) {
      return {
         success: false,
         error: `No Discord channel configured for feedback type: ${input.type}`,
      };
   }

   const embed = buildDiscordFeedbackEmbed(input);
   return sendChannelMessage({ channelId, embeds: [embed] });
}
