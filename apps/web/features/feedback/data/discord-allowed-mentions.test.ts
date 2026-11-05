import { describe, expect, it } from "vitest";
import { buildChannelMessageBody } from "@holdmetoit/discord";

describe("buildChannelMessageBody", () => {
   it("blocks all mentions by default", () => {
      const body = buildChannelMessageBody({
         content: "@everyone <@123> <@&456>",
         embeds: [{ title: "Hello" }],
      });

      expect(body.allowed_mentions).toEqual({ parse: [] });
      expect(body.content).toBe("@everyone <@123> <@&456>");
      expect(body.embeds).toEqual([{ title: "Hello" }]);
   });

   it("blocks mentions for embed-only messages", () => {
      expect(
         buildChannelMessageBody({ embeds: [{ title: "Hello" }] })
            .allowed_mentions
      ).toEqual({ parse: [] });
   });

   it("only includes the fields that were provided", () => {
      const body = buildChannelMessageBody({ content: "hi" });

      expect(Object.keys(body).sort()).toEqual(["allowed_mentions", "content"]);
   });

   it("lets a caller opt in to specific mentions explicitly", () => {
      const body = buildChannelMessageBody({
         content: "<@123>",
         allowedMentions: { users: ["123"] },
      });

      expect(body.allowed_mentions).toEqual({ users: ["123"] });
   });
});
