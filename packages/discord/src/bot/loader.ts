import { readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { Collection } from "discord.js";
import type { BotCommand, BotEvent } from "./types.js";

const MODULE_EXTENSIONS = new Set([".ts", ".js", ".mjs", ".cjs"]);

async function listModuleFiles(directory: string): Promise<string[]> {
   const entries = await readdir(directory, { withFileTypes: true });
   return entries
      .filter(
         (entry) => entry.isFile() && MODULE_EXTENSIONS.has(extname(entry.name))
      )
      .map((entry) => join(directory, entry.name))
      .sort();
}

export async function loadCommands(
   directory: string
): Promise<Collection<string, BotCommand>> {
   const commands = new Collection<string, BotCommand>();

   for (const file of await listModuleFiles(directory)) {
      const module = await import(pathToFileURL(file).href);
      const command = (module.default ?? module) as BotCommand;
      if (!command?.name) continue;
      commands.set(command.name, command);
   }

   return commands;
}

export async function loadEvents(directory: string): Promise<BotEvent[]> {
   const events: BotEvent[] = [];

   for (const file of await listModuleFiles(directory)) {
      const module = await import(pathToFileURL(file).href);
      const event = (module.default ?? module) as BotEvent;
      if (!event?.name || typeof event.execute !== "function") continue;
      events.push(event);
   }

   return events;
}
