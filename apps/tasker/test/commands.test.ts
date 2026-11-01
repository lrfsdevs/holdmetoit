import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
   class DuplicateCategoryError extends Error {
      constructor(name: string) {
         super(`Category "${name}" already exists.`);
      }
   }
   class DefaultCategoryDeletionError extends Error {
      constructor() {
         super("The Default category cannot be deleted.");
      }
   }

   return {
      DuplicateCategoryError,
      DefaultCategoryDeletionError,
      createCategory: vi.fn(),
      getCategories: vi.fn(),
      getCategoryByName: vi.fn(),
      getOrCreateDefaultCategory: vi.fn(),
      getCategoryById: vi.fn(),
      categoryExists: vi.fn(),
      deleteCategory: vi.fn(),
      updateCategoryName: vi.fn(),
      createTask: vi.fn(),
      getTasks: vi.fn(),
      getTaskById: vi.fn(),
      updateTaskStatus: vi.fn(),
      deleteTask: vi.fn(),
      updateTaskContent: vi.fn(),
      resolveUserByDiscordId: vi.fn(),
      requireWebUser: vi.fn(),
      requireWebUserByDiscordId: vi.fn(),
   };
});

vi.mock("../src/models/category.js", () => ({
   DEFAULT_CATEGORY_NAME: "Default",
   DuplicateCategoryError: mocks.DuplicateCategoryError,
   DefaultCategoryDeletionError: mocks.DefaultCategoryDeletionError,
   createCategory: mocks.createCategory,
   getCategories: mocks.getCategories,
   getCategoryByName: mocks.getCategoryByName,
   getOrCreateDefaultCategory: mocks.getOrCreateDefaultCategory,
   getCategoryById: mocks.getCategoryById,
   categoryExists: mocks.categoryExists,
   deleteCategory: mocks.deleteCategory,
   updateCategoryName: mocks.updateCategoryName,
}));

vi.mock("../src/models/task.js", () => ({
   createTask: mocks.createTask,
   getTasks: mocks.getTasks,
   getTaskById: mocks.getTaskById,
   updateTaskStatus: mocks.updateTaskStatus,
   deleteTask: mocks.deleteTask,
   updateTaskContent: mocks.updateTaskContent,
}));

vi.mock("../src/models/user.js", () => ({
   resolveUserByDiscordId: mocks.resolveUserByDiscordId,
   requireWebUser: mocks.requireWebUser,
   requireWebUserByDiscordId: mocks.requireWebUserByDiscordId,
   buildSignInPrompt: () => "Sign in with Discord first.",
}));

import {
   deploySlashCommands,
   installInteractionHandler,
} from "@holdmetoit/discord/bot";
import categoryCommand from "../src/commands/category.js";
import helpCommand from "../src/commands/help.js";
import pingCommand from "../src/commands/ping.js";
import taskCommand from "../src/commands/task.js";

const USER = { id: "user-1", discordId: "test-user-1", role: "PARTICIPANT" };

beforeEach(() => {
   vi.clearAllMocks();

   mocks.requireWebUser.mockResolvedValue(USER);
   mocks.requireWebUserByDiscordId.mockResolvedValue(USER);
   mocks.resolveUserByDiscordId.mockResolvedValue(USER);

   mocks.createCategory.mockImplementation(
      async (userId: string, name: string) => ({
         id: "category-1",
         userId,
         name,
      })
   );
   mocks.getCategories.mockResolvedValue([{ id: "123", name: "Projects" }]);
   mocks.getCategoryByName.mockImplementation(
      async (_userId: string, name: string) =>
         name.toLowerCase() === "projects"
            ? { id: "123", name: "Projects" }
            : null
   );
   mocks.getOrCreateDefaultCategory.mockResolvedValue({
      id: "default-id-123",
      name: "Default",
   });
   mocks.deleteCategory.mockResolvedValue(true);
   mocks.updateCategoryName.mockResolvedValue(true);

   mocks.createTask.mockImplementation(
      async (userId: string, title: string, categoryId: string) => ({
         id: "task-new",
         userId,
         title,
         categoryId,
      })
   );
   mocks.getTasks.mockResolvedValue([
      {
         id: "507f1f77bcf86cd799439011",
         title: "Test task",
         status: "TODO",
         categoryId: "123",
      },
   ]);
   mocks.getTaskById.mockResolvedValue({
      id: "507f1f77bcf86cd799439011",
      title: "Test task",
      status: "TODO",
   });
   mocks.updateTaskStatus.mockImplementation(
      async (_id: string, _uid: string, status: string) => ({
         id: "507f1f77bcf86cd799439011",
         title: "Test task",
         status,
      })
   );
   mocks.deleteTask.mockResolvedValue(true);
   mocks.updateTaskContent.mockImplementation(
      async (_id: string, _uid: string, title: string) => ({
         id: "507f1f77bcf86cd799439011",
         title,
         status: "TODO",
      })
   );
});

