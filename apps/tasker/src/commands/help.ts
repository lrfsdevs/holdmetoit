import {
   ActionRowBuilder,
   ComponentType,
   EmbedBuilder,
   MessageFlags,
   SlashCommandBuilder,
   StringSelectMenuBuilder,
   StringSelectMenuOptionBuilder,
} from "discord.js";
import { env } from "../config/env.js";

const PREFIX = env.DISCORD_PREFIX;

export function buildHelpEmbed(
   category: string = "all",
   userDisplayName?: string
) {
   const normalizedCategory = category.toLowerCase().trim();

   switch (normalizedCategory) {
      case "quickstart":
         return new EmbedBuilder()
            .setTitle("🚀 Tasker - Quick Start Guide")
            .setColor("#2ECC71")
            .setDescription(
               `Welcome${userDisplayName ? ` **${userDisplayName}**` : ""}! Organizing your day with Tasker is quick and simple. Follow these 4 steps:\n\n` +
                  "**1️⃣ Create a Category**\n" +
                  "Tasks are organized into categories (e.g., Work, Study, Personal):\n" +
                  `> \`/category create name:Projects\` *(or \`${PREFIX}category create Projects\`)*\n\n` +
                  "**2️⃣ Add Your Tasks**\n" +
                  "Enter task content (category is optional, defaults to **Default**):\n" +
                  `> \`/task add content:Complete report\` *(or with category: \`category:Projects\`)*\n` +
                  `> \`${PREFIX}task add Complete report\` *(or with category: \`${PREFIX}task add Projects Complete report\`)*\n\n` +
                  "**3️⃣ View Today's Tasks**\n" +
                  "Check your organized daily to-do list (no parameters needed):\n" +
                  `> \`/task list\` *(or \`${PREFIX}task list\`)*\n\n` +
                  "**4️⃣ Mark Completed, Rename, or Remove**\n" +
                  "Inline autocomplete lets you select tasks directly in the command bar:\n" +
                  `> \`/task done task:[select task]\` *(or \`${PREFIX}task done 1\`)* - Mark completed\n` +
                  `> \`/task rename task:[select task] new_content:New text\` *(or \`${PREFIX}task rename 1 New text\`)* - Rename task\n` +
                  `> \`/task remove task:[select task]\` *(or \`${PREFIX}task remove 1\`)* - Remove task`
            )
            .setFooter({
               text: `Tip: Both slash commands (/) and prefix (${PREFIX}) are supported!`,
            })
            .setTimestamp();

      case "tasks":
      case "task":
         return new EmbedBuilder()
            .setTitle("📝 Task Management Commands")
            .setColor("#3498DB")
            .setDescription(
               "Create, track, and complete your tasks with `/task`:"
            )
            .addFields(
               {
                  name: "➕ Add Task: `/task add`",
                  value:
                     "Adds a new task. The category is optional and defaults to **Default**:\n" +
                     "• **Slash:** `/task add content:Finish report` *(or with category: `category:Work`)*\n" +
                     `• **Prefix:** \`${PREFIX}task add Finish report\` *(or with category: \`${PREFIX}task add Work Finish report\`)*`,
               },
               {
                  name: "📋 List Tasks: `/task list`",
                  value:
                     "Displays all your tasks for today grouped by category. Accepts no parameters:\n" +
                     "• **Slash:** `/task list`\n" +
                     `• **Prefix:** \`${PREFIX}task list\` (or \`${PREFIX}task show\`)`,
               },
               {
                  name: "✅ Mark Done: `/task done`",
                  value:
                     "Marks a task as completed with instant task autocompletion:\n" +
                     "• **Slash:** `/task done task:[select task]`\n" +
                     `• **Prefix:** \`${PREFIX}task done 2\``,
               },
               {
                  name: "✏️ Rename Task: `/task rename`",
                  value:
                     "Renames an existing task with task autocompletion and new content:\n" +
                     "• **Slash:** `/task rename task:[select task] new_content:New title`\n" +
                     `• **Prefix:** \`${PREFIX}task rename 2 New title\` (or \`${PREFIX}task update 2 New title\`)`,
               },
               {
                  name: "🗑️ Remove Task: `/task remove`",
                  value:
                     "Permanently removes a task with instant task autocompletion:\n" +
                     "• **Slash:** `/task remove task:[select task]`\n" +
                     `• **Prefix:** \`${PREFIX}task remove 2\``,
               }
            )
            .setFooter({ text: `Use slash / commands or prefix ${PREFIX}` })
            .setTimestamp();

      case "categories":
      case "category":
      case "groups":
      case "group":
         return new EmbedBuilder()
            .setTitle("📁 Category Management Commands")
            .setColor("#E67E22")
            .setDescription(
               "Categories help you categorize and keep your tasks organized with `/category`:"
            )
            .addFields(
               {
                  name: "📁 Create Category: `/category create`",
                  value:
                     "Creates a new category for tasks:\n" +
                     "• **Slash:** `/category create name:Personal`\n" +
                     `• **Prefix:** \`${PREFIX}category create Personal\``,
               },
               {
                  name: "📄 List Categories: `/category list`",
                  value:
                     "Lists all categories you currently have created. Accepts no parameters:\n" +
                     "• **Slash:** `/category list`\n" +
                     `• **Prefix:** \`${PREFIX}category list\``,
               },
               {
                  name: "✏️ Rename Category: `/category rename`",
                  value:
                     "Renames an existing category:\n" +
                     "• **Slash:** `/category rename name:OldProjects new_name:NewProjects`\n" +
                     `• **Prefix:** \`${PREFIX}category rename OldProjects NewProjects\``,
               },
               {
                  name: "❌ Delete Category: `/category delete`",
                  value:
                     "Deletes a category and moves all tasks assigned to it into **Default**:\n" +
                     "• **Slash:** `/category delete name:Personal`\n" +
                     `• **Prefix:** \`${PREFIX}category delete Personal\``,
               }
            )
            .setFooter({ text: `Use slash / commands or prefix ${PREFIX}` })
            .setTimestamp();

      case "general":
      case "utility":
      case "utilities":
         return new EmbedBuilder()
            .setTitle("⚙️ General & Utility Commands")
            .setColor("#9B59B6")
            .setDescription("General bot utilities and information:")
            .addFields(
               {
                  name: "❓ Help Menu: `/help`",
                  value:
                     "Displays the help menu, command directory, and quick start guide.\n" +
                     "• **Slash:** `/help [category]`\n" +
                     `• **Prefix:** \`${PREFIX}help [category]\``,
               },
               {
                  name: "🏓 Ping: `/ping`",
                  value:
                     "Replies with Pong to check bot responsiveness.\n" +
                     "• **Slash:** `/ping`\n" +
                     `• **Prefix:** \`${PREFIX}ping\``,
               }
            )
            .setFooter({ text: `Use slash / commands or prefix ${PREFIX}` })
            .setTimestamp();

      case "all":
      default:
         return new EmbedBuilder()
            .setTitle("📋 Tasker - Help Menu & Command Directory")
            .setColor("#3498DB")
            .setDescription(
               `Welcome${userDisplayName ? ` **${userDisplayName}**` : ""} to **Tasker**! Your personal task & productivity manager on Discord.\n\n` +
                  `Tasker supports native **Slash Commands** (\`/task\`, \`/category\`, etc.) as well as text prefix **\`${PREFIX}\`** commands (\`${PREFIX}task\`, etc.).\n` +
                  `Use the dropdown menu below to view specific guides and detailed command syntax.`
            )
            .addFields(
               {
                  name: "🚀 Quick Start (4 Steps)",
                  value:
                     `1. \`/category create\` *(or \`${PREFIX}category create\`)* - Create a category\n` +
                     `2. \`/task add\` *(or \`${PREFIX}task add\`)* - Add a task\n` +
                     `3. \`/task list\` *(or \`${PREFIX}task list\`)* - View your checklist\n` +
                     `4. \`/task done\` *(or \`${PREFIX}task done\`)* - Mark task completed`,
               },
               {
                  name: "📝 Task Operations (`/task`)",
                  value:
                     `• \`/task add content:... [category:...]\` *(or \`${PREFIX}task add [task]\` / \`${PREFIX}task add [category] [task]\`)* - Add a task\n` +
                     `• \`/task list\` *(or \`${PREFIX}task list\`)* - View today's checklist (no parameters)\n` +
                     `• \`/task done task:...\` *(or \`${PREFIX}task done\`)* - Mark task completed via autocomplete\n` +
                     `• \`/task rename task:... new_content:...\` *(or \`${PREFIX}task rename\`)* - Rename task\n` +
                     `• \`/task remove task:...\` *(or \`${PREFIX}task remove\`)* - Remove task via autocomplete`,
               },
               {
                  name: "📁 Category Operations (`/category`)",
                  value:
                     `• \`/category create name:...\` *(or \`${PREFIX}category create\`)* - Create a category\n` +
                     `• \`/category list\` *(or \`${PREFIX}category list\`)* - List categories (no parameters)\n` +
                     `• \`/category rename name:... new_name:...\` *(or \`${PREFIX}category rename\`)* - Rename category\n` +
                     `• \`/category delete name:...\` *(or \`${PREFIX}category delete\`)* - Delete category & move tasks to Default`,
               },
               {
                  name: "⚙️ Utilities (`/ping`, `/help`)",
                  value:
                     `• \`/help\` (or \`${PREFIX}help\`) - Open this help menu\n` +
                     `• \`/ping\` (or \`${PREFIX}ping\`) - Check bot status`,
               }
            )
            .setFooter({
               text: "Select an option from the menu below for more details!",
            })
            .setTimestamp();
   }
}

