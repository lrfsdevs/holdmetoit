import { describe, expect, it } from "vitest";

import { mapDiscordProfileToUserFields } from "@/features/auth/data/discord-profile.mapper";

describe("mapDiscordProfileToUserFields", () => {
   it("maps Discord identify fields to user sync columns", () => {
      expect(
         mapDiscordProfileToUserFields({
            providerAccountId: "102938475610293847",
            username: "AuraStudier",
            globalName: "Aura Studier",
            image: "https://cdn.discordapp.com/avatars/example.png",
         })
      ).toEqual({
         discordId: "102938475610293847",
         username: "AuraStudier",
         displayName: "Aura Studier",
         image: "https://cdn.discordapp.com/avatars/example.png",
      });
   });

   it("falls back to username when global display name is absent", () => {
      expect(
         mapDiscordProfileToUserFields({
            providerAccountId: "203948571029384756",
            username: "KiraLibrary",
            globalName: null,
         })
      ).toEqual({
         discordId: "203948571029384756",
         username: "KiraLibrary",
         displayName: "KiraLibrary",
         image: null,
      });
   });
});
