import { Client, Collection } from "discord.js";
import type { BotClient } from "./types.js";

export interface CreateBotClientOptions {
   intents: ConstructorParameters<typeof Client>[0]["intents"];
}

export function createBotClient(options: CreateBotClientOptions): BotClient {
   const client = new Client({ intents: options.intents }) as BotClient;
   client.commands = new Collection();
   return client;
}
