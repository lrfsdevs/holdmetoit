import {
   Events,
   MessageFlags,
   type Interaction,
   type Message,
   type MessageComponentInteraction,
   type ModalSubmitInteraction,
} from "discord.js";
import type { BotClient, BotContext } from "./types.js";

export interface InteractionHandlerHooks {
   onComponent?(
      interaction: MessageComponentInteraction,
      ctx: BotContext
   ): Promise<boolean | void> | boolean | void;
   onModal?(
      interaction: ModalSubmitInteraction,
      ctx: BotContext
   ): Promise<boolean | void> | boolean | void;
}

export interface InteractionHandlerOptions {
   prefix?: string;
   hooks?: InteractionHandlerHooks;
}

export function installInteractionHandler(
   client: BotClient,
   options: InteractionHandlerOptions = {}
): void {
   const ctx: BotContext = { client, prefix: options.prefix ?? "'" };

   client.on(Events.InteractionCreate, async (interaction: Interaction) => {
      if (interaction.isAutocomplete()) {
         const command = client.commands.get(interaction.commandName);
         if (!command?.autocomplete) return;

         try {
            await command.autocomplete(interaction, ctx);
         } catch (error) {
            console.error("Autocomplete error:", error);
            if (!interaction.responded) {
               await interaction.respond([]).catch(() => {});
            }
         }
         return;
      }

      if (interaction.isMessageComponent()) {
         const handled = await options.hooks?.onComponent?.(interaction, ctx);
         if (handled) return;
      }

      if (interaction.isModalSubmit()) {
         const handled = await options.hooks?.onModal?.(interaction, ctx);
         if (handled) return;
      }

      if (!interaction.isChatInputCommand()) return;

      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
         if (command.executeSlash) {
            await command.executeSlash(interaction, ctx);
         } else if (command.execute) {
            await command.execute(interaction as unknown as Message, [], ctx);
         }
      } catch (error) {
         console.error("Interaction error:", error);
         const payload = {
            content: "There was an error while executing this command.",
            flags: MessageFlags.Ephemeral,
         } as const;
         if (interaction.replied || interaction.deferred) {
            await Promise.resolve(interaction.followUp(payload)).catch(
               () => {}
            );
         } else {
            await Promise.resolve(interaction.reply(payload)).catch(() => {});
         }
      }
   });
}

export interface MessageHandlerOptions {
   prefix?: string;
   enabled?: boolean;
}

export function installMessageHandler(
   client: BotClient,
   options: MessageHandlerOptions = {}
): void {
   const { prefix = "'", enabled = true } = options;
   if (!enabled) return;

   client.on(Events.MessageCreate, async (message: Message) => {
      if (message.author.bot) return;
      if (!message.content.startsWith(prefix)) return;

      const args = message.content.slice(prefix.length).trim().split(/\s+/);
      const commandName = args[0]?.toLowerCase();
      if (!commandName) return;

      const command = client.commands.get(commandName);
      if (!command?.execute) return;

      try {
         await command.execute(message, args, { client, prefix });
      } catch (error) {
         console.error("Command error:", error);
         await Promise.resolve(
            message.reply("There was an error while executing that command.")
         ).catch(() => {});
      }
   });
}
