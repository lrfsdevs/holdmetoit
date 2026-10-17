export type ChangelogAudience = "user" | "internal";

export interface ChangelogEntry {
   title: string;
   body: string;
   highlights?: string[];
   audience: ChangelogAudience;
}

export interface ChangelogGroup {
   date: string;
   entries: ChangelogEntry[];
}

const DATE_HEADING = /^##\s+(\d{4}-\d{2}-\d{2})\s*$/;
const ENTRY_HEADING = /^###\s+(.+?)(?:\s*\[(user|internal)\])?\s*$/i;
const BULLET = /^\s*[-*]\s+(.*)$/;

export function parseChangelogMarkdown(markdown: string): ChangelogGroup[] {
   const groups: ChangelogGroup[] = [];
   let group: ChangelogGroup | null = null;
   let entry: {
      title: string;
      audience: ChangelogAudience;
      text: string[];
      bullets: string[];
   } | null = null;

   const commitEntry = () => {
      if (!entry || !group) return;

      const body = entry.text.join(" ").replace(/\s+/g, " ").trim();
      group.entries.push({
         title: entry.title,
         body,
         audience: entry.audience,
         ...(entry.bullets.length > 0 ? { highlights: entry.bullets } : {}),
      });
      entry = null;
   };

   for (const rawLine of markdown.split(/\r?\n/)) {
      const line = rawLine.trimEnd();

      const dateMatch = DATE_HEADING.exec(line);
      if (dateMatch) {
         commitEntry();
         group = { date: dateMatch[1], entries: [] };
         groups.push(group);
         continue;
      }

      const entryMatch = ENTRY_HEADING.exec(line);
      if (entryMatch) {
         commitEntry();
         entry = {
            title: entryMatch[1].trim(),
            audience:
               (entryMatch[2]?.toLowerCase() as ChangelogAudience) ??
               "internal",
            text: [],
            bullets: [],
         };
         continue;
      }

      if (!entry) continue;

      const bulletMatch = BULLET.exec(line);
      if (bulletMatch) {
         entry.bullets.push(bulletMatch[1].trim());
         continue;
      }

      const text = line.trim();
      if (text.length > 0) {
         entry.text.push(text);
      }
   }

   commitEntry();

   return groups.filter(hasEntries);
}

export function sortGroupsByDate(
   groups: readonly ChangelogGroup[]
): ChangelogGroup[] {
   return [...groups].sort((a, b) => {
      if (a.date < b.date) return 1;
      if (a.date > b.date) return -1;
      return 0;
   });
}

export function selectVisibleGroups(
   groups: readonly ChangelogGroup[],
   isAdmin: boolean
): ChangelogGroup[] {
   return sortGroupsByDate(groups)
      .map((group) => ({
         date: group.date,
         entries: group.entries.filter(
            (entry) => isAdmin || entry.audience === "user"
         ),
      }))
      .filter(hasEntries);
}

export function formatEntryDate(iso: string): string {
   const date = new Date(`${iso}T00:00:00Z`);
   if (Number.isNaN(date.getTime())) {
      return iso;
   }

   return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
   }).format(date);
}

export function hasEntries(group: ChangelogGroup): boolean {
   return group.entries.length > 0;
}
