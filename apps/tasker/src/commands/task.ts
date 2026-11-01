import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { embedder } from "../lib/embed.js";
import {
   DEFAULT_CATEGORY_NAME,
   getCategories,
   getCategoryByName,
   getOrCreateDefaultCategory,
} from "../models/category.js";
import {
   createTask,
   deleteTask,
   getTaskById,
   getTasks,
   updateTaskContent,
   updateTaskStatus,
} from "../models/task.js";
import {
   requireWebUser,
   requireWebUserByDiscordId,
   resolveUserByDiscordId,
} from "../models/user.js";

async function resolveTask(
   taskInput: string,
   userId: string
): Promise<any | null> {
   if (!taskInput) return null;

   const found = await getTaskById(taskInput, userId);
   if (found) return found;

   const allTasks = await getTasks(userId);

   const num = parseInt(taskInput, 10);
   if (!isNaN(num) && num >= 1 && num <= allTasks.length) {
      return allTasks[num - 1];
   }

   const exact = allTasks.find(
      (t) => t.title.toLowerCase() === taskInput.toLowerCase()
   );
   if (exact) return exact;

   const partial = allTasks.find((t) =>
      t.title.toLowerCase().includes(taskInput.toLowerCase())
   );
   if (partial) return partial;

   return null;
}

