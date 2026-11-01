import { REST, Routes } from "discord.js";
import {
   MISSING_TOKEN_ERROR,
   createDiscordRest,
   getDiscordToken,
} from "../rest.js";
import type { BotCommand } from "./types.js";

export type SlashCommandSource = Pick<BotCommand, "data">;

export interface DeploySlashCommandsOptions {
   commands: SlashCommandSource[];
   mode: "guild" | "global";
   guildId?: string;
   token?: string;
   rest?: REST;
   clear?: boolean;
}

export function toSlashCommandPayloads(
   commands: SlashCommandSource[]
): unknown[] {
   return commands
      .map((command) => {
         if (!command.data) return null;
         return typeof command.data.toJSON === "function"
            ? command.data.toJSON()
            : command.data;
      })
      .filter((payload): payload is unknown => payload !== null);
}

export async function deploySlashCommands(
   options: DeploySlashCommandsOptions
): Promise<unknown[]> {
   const token = options.token ?? getDiscordToken();
   if (!token) throw new Error(MISSING_TOKEN_ERROR);

   if (options.mode === "guild" && !options.guildId) {
      throw new Error("A guildId is required to deploy guild commands.");
   }

   const rest = options.rest ?? createDiscordRest(token);
   const payloads = options.clear
      ? []
      : toSlashCommandPayloads(options.commands);

   const application = (await rest.get(Routes.oauth2CurrentApplication())) as {
      id: string;
   };

   const route =
      options.mode === "guild"
         ? Routes.applicationGuildCommands(application.id, options.guildId!)
         : Routes.applicationCommands(application.id);

   await rest.put(route, { body: payloads });

   return payloads;
}
