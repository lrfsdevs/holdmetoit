import { MISSING_TOKEN_ERROR, sendChannelMessage } from "@holdmetoit/discord";
import type {
   DiscordEmbed,
   DiscordEmbedField,
   DiscordSendResult,
} from "@holdmetoit/discord";
import { getServerEnv } from "@/core/env/server";
import { formatFeedbackCode } from "@/features/feedback/domain/feedback-code";
import {
   toSafeLogRocketUrl,
   toSafePageUrl,
} from "@/features/feedback/domain/feedback-links";
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

   const safePage = toSafePageUrl(input.url);
   const page =
      safePage.length > 250 ? `${safePage.slice(0, 247)}...` : safePage;
   const logrocketUrl = toSafeLogRocketUrl(input.logrocketSessionId);

   const fields: DiscordEmbedField[] = [
      {
         name: "📍 Page",
         // In a code span so nothing in the page value can be auto-linked.
         value: `\`${page}\``,
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

   if (isBug && logrocketUrl) {
      fields.push({
         name: "🎥 LogRocket Session",
         value: `[View Session Replay & Logs](${logrocketUrl})`,
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
   const env = getServerEnv();
   if (type === "bug") {
      return (
         env.DISCORD_FEEDBACK_BUG_CHANNEL_ID ||
         env.DISCORD_FEEDBACK_CHANNEL_ID ||
         env.DISCORD_FEEDBACK_SUGGESTIONS_CHANNEL_ID ||
         DEFAULT_FEEDBACK_CHANNEL_ID
      );
   }

   return (
      env.DISCORD_FEEDBACK_SUGGESTIONS_CHANNEL_ID ||
      env.DISCORD_FEEDBACK_CHANNEL_ID ||
      env.DISCORD_FEEDBACK_BUG_CHANNEL_ID ||
      DEFAULT_FEEDBACK_CHANNEL_ID
   );
}

export async function sendFeedbackToDiscord(
   input: DiscordFeedbackPayloadInput
): Promise<DiscordSendResult> {
   const env = getServerEnv();
   if (!env.DISCORD_BOT_TOKEN) {
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
