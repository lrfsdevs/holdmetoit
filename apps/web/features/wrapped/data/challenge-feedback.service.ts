import type { DiscordEmbed } from "@/features/wrapped/domain/challenge-feedback-embed";

export const DEFAULT_CHALLENGE_FEEDBACK_CHANNEL_ID = "1558594247895289877";

export function resolveChallengeFeedbackChannelId(): string {
   return (
      process.env.DISCORD_CHALLENGE_FEEDBACK_CHANNEL_ID ||
      DEFAULT_CHALLENGE_FEEDBACK_CHANNEL_ID
   );
}

export interface DiscordSendResult {
   success: boolean;
   messageId?: string;
   channelId?: string;
   error?: string;
}

export async function sendChallengeFeedbackToDiscord(
   embed: DiscordEmbed
): Promise<DiscordSendResult> {
   const botToken = process.env.DISCORD_BOT_TOKEN;
   if (!botToken) {
      return {
         success: false,
         error: "DISCORD_BOT_TOKEN is not configured in environment.",
      };
   }

   const channelId = resolveChallengeFeedbackChannelId();
   if (!channelId) {
      return {
         success: false,
         error: "No Discord channel configured for challenge feedback.",
      };
   }

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
