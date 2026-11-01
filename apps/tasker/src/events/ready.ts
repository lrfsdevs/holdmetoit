import { Events, type Client } from "discord.js";
import { deploySlashCommands } from "@holdmetoit/discord/bot";
import { env } from "../config/env.js";
import { prisma } from "../db.js";

export default {
   name: Events.ClientReady,
   once: true,
   async execute(client: Client & { commands?: any }) {
      console.log(`Logged in as ${client.user?.tag} (ID: ${client.user?.id})`);

      await prisma.$connect();
      console.log("✅ Connected to PostgreSQL successfully");

      if (!env.DISCORD_REGISTER_COMMANDS_ON_READY) return;

      try {
         const commands = client.commands ? [...client.commands.values()] : [];

         const payloads = await deploySlashCommands({
            commands,
            mode: env.DISCORD_GUILD_ID ? "guild" : "global",
            guildId: env.DISCORD_GUILD_ID,
         });

         console.log(
            `✅ Registered ${payloads.length} slash commands ${
               env.DISCORD_GUILD_ID
                  ? `to guild ${env.DISCORD_GUILD_ID}`
                  : "globally"
            }.`
         );
      } catch (error) {
         console.error("Failed to register slash commands on ready:", error);
      }
   },
};
