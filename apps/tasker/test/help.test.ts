import { describe, expect, it, vi } from "vitest";
import { MessageFlags } from "discord.js";
import { installInteractionHandler } from "@holdmetoit/discord/bot";
import helpCommand, {
   buildHelpEmbed,
   buildSelectRow,
} from "../src/commands/help.js";
import pingCommand from "../src/commands/ping.js";

describe("Help Command Structure & Slash Command Builder", () => {
   it("has a valid name, description and builder", () => {
      expect(helpCommand.name).toBe("help");
      expect(typeof helpCommand.description).toBe("string");
      expect(helpCommand.description.length).toBeGreaterThan(0);

      const json = helpCommand.data!.toJSON() as any;
      expect(json.name).toBe("help");
      expect(json.description).toBe(helpCommand.description);
      expect(json.options).toHaveLength(1);

      const categoryOption = json.options[0];
      expect(categoryOption.name).toBe("category");
      expect(categoryOption.choices).toHaveLength(5);
      expect(categoryOption.choices.map((c: any) => c.value)).toEqual(
         expect.arrayContaining([
            "all",
            "quickstart",
            "tasks",
            "categories",
            "general",
         ])
      );
   });

   it("exports a valid ping command", () => {
      expect(pingCommand.name).toBe("ping");
      const json = pingCommand.data!.toJSON() as any;
      expect(json.name).toBe("ping");
      expect(typeof pingCommand.executeSlash).toBe("function");
   });
});

describe("Help Embed Generator", () => {
   it("generates an overview embed with all command categories", () => {
      const embed = buildHelpEmbed("all", "TestUser");
      const json = embed.toJSON();

      expect(json.title).toContain("Tasker - Help Menu & Command Directory");
      expect(json.description).toContain("TestUser");
      expect(json.fields).toHaveLength(4);

      const fieldTitles = json.fields?.map((f) => f.name) ?? [];
      expect(fieldTitles.some((t) => t.includes("Quick Start"))).toBe(true);
      expect(fieldTitles.some((t) => t.includes("Task Operations"))).toBe(true);
      expect(fieldTitles.some((t) => t.includes("Category Operations"))).toBe(
         true
      );
      expect(fieldTitles.some((t) => t.includes("Utilities"))).toBe(true);

      const allValues = json.fields?.map((f) => f.value).join(" ") ?? "";
      for (const expected of [
         "'task add",
         "'task list",
         "'task done",
         "'task remove",
         "'category create",
         "'category list",
         "'category delete",
         "'ping",
         "'help",
      ]) {
         expect(allValues).toContain(expected);
      }
   });

   it("generates a beginner-friendly quickstart guide", () => {
      const json = buildHelpEmbed("quickstart").toJSON();
      expect(json.title).toContain("Quick Start Guide");
      expect(json.description).toContain("Create a Category");
      expect(json.description).toContain("Add Your Tasks");
      expect(json.description).toContain("View Today's Tasks");
      expect(json.description).toContain("Mark Completed, Rename, or Remove");
   });

   it("generates the task commands embed", () => {
      const json = buildHelpEmbed("tasks").toJSON();
      expect(json.title).toContain("Task Management Commands");
      expect(json.fields).toHaveLength(5);
      const names = json.fields?.map((f) => f.name) ?? [];
      for (const expected of [
         "Add Task",
         "List Tasks",
         "Mark Done",
         "Rename Task",
         "Remove Task",
      ]) {
         expect(names.some((n) => n.includes(expected))).toBe(true);
      }
   });

   it("generates the category commands embed", () => {
      const json = buildHelpEmbed("categories").toJSON();
      expect(json.title).toContain("Category Management Commands");
      expect(json.fields).toHaveLength(4);
      const names = json.fields?.map((f) => f.name) ?? [];
      for (const expected of [
         "Create Category",
         "List Categories",
         "Rename Category",
         "Delete Category",
      ]) {
         expect(names.some((n) => n.includes(expected))).toBe(true);
      }
   });

   it("generates the general commands embed", () => {
      const json = buildHelpEmbed("general").toJSON();
      expect(json.title).toContain("General & Utility Commands");
      const names = json.fields?.map((f) => f.name) ?? [];
      expect(names.some((n) => n.includes("Help Menu"))).toBe(true);
      expect(names.some((n) => n.includes("Ping"))).toBe(true);
   });
});

describe("Help Select Menu Builder", () => {
   it("builds a select row with 5 options and the right default", () => {
      const json = buildSelectRow("all", false).toJSON() as any;
      expect(json.components).toHaveLength(1);
      const select = json.components[0];
      expect(select.custom_id).toBe("help-category-select");
      expect(select.disabled).toBe(false);
      expect(select.options).toHaveLength(5);
      expect(select.options.find((o: any) => o.default === true)?.value).toBe(
         "all"
      );
   });

   it("supports disabled mode and a selected category", () => {
      const json = buildSelectRow("quickstart", true).toJSON() as any;
      const select = json.components[0];
      expect(select.disabled).toBe(true);
      expect(select.options.find((o: any) => o.default === true)?.value).toBe(
         "quickstart"
      );
   });
});

describe("Execution Handlers (Prefix & Slash)", () => {
   it("replies with an embed and components for the prefix command", async () => {
      const reply = vi.fn(async (_payload: any) => ({
         createMessageComponentCollector: () => ({ on: () => {} }),
      }));

      await helpCommand.execute(
         { author: { id: "user123", displayName: "Afnan" }, reply },
         ["'help"]
      );

      expect(reply).toHaveBeenCalledTimes(1);
      const payload = reply.mock.calls[0]![0] as any;
      expect(payload.embeds).toHaveLength(1);
      expect(payload.components).toHaveLength(1);
   });

   it("replies with withResponse: true for the slash command", async () => {
      const reply = vi.fn(async (_payload: any) => ({
         resource: {
            message: {
               createMessageComponentCollector: () => ({ on: () => {} }),
            },
         },
      }));

      await helpCommand.executeSlash({
         user: { id: "user123", displayName: "Afnan" },
         options: { getString: () => "tasks" },
         reply,
      });

      expect(reply).toHaveBeenCalledTimes(1);
      const payload = reply.mock.calls[0]![0] as any;
      expect(payload.withResponse).toBe(true);
      expect(payload.embeds[0].data.title).toContain(
         "Task Management Commands"
      );
   });
});

describe("Interaction error handling", () => {
   it("replies ephemerally when a command throws", async () => {
      const reply = vi.fn(async (_payload: any) => {});
      let listener: any;

      const client: any = {
         commands: new Map([
            [
               "help",
               {
                  executeSlash: vi.fn(async () => {
                     throw new Error("Test error");
                  }),
               },
            ],
         ]),
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
         commandName: "help",
         reply,
         followUp: vi.fn(async () => {}),
         replied: false,
         deferred: false,
      });

      expect(reply).toHaveBeenCalledTimes(1);
      expect((reply.mock.calls[0]![0] as any).flags).toBe(
         MessageFlags.Ephemeral
      );
   });
});
