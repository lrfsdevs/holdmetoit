import type {
   AutocompleteInteraction,
   ChatInputCommandInteraction,
   Client,
   Collection,
   Message,
} from "discord.js";

export interface BotContext {
   client: BotClient;
   prefix: string;
}

export interface BotCommand {
   name: string;
   description?: string;
   data?: { toJSON(): unknown };
   executeSlash?(
      interaction: ChatInputCommandInteraction,
      ctx: BotContext
   ): Promise<unknown>;
   execute?(
      message: Message,
      args: string[],
      ctx: BotContext
   ): Promise<unknown>;
   autocomplete?(
      interaction: AutocompleteInteraction,
      ctx: BotContext
   ): Promise<unknown>;
}

export interface BotEvent {
   name: string;
   once?: boolean;
   execute(...args: any[]): Promise<unknown>;
}

export type BotClient = Client & {
   commands: Collection<string, BotCommand>;
};
