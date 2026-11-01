import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { fetchAndSanitizeMessages } from "../lib/message-fetcher.js";
import {
   formatSummaryEmbed,
   generateSummary,
   resolveApiKeys,
} from "../lib/summarizer.js";

export default {
   name: "yapperize",
   description: "Summarize recent channel chatter with Gemini",
   data: new SlashCommandBuilder()
      .setName("yapperize")
      .setDescription("Summarize recent channel chatter with Gemini")
      .addStringOption((option) =>
         option
            .setName("channel")
            .setDescription(
               "Channel to summarize (defaults to current channel)"
            )
            .setAutocomplete(true)
            .setRequired(false)
      )
      .addStringOption((option) =>
         option
            .setName("timeframe")
            .setDescription(
               'Temporal boundary (e.g., "2 hours ago", "yesterday", "30 minutes ago")'
            )
            .setRequired(false)
      )
      .addStringOption((option) =>
         option
            .setName("message_id")
            .setDescription("Discord message Snowflake ID to summarize after")
            .setRequired(false)
      )
      .addIntegerOption((option) =>
         option
            .setName("limit")
            .setDescription(
               "Maximum number of messages to fetch (default: 100, max: 500)"
            )
            .setMinValue(1)
            .setMaxValue(500)
            .setRequired(false)
      ),

   async autocomplete(interaction: any) {
      const focusedOption = interaction.options.getFocused(true);

      if (focusedOption.name === "channel") {
         try {
            if (!interaction.guild) {
               await interaction.respond([]);
               return;
            }

            const query =
               focusedOption.value?.toLowerCase().replace(/^#/, "") ?? "";
            const channels = interaction.guild.channels.cache;
            const eligibleChannels: { name: string; value: string }[] = [];

            for (const [, ch] of channels) {
               if (
                  !ch ||
                  typeof ch.isTextBased !== "function" ||
                  !ch.isTextBased()
               )
                  continue;
               if (typeof ch.isDMBased === "function" && ch.isDMBased())
                  continue;

               const botPermissions = ch.permissionsFor?.(
                  interaction.client.user
               );
               if (
                  botPermissions &&
                  !botPermissions.has(["ViewChannel", "ReadMessageHistory"])
               ) {
                  continue;
               }

               const userPermissions = ch.permissionsFor?.(interaction.user);
               if (userPermissions && !userPermissions.has("ViewChannel")) {
                  continue;
               }

               const chName = ch.name ? `#${ch.name}` : `#${ch.id}`;
               if (
                  chName.toLowerCase().includes(query) ||
                  ch.id.includes(query)
               ) {
                  eligibleChannels.push({
                     name: chName.slice(0, 100),
                     value: ch.id,
                  });
               }

               if (eligibleChannels.length >= 25) break;
            }

            await interaction.respond(eligibleChannels);
         } catch (err) {
            console.error("[yapperize] Channel autocomplete error:", err);
         }
      }
   },

   async executeSlash(interaction: ChatInputCommandInteraction) {
      try {
         await interaction.deferReply();
      } catch (deferErr: any) {
         if (deferErr?.code === 10062) {
            console.warn(
               "[yapperize] Interaction expired before deferReply (10062)."
            );
            return;
         }
         throw deferErr;
      }

      try {
         if (resolveApiKeys().length === 0) {
            await interaction.editReply({
               content:
                  "⚠️ **Configuration Error**: `GEMINI_API_KEY` is not configured in the `.env` file. Please set it to enable AI summarization.",
            });
            return;
         }

         const channelInput = interaction.options.getString("channel");
         let targetChannel: any = interaction.channel;

         if (channelInput) {
            const cleanedId = channelInput.replace(/[<#>]/g, "").trim();

            if (interaction.guild) {
               targetChannel =
                  interaction.guild.channels.cache.get(cleanedId) ||
                  interaction.guild.channels.cache.find(
                     (c: any) =>
                        c.name?.toLowerCase() ===
                        channelInput.toLowerCase().replace(/^#/, "")
                  ) ||
                  (await interaction.guild.channels
                     .fetch(cleanedId)
                     .catch(() => null));
            } else if (interaction.client) {
               targetChannel = await interaction.client.channels
                  .fetch(cleanedId)
                  .catch(() => null);
            }

            if (
               !targetChannel ||
               typeof targetChannel.isTextBased !== "function" ||
               !targetChannel.isTextBased()
            ) {
               await interaction.editReply({
                  content: `❌ Could not find a valid text channel matching "${channelInput}". Make sure the channel exists and the bot has access to it.`,
               });
               return;
            }

            const botPerms = targetChannel.permissionsFor?.(
               interaction.client.user
            );
            if (
               botPerms &&
               !botPerms.has(["ViewChannel", "ReadMessageHistory"])
            ) {
               await interaction.editReply({
                  content: `⚠️ The bot does not have permission to view or read messages in ${targetChannel}. Please check bot permissions.`,
               });
               return;
            }

            const userPerms = targetChannel.permissionsFor?.(interaction.user);
            if (userPerms && !userPerms.has("ViewChannel")) {
               await interaction.editReply({
                  content: `⚠️ You do not have permission to view messages in ${targetChannel}.`,
               });
               return;
            }
         }

         if (!targetChannel || !("messages" in targetChannel)) {
            await interaction.editReply({
               content:
                  "❌ This command can only be used in text channels where messages can be read.",
            });
            return;
         }

         const timeframe =
            interaction.options.getString("timeframe") || undefined;
         const messageId =
            interaction.options.getString("message_id") || undefined;
         const limit = interaction.options.getInteger("limit") ?? 100;

         const { messages, totalScanned, boundaryDate } =
            await fetchAndSanitizeMessages(targetChannel, {
               timeframe,
               messageId,
               limit,
            });

         const channelDisplay = targetChannel.name
            ? `#${targetChannel.name}`
            : "this channel";

         if (messages.length === 0) {
            let emptyNotice = `ℹ️ No eligible user messages were found to summarize in ${channelDisplay}.`;
            if (boundaryDate) {
               emptyNotice += ` (Since ${boundaryDate.toLocaleString()})`;
            } else if (totalScanned > 0) {
               emptyNotice += ` (${totalScanned} scanned messages were filtered out as bot/system/empty payloads).`;
            }
            await interaction.editReply({ content: emptyNotice });
            return;
         }

         const summaryResult = await generateSummary(messages);

         const channelName =
            "name" in targetChannel ? targetChannel.name : undefined;
         const embed = formatSummaryEmbed(
            summaryResult,
            messages.length,
            channelName
         );

         await interaction.editReply({ embeds: [embed] });
      } catch (err: any) {
         const errorCode = err?.code ?? err?.rawError?.code;

         if (errorCode === 10062 || errorCode === 10008) {
            console.warn(
               `[yapperize] Ignored transient Discord error [${errorCode}]:`,
               err.message
            );
            return;
         }

         if (errorCode === 50001) {
            console.error(
               "[yapperize] Missing channel access permission (50001):",
               err
            );
            if (interaction.deferred || interaction.replied) {
               await interaction
                  .editReply({
                     content:
                        '⚠️ **Missing Access (50001)**: The bot does not have permission to access the target channel or read its message history. Please check channel permissions for "View Channel" and "Read Message History".',
                  })
                  .catch(() => {});
            }
            return;
         }

         console.error("[yapperize] Command execution failed:", err);
         const userMessage =
            err instanceof Error
               ? err.message
               : "An unexpected error occurred.";
         if (interaction.deferred || interaction.replied) {
            await interaction
               .editReply({
                  content: `❌ **Failed to yapperize channel**: ${userMessage}`,
               })
               .catch(() => {});
         }
      }
   },

   async execute(message: any, args: string[]) {
      await message.reply(
         "💡 The `yapperize` feature is available as a slash command! Use `/yapperize` with optional `channel`, `timeframe`, `message_id`, and `limit` options."
      );
   },
};