export function buildSelectRow(
   selectedCategory: string = "all",
   disabled: boolean = false
) {
   const options = [
      new StringSelectMenuOptionBuilder()
         .setLabel("Overview & All Commands")
         .setValue("all")
         .setDescription("Complete command list and summary")
         .setEmoji("📋")
         .setDefault(selectedCategory === "all"),
      new StringSelectMenuOptionBuilder()
         .setLabel("Quick Start Guide")
         .setValue("quickstart")
         .setDescription("Step-by-step tutorial for new users")
         .setEmoji("🚀")
         .setDefault(selectedCategory === "quickstart"),
      new StringSelectMenuOptionBuilder()
         .setLabel("Task Management Commands")
         .setValue("tasks")
         .setDescription("Add, list, complete, and remove tasks")
         .setEmoji("📝")
         .setDefault(selectedCategory === "tasks"),
      new StringSelectMenuOptionBuilder()
         .setLabel("Category Management Commands")
         .setValue("categories")
         .setDescription("Create, list, and delete task categories")
         .setEmoji("📁")
         .setDefault(
            selectedCategory === "categories" || selectedCategory === "groups"
         ),
      new StringSelectMenuOptionBuilder()
         .setLabel("General & Utilities")
         .setValue("general")
         .setDescription("Ping and help menu commands")
         .setEmoji("⚙️")
         .setDefault(selectedCategory === "general"),
   ];

   const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("help-category-select")
      .setPlaceholder("Select a category to view details...")
      .setDisabled(disabled)
      .addOptions(options);

   return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      selectMenu
   );
}

