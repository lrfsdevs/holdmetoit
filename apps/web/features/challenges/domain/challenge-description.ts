export type DescriptionInline =
   | { type: "text"; value: string }
   | { type: "link"; label: string; href: string };

export type DescriptionBlock =
   | { type: "heading"; level: 1 | 2; content: DescriptionInline[] }
   | { type: "paragraph"; lines: DescriptionInline[][] }
   | { type: "divider" };

export const DEFAULT_CHALLENGE_DESCRIPTION = `An automated study battle governed by the HoldMeToIt three-condition accountability system. All scholars declare their individual target hours and weekly milestone intentions before kickoff, commit to daily study sessions, solve their deficits with the catch-up model, and compete for victory.

# How it works

1. Make sure you are in the [Yeolpumta (YPT) group](https://link.yeolpumta.com) because hours are verified to the second.
2. Register and declare your mandatory target hours and weekly milestone intentions.
3. Participants are divided fairly into competing houses. Cumulative team scores update live with every logged session.
4. The team that falls behind, or any individual scholar who fails their declared hours or declared goals, wears the assigned forfeit PFP for one week.

---

# Prizes & Rewards

The winning house earns special shiny Discord roles and custom highlight badges for top contributors. Scholars who maintain commitments preserve their standard avatar honor.`;

const HEADING_LEVEL_2 = /^##\s+(.+)$/;
const HEADING_LEVEL_1 = /^#\s+(.+)$/;
const LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g;

function parseInline(text: string): DescriptionInline[] {
   const nodes: DescriptionInline[] = [];
   let cursor = 0;

   LINK_PATTERN.lastIndex = 0;
   let match: RegExpExecArray | null;
   while ((match = LINK_PATTERN.exec(text)) !== null) {
      if (match.index > cursor) {
         nodes.push({ type: "text", value: text.slice(cursor, match.index) });
      }
      nodes.push({ type: "link", label: match[1], href: match[2] });
      cursor = match.index + match[0].length;
   }

   if (cursor < text.length) {
      nodes.push({ type: "text", value: text.slice(cursor) });
   }

   return nodes;
}

export function parseChallengeDescription(source: string): DescriptionBlock[] {
   const blocks: DescriptionBlock[] = [];
   let paragraph: DescriptionInline[][] = [];

   const flushParagraph = () => {
      if (paragraph.length === 0) return;
      blocks.push({ type: "paragraph", lines: paragraph });
      paragraph = [];
   };

   for (const rawLine of source.replace(/\r\n/g, "\n").split("\n")) {
      const line = rawLine.trim();

      if (line.length === 0) {
         flushParagraph();
         continue;
      }

      if (line === "---") {
         flushParagraph();
         blocks.push({ type: "divider" });
         continue;
      }

      const level2 = HEADING_LEVEL_2.exec(line);
      if (level2) {
         flushParagraph();
         blocks.push({
            type: "heading",
            level: 2,
            content: parseInline(level2[1].trim()),
         });
         continue;
      }

      const level1 = HEADING_LEVEL_1.exec(line);
      if (level1) {
         flushParagraph();
         blocks.push({
            type: "heading",
            level: 1,
            content: parseInline(level1[1].trim()),
         });
         continue;
      }

      paragraph.push(parseInline(line));
   }

   flushParagraph();
   return blocks;
}

export function resolveChallengeDescription(source?: string | null): string {
   const trimmed = source?.trim();
   return trimmed ? trimmed : DEFAULT_CHALLENGE_DESCRIPTION;
}
