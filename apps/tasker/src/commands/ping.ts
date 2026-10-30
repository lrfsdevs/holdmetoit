import { SlashCommandBuilder } from "discord.js";

export default {
   name: "ping",
   description: "Replies with Pong",
   data: new SlashCommandBuilder()
      .setName("ping")
      .setDescription("Replies with Pong"),
   async execute(message: any) {
      await message.reply("Pong!");
   },
   async executeSlash(interaction: any) {
      await interaction.reply("Pong!");
   },
};
