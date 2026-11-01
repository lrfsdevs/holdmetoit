import {
   DiscordAPIError,
   requestDiscord,
   type DiscordUser,
} from "@holdmetoit/discord";
import { prisma } from "@/core/db";
import { createLogger, logEvents } from "@/core/observability/logger";
import {
   buildDiscordAvatarUrl,
   getDiscordDefaultAvatarUrl,
   parseDiscordAvatarUrl,
} from "@/features/auth/domain/discord-avatar";

const logger = createLogger("discord-avatar");

export type DiscordUserApiResponse = DiscordUser;

export interface DiscordAvatarFetchResult {
   avatarUrl: string;
   avatarHash: string | null;
}

export type OAuthAvatarFetchResult =
   | { success: true; avatarUrl: string; avatarHash: string | null }
   | { success: false; requiresReauth: boolean; error: string };

/**
 * Fetches the latest avatar information for a Discord user via Discord REST API v10 using a Bot Token.
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
      const data = await requestDiscord<DiscordUserApiResponse>(
         `/users/${discordUserId}`
      );
      const avatarUrl = data.avatar
         ? buildDiscordAvatarUrl(discordUserId, data.avatar)
         : getDiscordDefaultAvatarUrl(discordUserId, data.discriminator ?? "0");

      return {
         avatarUrl,
         avatarHash: data.avatar ?? null,
      };
   } catch (error) {
      if (error instanceof DiscordAPIError && error.status === 404) {
         // User not found or deleted on Discord, return deterministic embed default
         return {
            avatarUrl: getDiscordDefaultAvatarUrl(discordUserId),
            avatarHash: null,
         };
      }

      if (error instanceof DiscordAPIError) {
         logger.warn(logEvents.appError, {
            context: {
               discordUserId,
               status: error.status,
               message: "Failed to fetch Discord user from REST API",
            },
         });
      } else {
         logger.error(logEvents.appError, {
            context: { discordUserId, action: "fetchDiscordUserAvatar" },
            error,
         });
      }
      return null;
   }
}

/**
 * Fetches the current user's profile directly from Discord OAuth2 /users/@me using stored user tokens.
 * Automatically handles token expiration and token rotation via refresh_token without requiring re-login.
 */
export async function fetchDiscordUserAvatarViaOAuth(
   userId: string
): Promise<OAuthAvatarFetchResult> {
   try {
      const account = await prisma.account.findFirst({
         where: { userId, provider: "discord" },
         select: {
            id: true,
            access_token: true,
            refresh_token: true,
            expires_at: true,
         },
      });

      if (!account || (!account.access_token && !account.refresh_token)) {
         return {
            success: false,
            requiresReauth: true,
            error: "No linked Discord OAuth credentials found",
         };
      }

      let accessToken = account.access_token;
      let shouldRefresh =
         !accessToken ||
         (account.expires_at !== null &&
            account.expires_at !== undefined &&
            account.expires_at <= Math.floor(Date.now() / 1000));

      let fetchedUser: DiscordUserApiResponse | null = null;

      // Attempt the fetch with the existing token if it is not explicitly expired.
      if (accessToken && !shouldRefresh) {
         try {
            fetchedUser = await requestDiscord<DiscordUserApiResponse>(
               "/users/@me",
               { auth: "bearer", token: accessToken }
            );
         } catch (error) {
            if (error instanceof DiscordAPIError && error.status === 401) {
               shouldRefresh = true;
            }
         }
      }

      // Refresh the OAuth token if the access token is missing, expired or rejected.
      if ((shouldRefresh || !fetchedUser) && account.refresh_token) {
         const clientId =
            process.env.AUTH_DISCORD_ID || process.env.DISCORD_CLIENT_ID;
         const clientSecret =
            process.env.AUTH_DISCORD_SECRET ||
            process.env.DISCORD_CLIENT_SECRET;

         if (clientId && clientSecret) {
            const params = new URLSearchParams({
               client_id: clientId,
               client_secret: clientSecret,
               grant_type: "refresh_token",
               refresh_token: account.refresh_token,
            });

            const refreshData = await requestDiscord<{
               access_token?: string;
               refresh_token?: string;
               expires_in?: number;
            }>("/oauth2/token", {
               method: "POST",
               auth: "none",
               body: params,
               passThroughBody: true,
            }).catch(() => null);

            if (refreshData) {
               if (refreshData.access_token && refreshData.refresh_token) {
                  accessToken = refreshData.access_token;
                  const newExpiresAt =
                     Math.floor(Date.now() / 1000) +
                     (refreshData.expires_in ?? 604800);

                  await prisma.account
                     .update({
                        where: { id: account.id },
                        data: {
                           access_token: refreshData.access_token,
                           refresh_token: refreshData.refresh_token,
                           expires_at: newExpiresAt,
                        },
                     })
                     .catch((err) => {
                        logger.error(logEvents.appError, {
                           context: {
                              action: "updateAccountTokens",
                              userId,
                           },
                           error: err,
                        });
                     });

                  try {
                     fetchedUser = await requestDiscord<DiscordUserApiResponse>(
                        "/users/@me",
                        { auth: "bearer", token: accessToken }
                     );
                  } catch {
                     fetchedUser = null;
                  }
               }
            } else {
               logger.warn(logEvents.appError, {
                  context: {
                     action: "refreshDiscordOAuthToken",
                     userId,
                  },
               });
               return {
                  success: false,
                  requiresReauth: true,
                  error: "Discord session expired — please log in again to sync",
               };
            }
         }
      }

      if (fetchedUser) {
         const data = fetchedUser;
         const avatarUrl = data.avatar
            ? buildDiscordAvatarUrl(data.id, data.avatar)
            : getDiscordDefaultAvatarUrl(data.id, data.discriminator ?? "0");

         return {
            success: true,
            avatarUrl,
            avatarHash: data.avatar ?? null,
         };
      }

      return {
         success: false,
         requiresReauth: true,
         error: "Discord session expired — please log in again to sync",
      };
   } catch (error) {
      logger.error(logEvents.appError, {
         context: { action: "fetchDiscordUserAvatarViaOAuth", userId },
         error,
      });
      return {
         success: false,
         requiresReauth: false,
         error: "Unable to contact Discord API",
      };
   }
}

