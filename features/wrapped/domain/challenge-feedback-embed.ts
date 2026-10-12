export interface ChallengeFeedbackReporter {
   userId: string;
   username?: string | null;
   displayName?: string | null;
   discordId?: string | null;
}

export interface BuildChallengeFeedbackEmbedInput {
   challengeTitle: string;
   challengeId: string;
   consistency: string;
   fairnessRating: number;
   trackingPreference: string;
   teamBattleFeedback?: string | null;
   workSchoolHours: string;
   soloStyle: string;
   soloPunishment: string;
   soloIdeas?: string | null;
   reporter: ChallengeFeedbackReporter;
   createdAt?: Date;
   appUrl?: string | null;
}

export interface DiscordEmbedField {
   name: string;
   value: string;
   inline?: boolean;
}

export interface DiscordEmbed {
   title: string;
   description?: string;
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

/**
 * Returns a visual star rating representation: e.g. "⭐⭐⭐⭐⭐ (5/5)"
 */
export function formatStarRating(rating: number): string {
   const clamped = Math.max(1, Math.min(5, Math.round(rating)));
   const stars = "⭐".repeat(clamped) + "☆".repeat(5 - clamped);
   return `${stars} (${clamped}/5)`;
}

/**
 * Resolves color based on sentiment/rating.
 */
export function resolveRatingColor(rating: number): number {
   switch (rating) {
      case 5:
         return 0x22c55e; // Obsidian Emerald
      case 4:
         return 0x10b981; // Mint / Teal
      case 3:
         return 0xf59e0b; // Warm Amber
      case 2:
      case 1:
      default:
         return 0xef4444; // Rose / Red
   }
}

/**
 * Formats reporter identity tag for Discord embed.
 */
export function formatReporterMention(
   reporter: ChallengeFeedbackReporter
): string {
   if (reporter.discordId) {
      return `<@${reporter.discordId}>`;
   }
   if (reporter.displayName) {
      return reporter.displayName;
   }
   if (reporter.username) {
      return reporter.username;
   }
   return "Participant";
}

/**
 * Pure domain function to construct an Obsidian-themed Discord Embed for Challenge Feedback.
 */
export function buildChallengeFeedbackEmbed(
   input: BuildChallengeFeedbackEmbedInput
): DiscordEmbed {
   const color = resolveRatingColor(input.fairnessRating);
   const starDisplay = formatStarRating(input.fairnessRating);
   const reporterText = formatReporterMention(input.reporter);

   const baseUrl =
      input.appUrl || process.env.AUTH_URL || "https://holdmetoit.com";
   const cleanBaseUrl = baseUrl.replace(/\/+$/, "");
   const challengeUrl = `${cleanBaseUrl}/challenge/${input.challengeId}`;

   const fields: DiscordEmbedField[] = [
      {
         name: "👤 Submitter",
         value: reporterText,
         inline: true,
      },
      {
         name: "⚖️ Fairness Rating",
         value: starDisplay,
         inline: true,
      },
      {
         name: "📈 Improved Consistency?",
         value: input.consistency,
         inline: true,
      },
      {
         name: "⏱️ Preferred Tracking",
         value: input.trackingPreference,
         inline: true,
      },
      {
         name: "🎒 Count Work/School?",
         value: input.workSchoolHours,
         inline: true,
      },
      {
         name: "🏆 Solo Challenge Style",
         value: input.soloStyle,
         inline: true,
      },
      {
         name: "🎭 Keep Punishment PFPs?",
         value: input.soloPunishment,
         inline: true,
      },
      {
         name: "🏆 Challenge",
         value: `[${input.challengeTitle}](${challengeUrl})`,
         inline: true,
      },
   ];

   if (input.teamBattleFeedback && input.teamBattleFeedback.trim()) {
      fields.push({
         name: "💬 Team Battle Suggestions & Complaints",
         value: input.teamBattleFeedback.trim().slice(0, 1024),
         inline: false,
      });
   }

   if (input.soloIdeas && input.soloIdeas.trim()) {
      fields.push({
         name: "💡 Solo Challenge Ideas & Thoughts",
         value: input.soloIdeas.trim().slice(0, 1024),
         inline: false,
      });
   }

   return {
      title: `💬 Challenge Feedback · ${input.challengeTitle}`,
      color,
      author: {
         name: "HOLDMETOIT CHALLENGE FEEDBACK",
      },
      fields,
      footer: {
         text: "HoldMeToIt Feedback Engine • Post-Challenge Review",
      },
      timestamp: (input.createdAt ?? new Date()).toISOString(),
   };
}
