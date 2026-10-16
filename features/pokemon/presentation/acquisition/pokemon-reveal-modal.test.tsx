import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PokemonRevealModal } from "./pokemon-reveal-modal";
import { AcquisitionResultViewModel } from "../../data/acquisition.repository";

describe("PokemonRevealModal Component", () => {
   const sampleAcquisition: AcquisitionResultViewModel = {
      acquisitionId: "acq_test_123",
      bannerId: "banner_starter",
      bannerName: "Kanto Starters Special",
      version: 1,
      species: {
         id: "sp_charizard",
         pokedexNumber: 6,
         name: "Charizard",
         slug: "charizard",
         rarity: "EPIC",
         primaryType: "FIRE",
         secondaryType: "FLYING",
         description: "Spits fire that is hot enough to melt boulders.",
         classification: "Flame Pokémon",
         imageUrl: "https://example.com/charizard.png",
         spriteUrl: null,
         spriteGifUrl: null,
         baseHp: 78,
         baseAttack: 84,
         baseDefense: 78,
         generation: 1,
         isLegendary: false,
         isMythical: false,
         isBaby: false,
         isAvailable: true,
         sourceId: "6",
         referenceUrl: null,
         createdAt: new Date(),
         updatedAt: new Date(),
      },
      rarity: "EPIC",
      isFeatured: true,
      isDuplicate: false,
      duplicateOutcome: null,
      costPaid: 500,
      newBalance: 4500,
      pityCountBefore: 11,
      pityCountAfter: 12,
      pityTriggered: false,
      isIdempotentReplay: false,
      obtainedAt: new Date().toISOString(),
   };

   it("renders anticipation stage and skip button during initial pull animation", () => {
      const html = renderToStaticMarkup(
         createElement(PokemonRevealModal, {
            acquisition: sampleAcquisition,
            isOpen: true,
            onClose: vi.fn(),
            initialStage: "anticipation",
         })
      );

      expect(html).toContain("Opening Summon Portal...");
      expect(html).toContain("Skip Reveal");
      expect(html).toContain('data-testid="skip-reveal-button"');
   });

   it("renders modal dialog with full acquisition details in details stage", () => {
      const html = renderToStaticMarkup(
         createElement(PokemonRevealModal, {
            acquisition: sampleAcquisition,
            isOpen: true,
            onClose: vi.fn(),
            onPullAgain: vi.fn(),
            canPullAgain: true,
            pullCost: 500,
            userAvailableCoins: 4500,
            initialStage: "details",
         })
      );

      expect(html).toContain("Charizard");
      expect(html).toContain("Kanto Starters Special");
      expect(html).toContain("Done");
      expect(html).toContain("Summon Again");
   });

   it("renders duplicate indicator when acquired companion is a duplicate", () => {
      const duplicateAcquisition: AcquisitionResultViewModel = {
         ...sampleAcquisition,
         isDuplicate: true,
         duplicateOutcome: "OWNERSHIP_COUNT_INCREMENTED",
      };

      const html = renderToStaticMarkup(
         createElement(PokemonRevealModal, {
            acquisition: duplicateAcquisition,
            isOpen: true,
            onClose: vi.fn(),
            initialStage: "details",
         })
      );

      expect(html).toContain("Duplicate Acquired (Count +1)");
   });

   it("does not render when isOpen is false", () => {
      const html = renderToStaticMarkup(
         createElement(PokemonRevealModal, {
            acquisition: sampleAcquisition,
            isOpen: false,
            onClose: vi.fn(),
         })
      );

      expect(html).toBe("");
   });
});
