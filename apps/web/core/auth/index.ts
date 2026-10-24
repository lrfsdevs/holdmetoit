import { cache } from "react";
import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { prisma } from "@/core/db";
import { createLogger, logEvents } from "@/core/observability/logger";
import {
   buildDiscordAvatarUrl,
   getDiscordDefaultAvatarUrl,
} from "@/features/auth/domain/discord-avatar";
import { isDiscordDev } from "@/features/auth/data/discord-guild.service";
import {
   syncUserFromDiscordProfile,
   syncUserRoleFromDiscord,
} from "@/features/auth/data/user.repository";

const logger = createLogger("auth");

const nextAuthResult = NextAuth({
   adapter: PrismaAdapter(prisma),
   providers: [
      Discord({
         clientId: process.env.AUTH_DISCORD_ID,
         clientSecret: process.env.AUTH_DISCORD_SECRET,
         issuer: "https://discord.com",
         authorization: {
            params: {
               scope: "identify",
            },
         },
      }),
   ],
   session: {
      strategy: "database",
   },
   pages: {
      signIn: "/",
   },
   events: {
      async signIn({ user, account, profile }) {
         if (!user.id || !account || account.provider !== "discord") {
            return;
         }

         const discordProfile = profile as {
            username?: string;
            global_name?: string | null;
            avatar?: string | null;
            discriminator?: string | null;
         };

         logger.info(logEvents.authDiscordSignin, {
            context: { userId: user.id, discordId: account.providerAccountId },
         });

         try {
            await syncUserFromDiscordProfile(user.id, {
               providerAccountId: account.providerAccountId,
               username: discordProfile.username,
               globalName: discordProfile.global_name,
               image: discordProfile.avatar
                  ? buildDiscordAvatarUrl(
                       account.providerAccountId,
                       discordProfile.avatar
                    )
                  : discordProfile.discriminator
                    ? getDiscordDefaultAvatarUrl(
                         account.providerAccountId,
                         discordProfile.discriminator
                      )
                    : (user.image ??
                      getDiscordDefaultAvatarUrl(account.providerAccountId)),
            });

            await syncUserRoleFromDiscord(user.id, account.providerAccountId);

            logger.info(logEvents.authUserSynced, {
               context: {
                  userId: user.id,
                  discordId: account.providerAccountId,
               },
            });
         } catch (error) {
            logger.error(logEvents.authUserSynced, {
               context: {
                  userId: user.id,
                  discordId: account.providerAccountId,
               },
               error,
            });
            throw error;
         }
      },
   },
   callbacks: {
      session({ session, user }) {
         if (session.user) {
            session.user.id = user.id;
            session.user.role = user.role;
            session.user.discordId = user.discordId;
            session.user.displayName = user.displayName;

            if (
               user.discordId &&
               isDiscordDev(user.discordId) &&
               session.user.role !== "DEV"
            ) {
               session.user.role = "DEV";
               prisma.user
                  .update({
                     where: { id: user.id },
                     data: { role: "DEV" },
                  })
                  .catch((error) => {
                     logger.error(logEvents.authRoleSyncFailed, {
                        context: { userId: user.id, discordId: user.discordId },
                        error,
                     });
                  });
            }
         }

         return session;
      },
   },
});

export const handlers = nextAuthResult.handlers;
export const signIn = nextAuthResult.signIn;
export const signOut = nextAuthResult.signOut;
export const auth = cache(nextAuthResult.auth);
