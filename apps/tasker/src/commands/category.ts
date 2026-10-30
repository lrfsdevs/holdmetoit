import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { embedder } from "../lib/embed.js";
import {
   DEFAULT_CATEGORY_NAME,
   DefaultCategoryDeletionError,
   DuplicateCategoryError,
   createCategory,
   deleteCategory,
   getCategories,
   updateCategoryName,
} from "../models/category.js";
import {
   requireWebUser,
   requireWebUserByDiscordId,
   resolveUserByDiscordId,
} from "../models/user.js";

export default {
   name: "category",
   description: "Category operations: create, list, delete, rename",
   data: new SlashCommandBuilder()
      .setName("category")
      .setDescription("Category operations: create, list, delete, rename")
      .addSubcommand((subcommand) =>
         subcommand
            .setName("create")
            .setDescription("Create a new category")
            .addStringOption((option) =>
               option
                  .setName("name")
                  .setDescription("The name of the category to create")
                  .setRequired(true)
            )
      )
      .addSubcommand((subcommand) =>
         subcommand.setName("list").setDescription("List all your categories")
      )
      .addSubcommand((subcommand) =>
         subcommand
            .setName("delete")
            .setDescription("Delete a category and move its tasks to Default")
            .addStringOption((option) =>
               option
                  .setName("name")
                  .setDescription("The name of the category to delete")
                  .setRequired(true)
                  .setAutocomplete(true)
            )
      )
      .addSubcommand((subcommand) =>
         subcommand
            .setName("rename")
            .setDescription("Rename an existing category")
            .addStringOption((option) =>
               option
                  .setName("name")
                  .setDescription("The current category name")
                  .setRequired(true)
                  .setAutocomplete(true)
            )
            .addStringOption((option) =>
               option
                  .setName("new_name")
                  .setDescription("The new name for the category")
                  .setRequired(true)
            )
      ),

   async autocomplete(interaction: any) {
      const focusedOption = interaction.options.getFocused(true);
      if (focusedOption.name !== "name") return;

      try {
         const user = await resolveUserByDiscordId(interaction.user.id);
         if (!user) {
            await interaction.respond([]);
            return;
         }

         const categories = await getCategories(user.id);
         const query = focusedOption.value?.toLowerCase() ?? "";
         const filtered = categories
            .filter((c) => c.name.toLowerCase().includes(query))
            .slice(0, 25);
         await interaction.respond(
            filtered.map((c) => ({ name: c.name, value: c.name }))
         );
      } catch (err) {
         console.error("Category autocomplete error:", err);
      }
   },

   async executeSlash(interaction: any) {
      const user = await requireWebUser(interaction);
      if (!user) return;

      const subcommand = interaction.options.getSubcommand();
      const userId = user.id;
      const userDisplayName =
         interaction.user.displayName ?? interaction.user.username;

      if (subcommand === "create") {
         const categoryName = interaction.options.getString("name")?.trim();
         if (!categoryName) {
            await interaction.reply({
               embeds: [
                  embedder(
                     "Please specify a valid category name.",
                     undefined,
                     "#ff0000"
                  ),
               ],
               flags: MessageFlags.Ephemeral,
            });
            return;
         }

         try {
            await createCategory(userId, categoryName);
         } catch (error) {
            if (error instanceof DuplicateCategoryError) {
               await interaction.reply({
                  embeds: [embedder(error.message, undefined, "#ff0000")],
                  flags: MessageFlags.Ephemeral,
               });
               return;
            }
            throw error;
         }

         await interaction.reply({
            embeds: [
               embedder(
                  `Category **${categoryName}** created successfully!`,
                  undefined,
                  "#00ff00"
               ),
            ],
         });
      } else if (subcommand === "list") {
         const categories = await getCategories(userId);
         if (categories.length === 0) {
            await interaction.reply({
               embeds: [
                  embedder(
                     "You have no categories yet. Create one with `/category create [name]`",
                     undefined,
                     "#00ff00"
                  ),
               ],
            });
            return;
         }

         let categoryList = "";
         categories.forEach((cat, index) => {
            categoryList += `${index + 1}. **${cat.name}**\n`;
         });
         await interaction.reply({
            embeds: [embedder(categoryList, `${userDisplayName}'s Categories`)],
         });
      } else if (subcommand === "delete") {
         const categoryName = interaction.options.getString("name")?.trim();
         if (!categoryName) {
            await interaction.reply({
               embeds: [
                  embedder(
                     "Please specify a category name to delete.",
                     undefined,
                     "#ff0000"
                  ),
               ],
               flags: MessageFlags.Ephemeral,
            });
            return;
         }

         const categories = await getCategories(userId);
         const categoryToDelete = categories.find(
            (c) => c.name.toLowerCase() === categoryName.toLowerCase()
         );
         if (!categoryToDelete) {
            await interaction.reply({
               embeds: [
                  embedder(
                     `Category "${categoryName}" not found.`,
                     undefined,
                     "#ff0000"
                  ),
               ],
               flags: MessageFlags.Ephemeral,
            });
            return;
         }

         try {
            const deleted = await deleteCategory(categoryToDelete.id);
            if (deleted) {
               await interaction.reply({
                  embeds: [
                     embedder(
                        `Category **${categoryName}** deleted and its tasks were moved to **${DEFAULT_CATEGORY_NAME}**!`,
                        undefined,
                        "#00ff00"
                     ),
                  ],
               });
            }
         } catch (error) {
            if (error instanceof DefaultCategoryDeletionError) {
               await interaction.reply({
                  embeds: [embedder(error.message, undefined, "#ff0000")],
                  flags: MessageFlags.Ephemeral,
               });
               return;
            }
            throw error;
         }
      } else if (subcommand === "rename") {
         const oldName = interaction.options.getString("name")?.trim();
         const newName = interaction.options.getString("new_name")?.trim();
         if (!oldName || !newName) {
            await interaction.reply({
               embeds: [
                  embedder(
                     "Please specify both the current category name and the new name.",
                     undefined,
                     "#ff0000"
                  ),
               ],
               flags: MessageFlags.Ephemeral,
            });
            return;
         }

         try {
            const renamed = await updateCategoryName(userId, oldName, newName);
            if (!renamed) {
               await interaction.reply({
                  embeds: [
                     embedder(
                        `Category "${oldName}" not found.`,
                        undefined,
                        "#ff0000"
                     ),
                  ],
                  flags: MessageFlags.Ephemeral,
               });
               return;
            }

            await interaction.reply({
               embeds: [
                  embedder(
                     `Category **${oldName}** renamed to **${newName}**!`,
                     undefined,
                     "#00ff00"
                  ),
               ],
            });
         } catch (error) {
            if (error instanceof DuplicateCategoryError) {
               await interaction.reply({
                  embeds: [embedder(error.message, undefined, "#ff0000")],
                  flags: MessageFlags.Ephemeral,
               });
               return;
            }
            throw error;
         }
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

      if (subcommand === "create") {
         const categoryName = args[2];
         if (!categoryName) {
            await message.reply({
               embeds: [
                  embedder(
                     "Usage: `'category create [category_name]`",
                     undefined,
                     "#ff0000"
                  ),
               ],
            });
            return;
         }

         try {
            await createCategory(userId, categoryName);
         } catch (error) {
            if (error instanceof DuplicateCategoryError) {
               await message.reply({
                  embeds: [embedder(error.message, undefined, "#ff0000")],
               });
               return;
            }
            throw error;
         }

         await message.reply({
            embeds: [
               embedder(
                  `Category **${categoryName}** created successfully!`,
                  undefined,
                  "#00ff00"
               ),
            ],
         });
      } else if (subcommand === "list") {
         const categories = await getCategories(userId);
         if (categories.length === 0) {
            await message.reply({
               embeds: [
                  embedder(
                     "You have no categories yet. Create one with `'category create [category_name]`",
                     undefined,
                     "#00ff00"
                  ),
               ],
            });
            return;
         }

         let categoryList = "";
         categories.forEach((cat, index) => {
            categoryList += `${index + 1}. **${cat.name}**\n`;
         });
         await message.reply({
            embeds: [
               embedder(
                  categoryList,
                  `${message.author.displayName}'s Categories`
               ),
            ],
         });
      } else if (subcommand === "delete") {
         const categoryName = args[2];
         if (!categoryName) {
            await message.reply({
               embeds: [
                  embedder(
                     "Usage: `'category delete [category_name]`",
                     undefined,
                     "#ff0000"
                  ),
               ],
            });
            return;
         }

         const categories = await getCategories(userId);
         const categoryToDelete = categories.find(
            (c) => c.name.toLowerCase() === categoryName.toLowerCase()
         );
         if (!categoryToDelete) {
            await message.reply({
               embeds: [
                  embedder(
                     `Category "${categoryName}" not found.`,
                     undefined,
                     "#ff0000"
                  ),
               ],
            });
            return;
         }

         try {
            const deleted = await deleteCategory(categoryToDelete.id);
            if (deleted) {
               await message.reply({
                  embeds: [
                     embedder(
                        `Category **${categoryName}** deleted and its tasks were moved to **${DEFAULT_CATEGORY_NAME}**!`,
                        undefined,
                        "#00ff00"
                     ),
                  ],
               });
            }
         } catch (error) {
            if (error instanceof DefaultCategoryDeletionError) {
               await message.reply({
                  embeds: [embedder(error.message, undefined, "#ff0000")],
               });
               return;
            }
            throw error;
         }
      } else if (subcommand === "rename") {
         const oldName = args[2];
         const newName = args[3];
         if (!oldName || !newName) {
            await message.reply({
               embeds: [
                  embedder(
                     "Usage: `'category rename [old_category_name] [new_category_name]`",
                     undefined,
                     "#ff0000"
                  ),
               ],
            });
            return;
         }

         try {
            const renamed = await updateCategoryName(userId, oldName, newName);
            if (!renamed) {
               await message.reply({
                  embeds: [
                     embedder(
                        `Category "${oldName}" not found.`,
                        undefined,
                        "#ff0000"
                     ),
                  ],
               });
               return;
            }

            await message.reply({
               embeds: [
                  embedder(
                     `Category **${oldName}** renamed to **${newName}**!`,
                     undefined,
                     "#00ff00"
                  ),
               ],
            });
         } catch (error) {
            if (error instanceof DuplicateCategoryError) {
               await message.reply({
                  embeds: [embedder(error.message, undefined, "#ff0000")],
               });
               return;
            }
            throw error;
         }
      } else {
         await message.reply({
            embeds: [
               embedder(
                  "Unknown subcommand. Available: create, list, delete, rename",
                  undefined,
                  "#ff0000"
               ),
            ],
         });
      }
   },
};