export function setupHelpCollector(replyMessage: any, authorId: string) {
   if (
      !replyMessage ||
      typeof replyMessage.createMessageComponentCollector !== "function"
   ) {
      return;
   }

   const collector = replyMessage.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 60_000,
   });

   collector.on("collect", async (i: any) => {
      if (i.user.id !== authorId) {
         await i.reply({
            content:
               "This help menu was requested by someone else. Use `/help` to open your own menu!",
            flags: MessageFlags.Ephemeral,
         });
         return;
      }

      const selected = i.values[0] || "all";
      const updatedEmbed = buildHelpEmbed(
         selected,
         i.user.displayName ?? i.user.username
      );
      const updatedRow = buildSelectRow(selected, false);

      await i.update({
         embeds: [updatedEmbed],
         components: [updatedRow],
      });
   });

   collector.on("end", async (_collected: any, reason: string) => {
      if (reason === "messageDelete") return;
      try {
         const disabledRow = buildSelectRow("all", true);
         await replyMessage.edit({
            components: [disabledRow],
         });
      } catch {
         // Ignored if message was deleted or cannot be edited
      }
   });
}

export default {
   name: "help",
   description:
      "Displays the help menu with all available commands and getting started guide",
   data: new SlashCommandBuilder()
      .setName("help")
      .setDescription(
         "Displays the help menu with all available commands and getting started guide"
      )
      .addStringOption((option) =>
         option
            .setName("category")
            .setDescription("Optionally select a category to jump directly to")
            .setRequired(false)
            .addChoices(
               { name: "Overview & All Commands", value: "all" },
               { name: "Quick Start Guide", value: "quickstart" },
               { name: "Task Commands", value: "tasks" },
               { name: "Category Commands", value: "categories" },
               { name: "General Commands", value: "general" }
            )
      ),
   async execute(message: any, args: string[] = []) {
      const category = args[1] || "all";
      const embed = buildHelpEmbed(
         category,
         message.author?.displayName ?? message.author?.username
      );
      const row = buildSelectRow(category, false);

      const response = await message.reply({
         embeds: [embed],
         components: [row],
      });

      setupHelpCollector(response, message.author?.id);
   },
   async executeSlash(interaction: any) {
      const category = interaction.options?.getString("category") || "all";
      const embed = buildHelpEmbed(
         category,
         interaction.user?.displayName ?? interaction.user?.username
      );
      const row = buildSelectRow(category, false);

      const response = await interaction.reply({
         embeds: [embed],
         components: [row],
         withResponse: true,
      });

      const replyMessage =
         response?.resource?.message ??
         (response?.createMessageComponentCollector
            ? response
            : await interaction.fetchReply?.());
      setupHelpCollector(replyMessage, interaction.user?.id);
   },
};
