import { join } from "node:path";
import { GatewayIntentBits } from "discord.js";
import {
   createBotClient,
   installGracefulShutdown,
   installInteractionHandler,
   installMessageHandler,
   loadCommands,
   loadEvents,
   startHealthServer,
} from "@holdmetoit/discord/bot";
import { env } from "./config/env.js";
import { prisma } from "./db.js";

async function main() {
   const client = createBotClient({
      intents: [
         GatewayIntentBits.Guilds,
         GatewayIntentBits.GuildMessages,
         GatewayIntentBits.MessageContent,
      ],
   });

   client.commands = await loadCommands(join(import.meta.dirname, "commands"));

   const events = await loadEvents(join(import.meta.dirname, "events"));
   for (const event of events) {
      const handler = (...args: unknown[]) =>
         event.execute(...args, {
            client,
            prefix: env.DISCORD_PREFIX,
         });

      if (event.once) {
         client.once(event.name as any, handler as any);
      } else {
         client.on(event.name as any, handler as any);
      }
   }

   installInteractionHandler(client, { prefix: env.DISCORD_PREFIX });
   installMessageHandler(client, {
      prefix: env.DISCORD_PREFIX,
      enabled: env.DISCORD_ENABLE_PREFIX_COMMANDS,
   });

   const health = startHealthServer({ port: env.PORT, service: "tasker" });
   console.log(`🌐 Health check listening on 0.0.0.0:${env.PORT}`);

   installGracefulShutdown([
      () => health.close(),
      () => prisma.$disconnect(),
      () => client.destroy(),
   ]);

   await client.login(env.DISCORD_BOT_TOKEN);
}

main().catch((error) => {
   console.error("Failed to start tasker:", error);
   process.exit(1);
});