describe("Category Slash Command Structure & Data", () => {
   it("exports four subcommands with the expected options", () => {
      expect(categoryCommand.name).toBe("category");
      const json = categoryCommand.data.toJSON();
      expect(json.name).toBe("category");
      expect(json.options).toHaveLength(4);

      const subcommands = json.options?.map((opt: any) => opt.name) ?? [];
      expect(subcommands).toEqual(
         expect.arrayContaining(["create", "list", "delete", "rename"])
      );

      const listSub = json.options?.find(
         (opt: any) => opt.name === "list"
      ) as any;
      expect(listSub.options ?? []).toHaveLength(0);

      const createSub = json.options?.find(
         (opt: any) => opt.name === "create"
      ) as any;
      expect(createSub.options).toHaveLength(1);
      expect(createSub.options[0].name).toBe("name");

      const deleteSub = json.options?.find(
         (opt: any) => opt.name === "delete"
      ) as any;
      expect(deleteSub.options).toHaveLength(1);
      expect(deleteSub.options[0].autocomplete).toBe(true);

      const renameSub = json.options?.find(
         (opt: any) => opt.name === "rename"
      ) as any;
      expect(renameSub.options.map((o: any) => o.name)).toEqual([
         "name",
         "new_name",
      ]);
   });
});

describe("Task Slash Command Structure & Data", () => {
   it("exposes five subcommands with inline task autocomplete", () => {
      expect(taskCommand.name).toBe("task");
      const json = taskCommand.data.toJSON();
      expect(json.name).toBe("task");
      expect(json.options).toHaveLength(5);

      const addSub = json.options?.find(
         (opt: any) => opt.name === "add"
      ) as any;
      expect(addSub.options.map((o: any) => o.name)).toEqual([
         "content",
         "category",
      ]);
      expect(addSub.options[0].required).toBe(true);
      expect(addSub.options[1].autocomplete).toBe(true);

      for (const name of ["done", "remove"]) {
         const sub = json.options?.find((opt: any) => opt.name === name) as any;
         expect(sub.options).toHaveLength(1);
         expect(sub.options[0]).toMatchObject({
            name: "task",
            required: true,
            autocomplete: true,
         });
      }

      const renameSub = json.options?.find(
         (opt: any) => opt.name === "rename"
      ) as any;
      expect(renameSub.options.map((o: any) => o.name)).toEqual([
         "task",
         "new_content",
      ]);
   });
});

