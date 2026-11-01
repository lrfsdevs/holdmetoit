import { MISSING_TOKEN_ERROR, sendChannelMessage } from "@holdmetoit/discord";
import type { DiscordSendResult } from "@holdmetoit/discord";
import type { DiscordEmbed } from "@/features/wrapped/domain/challenge-feedback-embed";

export type { DiscordSendResult };

export const DEFAULT_CHALLENGE_FEEDBACK_CHANNEL_ID = "1558594247895289877";

export function resolveChallengeFeedbackChannelId(): string {
   return (
      process.env.DISCORD_CHALLENGE_FEEDBACK_CHANNEL_ID ||
      DEFAULT_CHALLENGE_FEEDBACK_CHANNEL_ID
   );
}

export async function sendChallengeFeedbackToDiscord(
   embed: DiscordEmbed
): Promise<DiscordSendResult> {
   if (!process.env.DISCORD_BOT_TOKEN) {
      return { success: false, error: MISSING_TOKEN_ERROR };
   }

   const channelId = resolveChallengeFeedbackChannelId();
   return sendChannelMessage({ channelId, embeds: [embed] });
}
