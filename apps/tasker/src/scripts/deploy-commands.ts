import { join } from "node:path";
import { deploySlashCommands, loadCommands } from "@holdmetoit/discord/bot";
import { env } from "../config/env.js";

interface CliOptions {
   global: boolean;
   clear: boolean;
   guildId?: string;
}

export function parseArgs(argv: string[]): CliOptions {
   const options: CliOptions = { global: false, clear: false };

   for (let index = 0; index < argv.length; index++) {
      const arg = argv[index];

      if (arg === "--global") {
         options.global = true;
      } else if (arg === "--clear") {
         options.clear = true;
      } else if (arg === "--guild") {
         options.guildId = argv[index + 1]?.trim();
         index++;
      }
   }

   return options;
}

async function main() {
   const options = parseArgs(process.argv.slice(2));
   const commands = await loadCommands(
      join(import.meta.dirname, "..", "commands")
   );

   const guildId = options.global
      ? undefined
      : (options.guildId ?? env.DISCORD_GUILD_ID);
   const mode = guildId ? "guild" : "global";

   const payloads = await deploySlashCommands({
      commands: [...commands.values()],
      mode,
      guildId,
      clear: options.clear,
   });

   if (options.clear) {
      console.log(
         `🧹 Cleared ${mode === "guild" ? `guild ${guildId}` : "global"} slash commands.`
      );
      return;
   }

   console.log(
      `✅ Registered ${payloads.length} slash commands ${
         mode === "guild" ? `to guild ${guildId}` : "globally"
      }.`
   );
}

main().catch((error) => {
   console.error("Failed to deploy slash commands:", error);
   process.exit(1);
});