describe("Slash command deployment", () => {
   it("registers every command payload globally through the shared REST client", async () => {
      const rest = {
         get: vi.fn().mockResolvedValue({ id: "app-id" }),
         put: vi.fn().mockResolvedValue([]),
      };

      const payloads = await deploySlashCommands({
         commands: [helpCommand, pingCommand, categoryCommand, taskCommand],
         mode: "global",
         rest: rest as any,
      });

      expect(payloads).toHaveLength(4);
      expect(rest.put).toHaveBeenCalledWith("/applications/app-id/commands", {
         body: payloads,
      });
   });

   it("registers guild-scoped commands when a guild id is supplied", async () => {
      const rest = {
         get: vi.fn().mockResolvedValue({ id: "app-id" }),
         put: vi.fn().mockResolvedValue([]),
      };

      await deploySlashCommands({
         commands: [helpCommand, pingCommand],
         mode: "guild",
         guildId: "1544486918719283241",
         rest: rest as any,
      });

      expect(rest.put).toHaveBeenCalledWith(
         "/applications/app-id/guilds/1544486918719283241/commands",
         { body: expect.any(Array) }
      );
   });
});

describe("Slash command execution", () => {
   it("creates a category", async () => {
      const reply = vi.fn();
      await categoryCommand.executeSlash({
         user: { id: "test-user-1", displayName: "Tester" },
         options: {
            getSubcommand: () => "create",
            getString: (name: string) => (name === "name" ? "Projects" : null),
         },
         reply,
      } as any);

      expect(mocks.createCategory).toHaveBeenCalledWith("user-1", "Projects");
      expect(reply).toHaveBeenCalledTimes(1);
      expect(reply.mock.calls[0]![0].embeds).toHaveLength(1);
   });

   it("returns an ephemeral error for a duplicate category", async () => {
      mocks.createCategory.mockRejectedValueOnce(
         new mocks.DuplicateCategoryError("Projects")
      );
      const reply = vi.fn();

      await categoryCommand.executeSlash({
         user: { id: "test-user-1", displayName: "Tester" },
         options: {
            getSubcommand: () => "create",
            getString: () => "Projects",
         },
         reply,
      } as any);

      expect(reply).toHaveBeenCalledTimes(1);
      expect(reply.mock.calls[0]![0].embeds[0].data.description).toContain(
         "already exists"
      );
   });

   it("lists categories", async () => {
      const reply = vi.fn();
      await categoryCommand.executeSlash({
         user: { id: "test-user-1", displayName: "Tester" },
         options: { getSubcommand: () => "list" },
         reply,
      } as any);

      expect(reply.mock.calls[0]![0].embeds[0].data.title).toBe(
         "Tester's Categories"
      );
   });

   it("deletes a category through the reassigning model", async () => {
      const reply = vi.fn();
      await categoryCommand.executeSlash({
         user: { id: "test-user-1", displayName: "Tester" },
         options: {
            getSubcommand: () => "delete",
            getString: () => "Projects",
         },
         reply,
      } as any);

      expect(mocks.deleteCategory).toHaveBeenCalledWith("123");
      expect(reply.mock.calls[0]![0].embeds[0].data.description).toContain(
         "moved to **Default**"
      );
   });

   it("renames a category", async () => {
      const reply = vi.fn();
      await categoryCommand.executeSlash({
         user: { id: "test-user-1", displayName: "Tester" },
         options: {
            getSubcommand: () => "rename",
            getString: (name: string) =>
               name === "name"
                  ? "Projects"
                  : name === "new_name"
                    ? "NewProjects"
                    : null,
         },
         reply,
      } as any);

      expect(mocks.updateCategoryName).toHaveBeenCalledWith(
         "user-1",
         "Projects",
         "NewProjects"
      );
      expect(reply.mock.calls[0]![0].embeds[0].data.description).toContain(
         "renamed"
      );
   });

   it("adds a task to an explicit category", async () => {
      const reply = vi.fn();
      await taskCommand.executeSlash({
         user: { id: "test-user-1", displayName: "Tester" },
         options: {
            getSubcommand: () => "add",
            getString: (opt: string) =>
               opt === "content"
                  ? "Finish docs"
                  : opt === "category"
                    ? "Projects"
                    : null,
         },
         reply,
      } as any);

      expect(mocks.createTask).toHaveBeenCalledWith(
         "user-1",
         "Finish docs",
         "123"
      );
      expect(reply.mock.calls[0]![0].embeds[0].data.description).toContain(
         "Projects"
      );
   });

   it("defaults to the Default category when none is provided", async () => {
      const reply = vi.fn();
      await taskCommand.executeSlash({
         user: { id: "test-user-1", displayName: "Tester" },
         options: {
            getSubcommand: () => "add",
            getString: (opt: string) => (opt === "content" ? "Buy milk" : null),
         },
         reply,
      } as any);

      expect(mocks.createTask).toHaveBeenCalledWith(
         "user-1",
         "Buy milk",
         "default-id-123"
      );
      expect(reply.mock.calls[0]![0].embeds[0].data.description).toContain(
         "Default"
      );
   });

   it("lists today's tasks", async () => {
      const reply = vi.fn();
      await taskCommand.executeSlash({
         user: { id: "test-user-1", displayName: "Tester" },
         options: { getSubcommand: () => "list" },
         reply,
      } as any);

      expect(reply.mock.calls[0]![0].embeds[0].data.title).toBe(
         "Tester's Tasks"
      );
   });

   it("marks a task done", async () => {
      const reply = vi.fn();
      await taskCommand.executeSlash({
         user: { id: "test-user-1", displayName: "Tester" },
         options: {
            getSubcommand: () => "done",
            getString: () => "507f1f77bcf86cd799439011",
         },
         reply,
      } as any);

      expect(mocks.updateTaskStatus).toHaveBeenCalledWith(
         "507f1f77bcf86cd799439011",
         "user-1",
         "completed"
      );
      expect(reply.mock.calls[0]![0].embeds[0].data.description).toContain(
         "Task marked as done"
      );
   });

   it("removes a task", async () => {
      const reply = vi.fn();
      await taskCommand.executeSlash({
         user: { id: "test-user-1", displayName: "Tester" },
         options: {
            getSubcommand: () => "remove",
            getString: () => "507f1f77bcf86cd799439011",
         },
         reply,
      } as any);

      expect(mocks.deleteTask).toHaveBeenCalledWith(
         "507f1f77bcf86cd799439011",
         "user-1"
      );
      expect(reply.mock.calls[0]![0].embeds[0].data.description).toContain(
         "Task removed"
      );
   });

   it("renames a task", async () => {
      const reply = vi.fn();
      await taskCommand.executeSlash({
         user: { id: "test-user-1", displayName: "Tester" },
         options: {
            getSubcommand: () => "rename",
            getString: (name: string) =>
               name === "task"
                  ? "507f1f77bcf86cd799439011"
                  : name === "new_content"
                    ? "Updated task description"
                    : null,
         },
         reply,
      } as any);

      expect(mocks.updateTaskContent).toHaveBeenCalledWith(
         "507f1f77bcf86cd799439011",
         "user-1",
         "Updated task description"
      );
      expect(reply.mock.calls[0]![0].embeds[0].data.description).toContain(
         "Task renamed to:"
      );
   });
});