export interface SyncUserAvatarParams {
   userId?: string;
   discordId?: string;
   allowOAuth?: boolean;
}

export interface SyncUserAvatarResult {
   success: boolean;
   newImageUrl: string | null;
   updated?: boolean;
   message?: string;
   error?: string;
   requiresReauth?: boolean;
}

/**
 * Synchronizes and updates a user's avatar in the database without requiring them to re-login.
 * 1. Checks OAuth user tokens (@me) with auto-refresh.
 * 2. Falls back to Discord Bot REST API if configured.
 * 3. Only falls back to default embed avatar if previous image was an avatar hash that now verified 404s.
 */
export async function syncUserAvatar(
   params: SyncUserAvatarParams
): Promise<SyncUserAvatarResult> {
   if (!params.userId && !params.discordId) {
      return {
         success: false,
         newImageUrl: null,
         error: "Either userId or discordId must be provided",
      };
   }

   const user = await prisma.user.findFirst({
      where: params.userId
         ? { id: params.userId }
         : { discordId: params.discordId },
      select: { id: true, discordId: true, image: true },
   });

   if (!user || !user.discordId) {
      return {
         success: false,
         newImageUrl: null,
         error: "User not found",
      };
   }

   // 1. Try OAuth token lookup ONLY if allowOAuth is true (security gate against unauthorized token consumption)
   const allowOAuth = params.allowOAuth ?? false;
   let fetched: DiscordAvatarFetchResult | null = null;
   let oauthResult: OAuthAvatarFetchResult | null = null;

   if (allowOAuth) {
      oauthResult = await fetchDiscordUserAvatarViaOAuth(user.id);
      if (oauthResult.success) {
         fetched = {
            avatarUrl: oauthResult.avatarUrl,
            avatarHash: oauthResult.avatarHash,
         };
      }
   }

   // 2. If OAuth lookup didn't run or didn't succeed, try Bot API if configured
   if (!fetched) {
      fetched = await fetchDiscordUserAvatar(user.discordId);
   }

   let targetImageUrl: string;

   if (fetched) {
      targetImageUrl = fetched.avatarUrl;
      const isDifferent = targetImageUrl !== user.image;

      if (isDifferent) {
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
         updated: isDifferent,
         message: isDifferent ? "Avatar updated!" : "Avatar is up to date!",
      };
   }

   // 3. Neither OAuth nor Bot API succeeded
   // Check if current avatar is 404 on Discord CDN before deciding what to do
   const currentParsed = parseDiscordAvatarUrl(user.image);
   let isBroken = false;

   if (currentParsed.isDiscordAvatar && user.image) {
      isBroken = await fetch(user.image, {
         method: "HEAD",
         cache: "no-store",
      })
         .then((r) => r.status === 404)
         .catch(() => false);
   }

   if (isBroken) {
      targetImageUrl = getDiscordDefaultAvatarUrl(user.discordId);
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
            reason: "healed_404",
         },
      });

      return {
         success: true,
         newImageUrl: targetImageUrl,
         updated: true,
         message: "Restored default Discord avatar",
      };
   }

   // The existing avatar is healthy (not broken), but live sync failed or was restricted
   const requiresReauth = oauthResult
      ? !oauthResult.success && oauthResult.requiresReauth
      : false;
   const errorMessage =
      oauthResult && !oauthResult.success
         ? oauthResult.error
         : allowOAuth
           ? "Discord session expired — please log in again to sync"
           : "Live Discord sync unavailable without OAuth authorization";

   return {
      success: false,
      newImageUrl: user.image,
      requiresReauth,
      error: errorMessage,
      message:
         "Current avatar is active. Please log in again to sync new changes.",
   };
}
