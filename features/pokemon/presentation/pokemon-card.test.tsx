import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PokemonCard } from "./pokemon-card";
import { PokemonSpeciesWithCounts } from "../data/pokemon-catalogue.repository";

describe("PokemonCard Component", () => {
   const sampleSpecies: PokemonSpeciesWithCounts = {
      id: "sp_25",
      pokedexNumber: 25,
      name: "Pikachu",
      slug: "pikachu",
      rarity: "RARE",
      primaryType: "ELECTRIC",
      secondaryType: null,
      description: "Electric mouse",
      classification: "Mouse Pokémon",
      imageUrl: "https://example.com/pikachu.png",
      spriteUrl: null,
      baseHp: 35,
      baseAttack: 55,
      baseDefense: 40,
      generation: 1,
      isAvailable: true,
      referenceUrl: "https://www.pokemon.com/us/pokedex/pikachu",
      createdAt: new Date(),
      updatedAt: new Date(),
   };

   it("renders species name, Pokédex number, and classification", () => {
      const html = renderToStaticMarkup(
         createElement(PokemonCard, {
            species: sampleSpecies,
            ownedCount: 0,
         })
      );

      expect(html).toContain("Pikachu");
      expect(html).toContain("#0025");
      expect(html).toContain("Mouse Pokémon");
      expect(html).toContain("Unowned");
   });

   it("renders owned badge when ownedCount > 0", () => {
      const htmlSingle = renderToStaticMarkup(
         createElement(PokemonCard, {
            species: sampleSpecies,
            ownedCount: 1,
         })
      );
      expect(htmlSingle).toContain("Owned");
      expect(htmlSingle).not.toContain("Unowned");

      const htmlMultiple = renderToStaticMarkup(
         createElement(PokemonCard, {
            species: sampleSpecies,
            ownedCount: 3,
         })
      );
      expect(htmlMultiple).toContain("x3 Owned");
   });

   it("renders rarity badge and elemental type", () => {
      const html = renderToStaticMarkup(
         createElement(PokemonCard, {
            species: sampleSpecies,
            ownedCount: 1,
         })
      );

      expect(html).toContain("Rare");
      expect(html).toContain("Electric");
   });
});
