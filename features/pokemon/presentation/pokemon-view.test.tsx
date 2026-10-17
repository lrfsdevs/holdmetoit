import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PokemonView } from "./pokemon-view";
import { PokemonSpeciesWithCounts } from "../data/pokemon-catalogue.repository";

vi.mock("@/core/auth", () => ({
   auth: vi.fn(),
   handlers: {},
   signIn: vi.fn(),
   signOut: vi.fn(),
}));

vi.mock("../api/acquisition.actions", () => ({
   listActiveBannersAction: vi
      .fn()
      .mockResolvedValue({ ok: true, data: { banners: [] } }),
   pullPokemonAction: vi.fn(),
   getUserAcquisitionHistoryAction: vi.fn(),
   adminListAllBannersAction: vi.fn(),
   adminCreateBannerAction: vi.fn(),
   adminSetBannerStatusAction: vi.fn(),
}));

vi.mock("../api/pokemon.actions", () => ({
   getPokemonCatalogueAction: vi.fn().mockResolvedValue({
      ok: true,
      data: { species: [], totalCount: 0 },
   }),
}));

vi.mock("@/components/ui/header", () => ({
   SignInWithDiscordButton: () =>
      createElement("button", null, "Sign In with Discord to Summon"),
}));

function makeSpecies(count: number): PokemonSpeciesWithCounts[] {
   return Array.from({ length: count }, (_, i) => ({
      id: `sp_${i + 1}`,
      pokedexNumber: i + 1,
      name: `Pkmn ${i + 1}`,
      slug: `pkmn-${i + 1}`,
      rarity: "UNCOMMON",
      primaryType: "GRASS",
      secondaryType: null,
      description: `Description ${i + 1}`,
      classification: "Test Pokémon",
      imageUrl: null,
      spriteUrl: null,
      baseHp: 45,
      baseAttack: 49,
      baseDefense: 49,
      generation: 1,
      isAvailable: true,
      referenceUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
   })) as unknown as PokemonSpeciesWithCounts[];
}

describe("PokemonView Component", () => {
   const sampleSpecies: PokemonSpeciesWithCounts[] = [
      {
         id: "sp_1",
         pokedexNumber: 1,
         name: "Bulbasaur",
         slug: "bulbasaur",
         rarity: "UNCOMMON",
         primaryType: "GRASS",
         secondaryType: "POISON",
         description: "Seed pokemon",
         classification: "Seed Pokémon",
         imageUrl: null,
         spriteUrl: null,
         baseHp: 45,
         baseAttack: 49,
         baseDefense: 49,
         generation: 1,
         isAvailable: true,
         referenceUrl: null,
         createdAt: new Date(),
         updatedAt: new Date(),
      },
      {
         id: "sp_4",
         pokedexNumber: 4,
         name: "Charmander",
         slug: "charmander",
         rarity: "UNCOMMON",
         primaryType: "FIRE",
         secondaryType: null,
         description: "Fire lizard",
         classification: "Lizard Pokémon",
         imageUrl: null,
         spriteUrl: null,
         baseHp: 39,
         baseAttack: 52,
         baseDefense: 43,
         generation: 1,
         isAvailable: true,
         referenceUrl: null,
         createdAt: new Date(),
         updatedAt: new Date(),
      },
   ];

   it("renders catalogue cards when species are provided", () => {
      const html = renderToStaticMarkup(
         createElement(PokemonView, {
            initialSpecies: sampleSpecies,
            initialTotalCount: 2,
            initialSummary: null,
            initialInstances: [],
            isSpectator: true,
         })
      );

      expect(html).toContain("Bulbasaur");
      expect(html).toContain("Charmander");
      expect(html).toContain("Pokédex Catalogue");
      expect(html).toContain("Summon Portal");
   });

   it("renders the first page and pagination controls for a larger catalogue", () => {
      const html = renderToStaticMarkup(
         createElement(PokemonView, {
            initialSpecies: makeSpecies(24),
            initialTotalCount: 25,
            initialSummary: null,
            initialInstances: [],
            isSpectator: true,
         })
      );

      expect(html).toContain("Pkmn 24");
      expect(html).toContain("Showing");
      expect(html).toContain("1\u201324");
      expect(html).toContain("25");
      expect(html).toContain("Pokémon");
      expect(html).toContain("Next");
   });

   it("renders empty state when species list is empty", () => {
      const html = renderToStaticMarkup(
         createElement(PokemonView, {
            initialSpecies: [],
            initialTotalCount: 0,
            initialSummary: null,
            initialInstances: [],
            isSpectator: false,
         })
      );

      expect(html).toContain("No Pokémon Match Your Filters");
   });
});
