import type { User } from "@prisma/client";
import {
   MessageFlags,
   type ChatInputCommandInteraction,
   type InteractionReplyOptions,
} from "discord.js";
import { env } from "../config/env.js";
import { prisma } from "../db.js";

export type { User };

type ReplyFn = (payload: {
   content: string;
   flags?: number;
}) => Promise<unknown>;

export async function resolveUserByDiscordId(
   discordId: string
): Promise<User | null> {
   return prisma.user.findUnique({ where: { discordId } });
}

export function buildSignInPrompt(): string {
   return `🔐 Sign in with Discord at ${env.WEB_APP_URL} first, then run this command again.`;
}

export async function requireWebUserByDiscordId(
   discordId: string,
   reply: ReplyFn
): Promise<User | null> {
   const user = await resolveUserByDiscordId(discordId);
   if (user) return user;

   await reply({
      content: buildSignInPrompt(),
   });
   return null;
}

export async function requireWebUser(
   interaction: ChatInputCommandInteraction
): Promise<User | null> {
   return requireWebUserByDiscordId(interaction.user.id, (payload) => {
      const ephemeralPayload: InteractionReplyOptions = {
         ...payload,
         flags: MessageFlags.Ephemeral,
      };
      if (interaction.replied || interaction.deferred) {
         return interaction.followUp(ephemeralPayload);
      }
      return interaction.reply(ephemeralPayload);
   });
}
