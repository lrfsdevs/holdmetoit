import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PokemonProgressHeader } from "./pokemon-progress-header";

describe("PokemonProgressHeader Component", () => {
   it("renders spectator state with sign-in guidance", () => {
      const html = renderToStaticMarkup(
         createElement(PokemonProgressHeader, {
            progress: null,
            isSpectator: true,
         })
      );

      expect(html).toContain("Pokédex &amp; Collection");
      expect(html).toContain("Spectator Mode");
      expect(html).toContain("Sign in with Discord");
   });

   it("renders collection progress metrics for authenticated participant", () => {
      const progress = {
         uniqueOwnedCount: 15,
         totalAvailableCount: 30,
         totalInstancesCount: 22,
         completionPercentage: 50,
         tier: "COLLECTOR" as const,
      };

      const html = renderToStaticMarkup(
         createElement(PokemonProgressHeader, {
            progress,
            isSpectator: false,
         })
      );

      expect(html).toContain("50%");
      expect(html).toContain("15");
      expect(html).toContain("/ 30");
      expect(html).toContain("22");
      expect(html).toContain("Avid Collector");
   });

   it("handles empty progress safely", () => {
      const progress = {
         uniqueOwnedCount: 0,
         totalAvailableCount: 20,
         totalInstancesCount: 0,
         completionPercentage: 0,
         tier: "NOVICE" as const,
      };

      const html = renderToStaticMarkup(
         createElement(PokemonProgressHeader, {
            progress,
            isSpectator: false,
         })
      );

      expect(html).toContain("0%");
      expect(html).toContain("Apprentice Trainer");
   });
});
