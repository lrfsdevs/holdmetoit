import { prisma } from "@/core/db";
import { createLogger, logEvents } from "@/core/observability/logger";
import {
   buildDiscordAvatarUrl,
   getDiscordDefaultAvatarUrl,
   parseDiscordAvatarUrl,
} from "@/features/auth/domain/discord-avatar";

const logger = createLogger("discord-avatar");

export interface DiscordUserApiResponse {
   id: string;
   username: string;
   avatar: string | null;
   discriminator: string;
   global_name?: string | null;
}

export interface DiscordAvatarFetchResult {
   avatarUrl: string;
   avatarHash: string | null;
}

/**
 * Fetches the latest avatar information for a Discord user via Discord REST API v10.
 * Requires DISCORD_BOT_TOKEN to be configured.
 */
export async function fetchDiscordUserAvatar(
   discordUserId: string
): Promise<DiscordAvatarFetchResult | null> {
   const botToken = process.env.DISCORD_BOT_TOKEN;

   if (!botToken || !discordUserId) {
      return null;
   }

   try {
      const res = await fetch(
         `https://discord.com/api/v10/users/${discordUserId}`,
         {
            headers: {
               Authorization: `Bot ${botToken}`,
            },
            cache: "no-store",
         }
      );

      if (res.status === 404) {
         // User not found or deleted on Discord, return deterministic embed default
         return {
            avatarUrl: getDiscordDefaultAvatarUrl(discordUserId),
            avatarHash: null,
         };
      }

      if (!res.ok) {
         logger.warn(logEvents.appError, {
            context: {
               discordUserId,
               status: res.status,
               message: "Failed to fetch Discord user from REST API",
            },
         });
         return null;
      }

      const data = (await res.json()) as DiscordUserApiResponse;
      const avatarUrl = data.avatar
         ? buildDiscordAvatarUrl(discordUserId, data.avatar)
         : getDiscordDefaultAvatarUrl(discordUserId, data.discriminator);

      return {
         avatarUrl,
         avatarHash: data.avatar,
      };
   } catch (error) {
      logger.error(logEvents.appError, {
         context: { discordUserId, action: "fetchDiscordUserAvatar" },
         error,
      });
      return null;
   }
}

export interface SyncUserAvatarParams {
   userId?: string;
   discordId?: string;
}

export interface SyncUserAvatarResult {
   success: boolean;
   newImageUrl: string | null;
}

/**
 * Synchronizes and updates a user's avatar in the database.
 * If Discord API fails or has no bot token, it falls back to the deterministic default Discord avatar
 * to heal dead 404 hashes.
 */
export async function syncUserAvatar(
   params: SyncUserAvatarParams
): Promise<SyncUserAvatarResult> {
   if (!params.userId && !params.discordId) {
      return { success: false, newImageUrl: null };
   }

   const user = await prisma.user.findFirst({
      where: params.userId
         ? { id: params.userId }
         : { discordId: params.discordId },
      select: { id: true, discordId: true, image: true },
   });

   if (!user || !user.discordId) {
      return { success: false, newImageUrl: null };
   }

   const fetched = await fetchDiscordUserAvatar(user.discordId);

   let targetImageUrl: string;

   if (fetched) {
      targetImageUrl = fetched.avatarUrl;
   } else {
      // Fallback: If Discord bot query is unavailable and current image was a Discord hash,
      // heal it to the default Discord avatar so it stops returning 404.
      const currentParsed = parseDiscordAvatarUrl(user.image);
      if (currentParsed.isDiscordAvatar) {
         targetImageUrl = getDiscordDefaultAvatarUrl(user.discordId);
      } else {
         return { success: false, newImageUrl: user.image };
      }
   }

   if (targetImageUrl !== user.image) {
      await prisma.user.update({
         where: { id: user.id },
         data: { image: targetImageUrl },
      });
      logger.info(logEvents.authUserSynced, {
         context: {
            userId: user.id,
            discordId: user.discordId,
            oldImage: user.image,
            newImage: targetImageUrl,
         },
      });
   }

   return {
      success: true,
      newImageUrl: targetImageUrl,
   };
}
