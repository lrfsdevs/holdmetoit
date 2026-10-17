/**
 * Service to verify Discord server roles and permissions for RBAC.
 * Uses Discord REST API v10 to inspect guild member roles via a Bot Token.
 */

export interface DiscordGuildMemberResponse {
   roles?: string[];
   user?: {
      id: string;
      username: string;
   };
}

import { parseDiscordSnowflakeList } from "@/features/auth/domain/auth-roles";

export function getConfiguredAdminRoleIds(): string[] {
   const raw = process.env.DISCORD_ADMIN_ROLE_IDS ?? "";
   return parseDiscordSnowflakeList(raw);
}

export function getConfiguredDevDiscordIds(): string[] {
   const raw = process.env.DEV_DISCORD_IDS ?? process.env.DISCORD_DEV_IDS ?? "";
   return parseDiscordSnowflakeList(raw);
}

/**
 * Evaluates whether a Discord user qualifies for the DEV role.
 * Criteria: User's Discord snowflake is in DEV_DISCORD_IDS.
 */
export function isDiscordDev(discordUserId: string): boolean {
   if (!discordUserId) {
      return false;
   }
   const devIds = getConfiguredDevDiscordIds();
   return devIds.includes(discordUserId);
}

/**
 * Fetches the role IDs assigned to a member in the configured Discord server.
 */
export async function fetchMemberRoles(
   discordUserId: string
): Promise<string[]> {
   const guildId = process.env.DISCORD_GUILD_ID;
   const botToken = process.env.DISCORD_BOT_TOKEN;

   if (!guildId || !botToken || !discordUserId) {
      return [];
   }

   try {
      const res = await fetch(
         `https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}`,
         {
            headers: {
               Authorization: `Bot ${botToken}`,
            },
            cache: "no-store",
         }
      );

      if (!res.ok) {
         return [];
      }

      const data = (await res.json()) as DiscordGuildMemberResponse;
      return Array.isArray(data.roles) ? data.roles : [];
   } catch {
      return [];
   }
}

/**
 * Evaluates whether a Discord user qualifies for the ADMIN (Host) role.
 * Criteria: User possesses one or more roles listed in DISCORD_ADMIN_ROLE_IDS in the server.
 */
export async function isDiscordAdmin(discordUserId: string): Promise<boolean> {
   if (!discordUserId) {
      return false;
   }

   const adminRoleIds = getConfiguredAdminRoleIds();
   if (adminRoleIds.length === 0) {
      return false;
   }

   const memberRoles = await fetchMemberRoles(discordUserId);
   return memberRoles.some((roleId) => adminRoleIds.includes(roleId));
}