export default {
   name: "task",
   description: "Task operations: add, list, done, remove, rename",
   data: new SlashCommandBuilder()
      .setName("task")
      .setDescription("Task operations: add, list, done, remove, rename")
      .addSubcommand((subcommand) =>
         subcommand
            .setName("add")
            .setDescription("Add a new task to a category")
            .addStringOption((option) =>
               option
                  .setName("content")
                  .setDescription("The task description/content")
                  .setRequired(true)
            )
            .addStringOption((option) =>
               option
                  .setName("category")
                  .setDescription(
                     'The category name for this task (optional, defaults to "Default")'
                  )
                  .setRequired(false)
                  .setAutocomplete(true)
            )
      )
      .addSubcommand((subcommand) =>
         subcommand
            .setName("list")
            .setDescription("List all of today's tasks grouped by category")
      )
      .addSubcommand((subcommand) =>
         subcommand
            .setName("done")
            .setDescription("Mark a task as completed")
            .addStringOption((option) =>
               option
                  .setName("task")
                  .setDescription("The task to mark as completed")
                  .setRequired(true)
                  .setAutocomplete(true)
            )
      )
      .addSubcommand((subcommand) =>
         subcommand
            .setName("remove")
            .setDescription("Remove a task")
            .addStringOption((option) =>
               option
                  .setName("task")
                  .setDescription("The task to remove")
                  .setRequired(true)
                  .setAutocomplete(true)
            )
      )
      .addSubcommand((subcommand) =>
         subcommand
            .setName("rename")
            .setDescription("Rename / edit a task")
            .addStringOption((option) =>
               option
                  .setName("task")
                  .setDescription("The task to rename")
                  .setRequired(true)
                  .setAutocomplete(true)
            )
            .addStringOption((option) =>
               option
                  .setName("new_content")
                  .setDescription("The new content for this task")
                  .setRequired(true)
            )
      ),

   async autocomplete(interaction: any) {
      const focusedOption = interaction.options.getFocused(true);

      try {
         const user = await resolveUserByDiscordId(interaction.user.id);
         if (!user) {
            await interaction.respond([]);
            return;
         }

         if (
            focusedOption.name === "category" ||
            focusedOption.name === "group"
         ) {
            const categories = await getCategories(user.id);
            const query = focusedOption.value?.toLowerCase() ?? "";
            const categoryNames = categories.map((c) => c.name);
            if (
               !categoryNames.some(
                  (name) =>
                     name.toLowerCase() === DEFAULT_CATEGORY_NAME.toLowerCase()
               )
            ) {
               categoryNames.unshift(DEFAULT_CATEGORY_NAME);
            }
            const filtered = categoryNames
               .filter((name) => name.toLowerCase().includes(query))
               .slice(0, 25);
            await interaction.respond(
               filtered.map((name) => ({ name, value: name }))
            );
         } else if (focusedOption.name === "task") {
            const subcommand = interaction.options.getSubcommand(false);
            const tasks = await getTasks(user.id);
            const query = focusedOption.value?.toLowerCase() ?? "";

            let candidateTasks = tasks;
            if (subcommand === "done") {
               const pending = tasks.filter((t) => t.status !== "COMPLETED");
               candidateTasks = pending.length > 0 ? pending : tasks;
            }

            const filtered = candidateTasks
               .filter((t) => t.title.toLowerCase().includes(query))
               .slice(0, 25);

            await interaction.respond(
               filtered.map((t) => {
                  const statusIcon = t.status === "COMPLETED" ? "✅" : "⏳";
                  const label = `${statusIcon} ${t.title}`.slice(0, 100);
                  return { name: label, value: t.id };
               })
            );
         }
      } catch (err) {
         console.error("Task autocomplete error:", err);
      }
   },

   async executeSlash(interaction: any) {
      const user = await requireWebUser(interaction);
      if (!user) return;

      const subcommand = interaction.options.getSubcommand();
      const userId = user.id;
      const userDisplayName =
         interaction.user.displayName ?? interaction.user.username;

      if (subcommand === "add") {
         const taskContent = interaction.options.getString("content")?.trim();
         const categoryName = (
            interaction.options.getString("category") ??
            interaction.options.getString("group")
         )?.trim();

         if (!taskContent) {
            await interaction.reply({
               embeds: [
                  embedder(
                     "⚠️ Please specify **content** for the task.",
                     undefined,
                     "#ff0000"
                  ),
               ],
               flags: MessageFlags.Ephemeral,
            });
            return;
         }

         let targetCategory;
         if (
            !categoryName ||
            categoryName.toLowerCase() === DEFAULT_CATEGORY_NAME.toLowerCase()
         ) {
            targetCategory = await getOrCreateDefaultCategory(userId);
         } else {
            const existingCategory = await getCategoryByName(
               userId,
               categoryName
            );
            if (!existingCategory) {
               await interaction.reply({
                  embeds: [
                     embedder(
                        `Category "${categoryName}" does not exist. Create it with \`/category create name:${categoryName}\``,
                        undefined,
                        "#ff0000"
                     ),
                  ],
                  flags: MessageFlags.Ephemeral,
               });
               return;
            }
            targetCategory = existingCategory;
         }

         await createTask(userId, taskContent, targetCategory.id);
         await interaction.reply({
            embeds: [
               embedder(
                  `Task added to **${targetCategory.name}**: **${taskContent}**`,
                  undefined,
                  "#00ff00"
               ),
            ],
         });
      } else if (subcommand === "list") {
         const tasks = await getTasks(userId);
         const categories = await getCategories(userId);
         const categoryNameById = new Map<string, string>(
            categories.map((cat) => [cat.id, cat.name])
         );

         if (tasks.length === 0) {
            await interaction.reply({
               embeds: [
                  embedder(
                     "You have no tasks for today!",
                     undefined,
                     "#00ff00"
                  ),
               ],
            });
            return;
         }

         const groupedKeys = Array.from(
            new Set(
               tasks.map(
                  (task) =>
                     categoryNameById.get(task.categoryId) ?? "Unnamed Category"
               )
            )
         ).sort();

         let taskList = "";

         for (const catName of groupedKeys) {
            taskList += `\n**📁 ${catName}**\n`;
            tasks.forEach((task, idx) => {
               const currentCatName =
                  categoryNameById.get(task.categoryId) ?? "Unnamed Category";
               if (currentCatName === catName) {
                  const status = task.status === "COMPLETED" ? "✅" : "[  ]";
                  taskList += `${idx + 1}. ${status} ${task.title}\n`;
               }
            });
         }

         await interaction.reply({
            embeds: [embedder(taskList, `${userDisplayName}'s Tasks`)],
         });
      } else if (subcommand === "done") {
         const taskInput = interaction.options.getString("task")?.trim();
         const task = await resolveTask(taskInput, userId);

         if (!task) {
            await interaction.reply({
               embeds: [
                  embedder(
                     "⚠️ Task not found. Please pick a task from the autocomplete suggestions.",
                     undefined,
                     "#ff0000"
                  ),
               ],
               flags: MessageFlags.Ephemeral,
            });
            return;
         }

         await updateTaskStatus(task.id, userId, "completed");
         await interaction.reply({
            embeds: [
               embedder(
                  `✅ Task marked as done: **${task.title}**`,
                  undefined,
                  "#00ff00"
               ),
            ],
         });
      } else if (subcommand === "remove") {
         const taskInput = interaction.options.getString("task")?.trim();
         const task = await resolveTask(taskInput, userId);

         if (!task) {
            await interaction.reply({
               embeds: [
                  embedder(
                     "⚠️ Task not found. Please pick a task from the autocomplete suggestions.",
                     undefined,
                     "#ff0000"
                  ),
               ],
               flags: MessageFlags.Ephemeral,
            });
            return;
         }

         await deleteTask(task.id, userId);
         await interaction.reply({
            embeds: [
               embedder(
                  `🗑️ Task removed: **${task.title}**`,
                  undefined,
                  "#00ff00"
               ),
            ],
         });
      } else if (subcommand === "rename") {
         const taskInput = interaction.options.getString("task")?.trim();
         const newContent = interaction.options
            .getString("new_content")
            ?.trim();

         if (!newContent) {
            await interaction.reply({
               embeds: [
                  embedder(
                     "⚠️ Please provide the new content for the task.",
                     undefined,
                     "#ff0000"
                  ),
               ],
               flags: MessageFlags.Ephemeral,
            });
            return;
         }

         const task = await resolveTask(taskInput, userId);
         if (!task) {
            await interaction.reply({
               embeds: [
                  embedder(
                     "⚠️ Task not found. Please pick a task from the autocomplete suggestions.",
                     undefined,
                     "#ff0000"
                  ),
               ],
               flags: MessageFlags.Ephemeral,
            });
            return;
         }

         const updated = await updateTaskContent(task.id, userId, newContent);
         const displayContent = updated ? updated.title : newContent;
         await interaction.reply({
            embeds: [
               embedder(
                  `✏️ Task renamed to: **${displayContent}**`,
                  undefined,
                  "#00ff00"
               ),
            ],
         });
      }
   },

   async execute(message: any, args: string[]) {
      const user = await requireWebUserByDiscordId(
         message.author.id,
         (payload) => message.reply(payload)
      );
      if (!user) return;

      const userId = user.id;
      const subcommand = args[1]?.toLowerCase();

      if (subcommand === "add") {
         if (args.length < 3) {
            await message.reply({
               embeds: [
                  embedder(
                     "Usage: `'task add [task_content]` or `'task add [category_name] [task_content]`",
                     undefined,
                     "#ff0000"
                  ),
               ],
            });
            return;
         }

         let targetCategory;
         let taskContent = "";

         const potentialCategoryName = args[2]!;
         const isDefault =
            potentialCategoryName.toLowerCase() ===
            DEFAULT_CATEGORY_NAME.toLowerCase();
         const existingCategory = isDefault
            ? null
            : await getCategoryByName(userId, potentialCategoryName);

         if ((existingCategory || isDefault) && args.length > 3) {
            targetCategory =
               existingCategory || (await getOrCreateDefaultCategory(userId));
            taskContent = args.slice(3).join(" ");
         } else {
            targetCategory = await getOrCreateDefaultCategory(userId);
            taskContent = args.slice(2).join(" ");
         }

         await createTask(userId, taskContent, targetCategory.id);
         await message.reply({
            embeds: [
               embedder(
                  `Task added to **${targetCategory.name}**: **${taskContent}**`,
                  undefined,
                  "#00ff00"
               ),
            ],
         });
      } else if (subcommand === "list" || subcommand === "show") {
         const tasks = await getTasks(userId);
         const categories = await getCategories(userId);
         const categoryNameById = new Map<string, string>(
            categories.map((cat) => [cat.id, cat.name])
         );

         if (tasks.length === 0) {
            await message.reply({
               embeds: [
                  embedder(
                     "You have no tasks for today!",
                     undefined,
                     "#00ff00"
                  ),
               ],
            });
            return;
         }

         const groupedKeys = Array.from(
            new Set(
               tasks.map(
                  (task) =>
                     categoryNameById.get(task.categoryId) ?? "Unnamed Category"
               )
            )
         ).sort();

         let taskList = "";

         for (const catName of groupedKeys) {
            taskList += `\n**📁 ${catName}**\n`;
            tasks.forEach((task, idx) => {
               const currentCatName =
                  categoryNameById.get(task.categoryId) ?? "Unnamed Category";
               if (currentCatName === catName) {
                  const status = task.status === "COMPLETED" ? "✅" : "[  ]";
                  taskList += `${idx + 1}. ${status} ${task.title}\n`;
               }
            });
         }

         await message.reply({
            embeds: [
               embedder(taskList, `${message.author.displayName}'s Tasks`),
            ],
         });
      } else if (subcommand === "done") {
         const taskIndexStr = args[2];
         if (!taskIndexStr) {
            await message.reply({
               embeds: [
                  embedder(
                     "Usage: `'task done [task number]`",
                     undefined,
                     "#ff0000"
                  ),
               ],
            });
            return;
         }
         const task = await resolveTask(taskIndexStr, userId);
         if (!task) {
            await message.reply({
               embeds: [
                  embedder(
                     `Task "${taskIndexStr}" not found.`,
                     undefined,
                     "#ff0000"
                  ),
               ],
            });
            return;
         }
         const updated = await updateTaskStatus(task.id, userId, "completed");
         if (updated)
            await message.reply({
               embeds: [
                  embedder(
                     `Task marked as done: **${updated.title}**`,
                     undefined,
                     "#00ff00"
                  ),
               ],
            });
      } else if (subcommand === "remove") {
         const taskIndexStr = args[2];
         if (!taskIndexStr) {
            await message.reply({
               embeds: [
                  embedder(
                     "Usage: `'task remove [task number]`",
                     undefined,
                     "#ff0000"
                  ),
               ],
            });
            return;
         }
         const task = await resolveTask(taskIndexStr, userId);
         if (!task) {
            await message.reply({
               embeds: [
                  embedder(
                     `Task "${taskIndexStr}" not found.`,
                     undefined,
                     "#ff0000"
                  ),
               ],
            });
            return;
         }
         const deleted = await deleteTask(task.id, userId);
         if (deleted)
            await message.reply({
               embeds: [
                  embedder(
                     `Task removed: **${task.title}**`,
                     undefined,
                     "#00ff00"
                  ),
               ],
            });
      } else if (
         subcommand === "rename" ||
         subcommand === "update" ||
         subcommand === "edit"
      ) {
         const taskIndexStr = args[2];
         const newContent = args.slice(3).join(" ");
         if (!taskIndexStr || !newContent) {
            await message.reply({
               embeds: [
                  embedder(
                     "Usage: `'task rename [task number] [new content]`",
                     undefined,
                     "#ff0000"
                  ),
               ],
            });
            return;
         }
         const task = await resolveTask(taskIndexStr, userId);
         if (!task) {
            await message.reply({
               embeds: [
                  embedder(
                     `Task "${taskIndexStr}" not found.`,
                     undefined,
                     "#ff0000"
                  ),
               ],
            });
            return;
         }
         const updated = await updateTaskContent(task.id, userId, newContent);
         if (updated)
            await message.reply({
               embeds: [
                  embedder(
                     `Task renamed to: **${updated.title}**`,
                     undefined,
                     "#00ff00"
                  ),
               ],
            });
      } else {
         await message.reply({
            embeds: [
               embedder(
                  "Unknown subcommand. Available: add, list, done, remove, rename",
                  undefined,
                  "#ff0000"
               ),
            ],
         });
      }
   },
};