describe("Unauthenticated users", () => {
   it("replies with the sign-in prompt and skips the database", async () => {
      mocks.requireWebUser.mockImplementationOnce(async (interaction: any) => {
         await interaction.reply({
            content: "Sign in with Discord first.",
            flags: 64,
         });
         return null;
      });
      const reply = vi.fn();

      await taskCommand.executeSlash({
         user: { id: "unknown-user", displayName: "Unknown" },
         options: { getSubcommand: () => "list" },
         reply,
      } as any);

      expect(reply).toHaveBeenCalledTimes(1);
      expect(reply.mock.calls[0]![0].content).toBe(
         "Sign in with Discord first."
      );
      expect(mocks.getTasks).not.toHaveBeenCalled();
   });

   it("gates prefix commands the same way", async () => {
      mocks.requireWebUserByDiscordId.mockResolvedValueOnce(null);
      const reply = vi.fn();

      await taskCommand.execute(
         { author: { id: "unknown-user", displayName: "Unknown" }, reply },
         ["'task", "list"]
      );

      expect(mocks.getTasks).not.toHaveBeenCalled();
   });
});

describe("Prefix commands", () => {
   it("adds a task with no category to Default", async () => {
      const reply = vi.fn();
      await taskCommand.execute(
         { author: { id: "test-user-1", displayName: "Tester" }, reply },
         ["'task", "add", "Buy", "eggs", "and", "bread"]
      );

      expect(mocks.createTask).toHaveBeenCalledWith(
         "user-1",
         "Buy eggs and bread",
         "default-id-123"
      );
      expect(reply.mock.calls[0]![0].embeds[0].data.description).toContain(
         "Buy eggs and bread"
      );
   });

   it("adds a task with an existing category", async () => {
      const reply = vi.fn();
      await taskCommand.execute(
         { author: { id: "test-user-1", displayName: "Tester" }, reply },
         ["'task", "add", "Projects", "Write", "unit", "tests"]
      );

      expect(mocks.createTask).toHaveBeenCalledWith(
         "user-1",
         "Write unit tests",
         "123"
      );
   });

   it("replies with usage when content is missing", async () => {
      const reply = vi.fn();
      await taskCommand.execute(
         { author: { id: "test-user-1", displayName: "Tester" }, reply },
         ["'task", "add"]
      );

      expect(reply.mock.calls[0]![0].embeds[0].data.description).toContain(
         "Usage"
      );
   });
});

