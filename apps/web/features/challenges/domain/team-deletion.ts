const TEAM_NAME_MAX_LENGTH = 255;

/**
 * Builds a unique tombstone name for a soft-deleted team so the original
 * name can be re-created without tripping the @@unique([challengeId, name]) index.
 */
export function buildTeamTombstoneName(name: string, id: string): string {
   const suffix = ` ·deleted·${id.slice(0, 8)}`;
   const maxBaseLength = Math.max(0, TEAM_NAME_MAX_LENGTH - suffix.length);
   return `${name.slice(0, maxBaseLength)}${suffix}`;
}
