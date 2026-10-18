/**
 * Pure mapper from Discord OAuth profile fields to User persistence fields.
 * Keeps Discord sync rules testable without Prisma or Auth.js imports.
 */
export interface DiscordProfileInput {
   providerAccountId: string;
   username?: string | null;
   globalName?: string | null;
   image?: string | null;
}

export interface DiscordUserSyncFields {
   discordId: string;
   username: string | null;
   displayName: string | null;
   image: string | null;
}

export function mapDiscordProfileToUserFields(
   input: DiscordProfileInput
): DiscordUserSyncFields {
   return {
      discordId: input.providerAccountId,
      username: input.username ?? null,
      displayName: input.globalName ?? input.username ?? null,
      image: input.image ?? null,
   };
}
