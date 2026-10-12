import { formatSecondsToClock } from "@/features/study-logs/domain/duration";

export interface DiscordSummaryTeam {
   name: string;
   iconEmoji: string | null;
   totalLoggedSeconds: number;
   isLeader: boolean;
}

export interface DiscordSummaryPodiumEntry {
   rank: 1 | 2 | 3;
   displayName: string;
   username: string | null;
   teamName: string;
   totalLoggedSeconds: number;
}

export interface DiscordSummaryPunishedMember {
   displayName: string;
   username: string | null;
   isPardoned: boolean;
   pardonReason: string | null;
}

export interface DiscordSummaryInput {
   title: string;
   status: "UPCOMING" | "ACTIVE" | "COMPLETED";
   startDate: string;
   endDate: string;
   teams: DiscordSummaryTeam[];
   leadMarginSeconds?: number;
   podium: DiscordSummaryPodiumEntry[];
   punishedMembers: DiscordSummaryPunishedMember[];
}

/**
 * Formats challenge standings and results into Discord-ready Markdown (FEAT-DISC-01).
 * Features rich text formatting, emoji indicators, podium medals, and punishment callouts.
 */
export function generateDiscordSummary(input: DiscordSummaryInput): string {
   const lines: string[] = [];

   // Header Banner
   const statusEmoji =
      input.status === "COMPLETED"
         ? "🏁"
         : input.status === "ACTIVE"
           ? "⚡"
           : "⏳";
   const statusText =
      input.status === "COMPLETED"
         ? "FINAL RESULTS"
         : input.status === "ACTIVE"
           ? "LIVE STANDINGS"
           : "UPCOMING EVENT";

   lines.push(`${statusEmoji} **HOLDMETOIT — ${input.title.toUpperCase()}**`);
   lines.push(`*${statusText} • ${input.startDate} to ${input.endDate}*`);
   lines.push("");

   // Team Matchup / Scores
   if (input.teams.length > 0) {
      lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      lines.push("🏆 **TEAM STANDINGS**");

      // Sort teams by total logged seconds descending
      const sortedTeams = [...input.teams].sort(
         (a, b) => b.totalLoggedSeconds - a.totalLoggedSeconds
      );

      sortedTeams.forEach((team) => {
         const emoji = team.iconEmoji ? `${team.iconEmoji} ` : "";
         const crown = team.isLeader ? " 👑 [IN LEAD]" : "";
         const winner =
            input.status === "COMPLETED" && team.isLeader
               ? " 👑 [WINNER]"
               : crown;
         const clock = formatSecondsToClock(team.totalLoggedSeconds);
         lines.push(`• **${emoji}${team.name}**: \`${clock}\`${winner}`);
      });

      if (
         input.leadMarginSeconds !== undefined &&
         input.leadMarginSeconds > 0 &&
         sortedTeams.length > 1
      ) {
         const marginClock = formatSecondsToClock(input.leadMarginSeconds);
         lines.push(`*Current lead delta: +${marginClock}*`);
      }

      lines.push("");
   }

   // Individual Podium
   if (input.podium.length > 0) {
      lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      lines.push("🎖️ **INDIVIDUAL PODIUM**");

      const medals: Record<1 | 2 | 3, string> = {
         1: "🥇 1st Place",
         2: "🥈 2nd Place",
         3: "🥉 3rd Place",
      };

      input.podium.forEach((entry) => {
         const handle = entry.username
            ? `@${entry.username}`
            : entry.displayName;
         const clock = formatSecondsToClock(entry.totalLoggedSeconds);
         lines.push(
            `• ${medals[entry.rank]}: **${handle}** (${entry.teamName}) — \`${clock}\``
         );
      });

      lines.push("");
   }

   // Accountability & Punishment Wall
   lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
   const activePunished = input.punishedMembers.filter((m) => !m.isPardoned);
   const pardoned = input.punishedMembers.filter((m) => m.isPardoned);

   if (activePunished.length > 0) {
      lines.push("💀 **PUNISHMENT WALL (Change Avatar to Event Forfeit PFP)**");
      lines.push("*Download your forfeit avatar from the event noticeboard.*");

      activePunished.forEach((member) => {
         const handle = member.username
            ? `@${member.username}`
            : member.displayName;
         lines.push(`• **${handle}** — Event forfeit`);
      });
      lines.push("");
   } else if (input.status === "COMPLETED") {
      lines.push("🎉 **HONOR ROLL — ZERO PUNISHMENTS!**");
      lines.push(
         "All participants met their declared target hours and weekly goals!"
      );
      lines.push("");
   }

   if (pardoned.length > 0) {
      lines.push("🕊️ **EXCUSED / PARDONED BY HOST**");
      pardoned.forEach((member) => {
         const handle = member.username
            ? `@${member.username}`
            : member.displayName;
         const reason = member.pardonReason
            ? ` — Reason: *${member.pardonReason}*`
            : "";
         lines.push(`• **${handle}**${reason}`);
      });
      lines.push("");
   }

   lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
   lines.push("📖 *Powered by HoldMeToIt — Cozy Gamified Study Battles*");

   return lines.join("\n");
}