describe("Autocomplete", () => {
   it("returns matching categories", async () => {
      const respond = vi.fn();
      await taskCommand.autocomplete({
         user: { id: "test-user-1" },
         options: {
            getFocused: () => ({ name: "category", value: "proj" }),
            getSubcommand: () => "add",
         },
         respond,
      } as any);

      expect(respond).toHaveBeenCalledTimes(1);
      expect(respond.mock.calls[0]![0]).toEqual([
         { name: "Projects", value: "Projects" },
      ]);
   });

   it("returns matching tasks with the task id as value", async () => {
      const respond = vi.fn();
      await taskCommand.autocomplete({
         user: { id: "test-user-1" },
         options: {
            getFocused: () => ({ name: "task", value: "Test" }),
            getSubcommand: () => "done",
         },
         respond,
      } as any);

      expect(respond.mock.calls[0]![0][0]).toMatchObject({
         name: expect.stringContaining("Test task"),
         value: "507f1f77bcf86cd799439011",
      });
   });

   it("responds with an empty list for users without a web account", async () => {
      mocks.resolveUserByDiscordId.mockResolvedValueOnce(null);
      const respond = vi.fn();

      await taskCommand.autocomplete({
         user: { id: "unknown-user" },
         options: {
            getFocused: () => ({ name: "category", value: "" }),
            getSubcommand: () => "add",
         },
         respond,
      } as any);

      expect(respond).toHaveBeenCalledWith([]);
   });
});

describe("Interaction dispatcher", () => {
   it("routes autocomplete interactions to the command", async () => {
      const autocomplete = vi.fn();
      let listener: any;
      const client: any = {
         commands: new Map([["task", { autocomplete }]]),
         on: vi.fn((_event: string, handler: any) => {
            listener = handler;
         }),
      };

      installInteractionHandler(client);
      await listener({
         isAutocomplete: () => true,
         commandName: "task",
      });

      expect(autocomplete).toHaveBeenCalledTimes(1);
   });

   it("routes chat input interactions to executeSlash", async () => {
      const executeSlash = vi.fn();
      let listener: any;
      const client: any = {
         commands: new Map([["ping", { executeSlash }]]),
         on: vi.fn((_event: string, handler: any) => {
            listener = handler;
         }),
      };

      installInteractionHandler(client);
      await listener({
         isAutocomplete: () => false,
         isMessageComponent: () => false,
         isModalSubmit: () => false,
         isChatInputCommand: () => true,
         commandName: "ping",
         replied: false,
         deferred: false,
      });

      expect(executeSlash).toHaveBeenCalledTimes(1);
   });
});
