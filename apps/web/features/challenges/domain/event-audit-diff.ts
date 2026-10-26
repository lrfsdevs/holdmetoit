/**
 * Pure domain utility for computing field-level diffs on Challenge / Event details.
 * Invariant: Law L7 (Pure Domain Isolation) — zero DB or framework imports.
 */

export interface ExistingEventState {
   title: string;
   description?: string | null;
   startAt: Date | string;
   endAt: Date | string;
   eventBannerUrl: string | null;
   punishmentPfpUrl: string | null;
   teams: Array<{
      id: string;
      name: string;
      color?: string | null;
      iconEmoji?: string | null;
      mascotUrl?: string | null;
   }>;
}

export interface IncomingEventInput {
   title: string;
   description?: string | null;
   startAt: string;
   endAt: string;
   eventBannerUrl?: string | null;
   punishmentPfpUrl?: string | null;
   teams: Array<{
      id?: string;
      name: string;
      color?: string | null;
      iconEmoji?: string | null;
      mascotUrl?: string | null;
   }>;
}

export interface EventDetailsDiff {
   hasChanges: boolean;
   fieldChanges: string[];
   summary: string;
   previousValue: Record<string, unknown>;
   newValue: Record<string, unknown>;
}

function normalizeDateStr(d: Date | string): string {
   const dateObj = typeof d === "string" ? new Date(d) : d;
   return !dateObj || isNaN(dateObj.getTime()) ? "" : dateObj.toISOString();
}

export function computeEventDetailsDiff(
   existing: ExistingEventState,
   incoming: IncomingEventInput
): EventDetailsDiff {
   const previousValue: Record<string, unknown> = {};
   const newValue: Record<string, unknown> = {};
   const fieldChanges: string[] = [];
   const summaryParts: string[] = [];

   // 1. Title Diff
   const trimmedExistingTitle = existing.title.trim();
   const trimmedIncomingTitle = incoming.title.trim();
   if (trimmedExistingTitle !== trimmedIncomingTitle) {
      fieldChanges.push("title");
      previousValue.title = trimmedExistingTitle;
      newValue.title = trimmedIncomingTitle;
      summaryParts.push(`Renamed event to "${trimmedIncomingTitle}"`);
   }

   // 1b. Description Diff
   if (incoming.description !== undefined) {
      const prevDesc = existing.description?.trim() || null;
      const nextDesc = incoming.description?.trim() || null;
      if (prevDesc !== nextDesc) {
         fieldChanges.push("description");
         previousValue.description = prevDesc;
         newValue.description = nextDesc;
         summaryParts.push(
            nextDesc ? "Updated event description" : "Cleared event description"
         );
      }
   }

   // 2. Schedule Timetable Diff
   const existingStart = normalizeDateStr(existing.startAt);
   const incomingStart = normalizeDateStr(incoming.startAt);
   const existingEnd = normalizeDateStr(existing.endAt);
   const incomingEnd = normalizeDateStr(incoming.endAt);

   if (existingStart !== incomingStart || existingEnd !== incomingEnd) {
      fieldChanges.push("dates");
      previousValue.dates = {
         startAt: existingStart,
         endAt: existingEnd,
      };
      newValue.dates = {
         startAt: incomingStart,
         endAt: incomingEnd,
      };
      summaryParts.push("Adjusted event timetable");
   }

   // 3. Header Banner Artwork Diff
   const prevBanner = existing.eventBannerUrl?.trim() || null;
   const nextBanner = incoming.eventBannerUrl?.trim() || null;
   if (prevBanner !== nextBanner) {
      fieldChanges.push("eventBannerUrl");
      previousValue.eventBannerUrl = prevBanner;
      newValue.eventBannerUrl = nextBanner;
      summaryParts.push(
         nextBanner ? "Updated header banner artwork" : "Removed header banner"
      );
   }

   // 4. Punishment PFP Forfeit Avatar Diff
   const prevPfp = existing.punishmentPfpUrl?.trim() || null;
   const nextPfp = incoming.punishmentPfpUrl?.trim() || null;
   if (prevPfp !== nextPfp) {
      fieldChanges.push("punishmentPfpUrl");
      previousValue.punishmentPfpUrl = prevPfp;
      newValue.punishmentPfpUrl = nextPfp;
      summaryParts.push(
         nextPfp ? "Updated punishment PFP avatar" : "Removed punishment PFP"
      );
   }

   // 5. Teams / Houses Diff
   const existingTeamMap = new Map(existing.teams.map((t) => [t.id, t]));
   const addedTeams: string[] = [];
   const modifiedTeams: Array<{ id: string; name: string; changes: string[] }> =
      [];
   const incomingIds = new Set<string>();

   for (const team of incoming.teams) {
      if (!team.id || !existingTeamMap.has(team.id)) {
         addedTeams.push(`${team.name} ${team.iconEmoji || ""}`.trim());
      } else {
         incomingIds.add(team.id);
         const oldTeam = existingTeamMap.get(team.id)!;
         const changes: string[] = [];
         if (oldTeam.name.trim() !== team.name.trim()) {
            changes.push(`renamed to "${team.name.trim()}"`);
         }
         if ((oldTeam.color || "") !== (team.color || "")) {
            changes.push("color changed");
         }
         if ((oldTeam.iconEmoji || "") !== (team.iconEmoji || "")) {
            changes.push(
               `icon changed ${oldTeam.iconEmoji || "—"} → ${team.iconEmoji || "—"}`
            );
         }
         if ((oldTeam.mascotUrl || "") !== (team.mascotUrl || "")) {
            changes.push("mascot changed");
         }
         if (changes.length > 0) {
            modifiedTeams.push({
               id: team.id,
               name: team.name,
               changes,
            });
         }
      }
   }

   const removedTeams: string[] = [];
   for (const oldTeam of existing.teams) {
      if (!incomingIds.has(oldTeam.id)) {
         removedTeams.push(`${oldTeam.name} ${oldTeam.iconEmoji || ""}`.trim());
      }
   }

   if (
      addedTeams.length > 0 ||
      modifiedTeams.length > 0 ||
      removedTeams.length > 0
   ) {
      fieldChanges.push("teams");
      previousValue.teams = existing.teams.map((t) => ({
         id: t.id,
         name: t.name,
         color: t.color,
         iconEmoji: t.iconEmoji,
      }));
      newValue.teams = incoming.teams.map((t) => ({
         id: t.id,
         name: t.name,
         color: t.color,
         iconEmoji: t.iconEmoji,
      }));

      const teamDescriptions: string[] = [];
      if (addedTeams.length > 0)
         teamDescriptions.push(`added house (${addedTeams.join(", ")})`);
      if (removedTeams.length > 0)
         teamDescriptions.push(`removed house (${removedTeams.join(", ")})`);
      if (modifiedTeams.length > 0) {
         teamDescriptions.push(
            `updated house ${modifiedTeams.map((m) => `"${m.name}" (${m.changes.join(", ")})`).join("; ")}`
         );
      }
      summaryParts.push(`Modified houses: ${teamDescriptions.join(", ")}`);
   }

   const hasChanges = fieldChanges.length > 0;
   const summary = hasChanges
      ? summaryParts.join(" • ")
      : "No modifications detected in event details";

   return {
      hasChanges,
      fieldChanges,
      summary,
      previousValue,
      newValue,
   };
}
