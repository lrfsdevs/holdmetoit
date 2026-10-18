export type UserRoleType = "PARTICIPANT" | "ADMIN" | "DEV";

/**
 * Parses a Discord snowflake ID list from an environment string.
 * Robustly supports:
 * - JSON stringified arrays: '["123456789012345678", "987654321098765432"]'
 * - Comma-delimited lists: "123456789012345678, 987654321098765432"
 */
export function parseDiscordSnowflakeList(
   raw: string | undefined | null
): string[] {
   if (!raw || typeof raw !== "string" || !raw.trim()) {
      return [];
   }

   const trimmed = raw.trim();

   // Handle JSON array format e.g. ["123", "456"]
   if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
         const parsed = JSON.parse(trimmed);
         if (Array.isArray(parsed)) {
            return parsed
               .map((item) =>
                  item !== null && item !== undefined ? String(item).trim() : ""
               )
               .filter(Boolean);
         }
      } catch {
         // Fallback to comma-separated splitting if JSON.parse fails
      }
   }

   // Handle comma-delimited strings (strip any extra quotes around items)
   return trimmed
      .split(",")
      .map((item) => item.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
}

/**
 * Evaluates whether a user role grants administrative authority.
 * Both ADMIN (Host) and DEV possess full administrative powers.
 */
export function hasAdminPrivileges(
   role?: UserRoleType | string | null
): boolean {
   return role === "ADMIN" || role === "DEV";
}

/**
 * Evaluates whether a role is specifically DEV.
 */
export function isDevRole(role?: UserRoleType | string | null): boolean {
   return role === "DEV";
}
