import { describe, expect, it } from "vitest";
import { calculateNextPityState, evaluatePity } from "./pity-engine";
import { PityConfig } from "./banner-config";
import type { PokemonRarity } from "@prisma/client";

describe("Pity Engine Domain Logic", () => {
   const pityConfig: PityConfig = {
      hardPityThreshold: 50,
      targetRarity: "LEGENDARY",
      resetOnRarities: ["LEGENDARY", "MYTHICAL"],
      featuredGuarantee: true,
   };

   describe("evaluatePity", () => {
      it("does not trigger pity when pity count is below threshold", () => {
         // 0-indexed: pull 0 (first pull)
         const res = evaluatePity({
            currentPityCount: 0,
            guaranteedFeatured: false,
            pityConfig,
         });
         expect(res.pityTriggered).toBe(false);
         expect(res.guaranteedRarity).toBeNull();
      });

      it("triggers hard pity exactly on the threshold pull (e.g. pull 50 when threshold is 50)", () => {
         // 49 pulls completed -> 49 + 1 = 50 >= 50
         const res = evaluatePity({
            currentPityCount: 49,
            guaranteedFeatured: false,
            pityConfig,
         });
         expect(res.pityTriggered).toBe(true);
         expect(res.guaranteedRarity).toBe("LEGENDARY");
         expect(res.guaranteedFeatured).toBe(false);
      });

      it("passes through guaranteedFeatured status on hard pity", () => {
         const res = evaluatePity({
            currentPityCount: 49,
            guaranteedFeatured: true,
            pityConfig,
         });
         expect(res.pityTriggered).toBe(true);
         expect(res.guaranteedFeatured).toBe(true);
      });

      it("returns pityTriggered: false when pityConfig is absent", () => {
         const res = evaluatePity({
            currentPityCount: 100,
            guaranteedFeatured: true,
            pityConfig: null,
         });
         expect(res.pityTriggered).toBe(false);
      });
   });

   describe("calculateNextPityState", () => {
      it("increments pity count when a standard non-reset rarity is pulled", () => {
         const next = calculateNextPityState({
            previousPityCount: 5,
            previousGuaranteedFeatured: false,
            rolledRarity: "RARE",
            wasFeaturedPulled: false,
            pityConfig,
         });
         expect(next.pityCount).toBe(6);
         expect(next.guaranteedFeatured).toBe(false);
      });

      it("resets pity count to 0 when a reset rarity is rolled naturally", () => {
         const next = calculateNextPityState({
            previousPityCount: 35,
            previousGuaranteedFeatured: false,
            rolledRarity: "LEGENDARY",
            wasFeaturedPulled: true,
            pityConfig,
         });
         expect(next.pityCount).toBe(0);
      });

      it("resets pity count to 0 when hard pity threshold was reached", () => {
         const next = calculateNextPityState({
            previousPityCount: 49,
            previousGuaranteedFeatured: false,
            rolledRarity: "LEGENDARY",
            wasFeaturedPulled: true,
            pityConfig,
         });
         expect(next.pityCount).toBe(0);
      });

      it("activates guaranteedFeatured when losing 50/50 on target rarity", () => {
         const next = calculateNextPityState({
            previousPityCount: 49,
            previousGuaranteedFeatured: false,
            rolledRarity: "LEGENDARY",
            wasFeaturedPulled: false, // lost 50/50
            pityConfig,
         });
         expect(next.pityCount).toBe(0);
         expect(next.guaranteedFeatured).toBe(true); // guarantee secured!
      });

      it("consumes guaranteedFeatured when winning the featured pull", () => {
         const next = calculateNextPityState({
            previousPityCount: 49,
            previousGuaranteedFeatured: true, // had guarantee
            rolledRarity: "LEGENDARY",
            wasFeaturedPulled: true, // pulled featured
            pityConfig,
         });
         expect(next.pityCount).toBe(0);
         expect(next.guaranteedFeatured).toBe(false); // guarantee redeemed!
      });

      it("preserves pity progress at hardPityThreshold - 1 when target rarity was locked and not rolled", () => {
         const next = calculateNextPityState({
            previousPityCount: 49,
            previousGuaranteedFeatured: false,
            rolledRarity: "EPIC", // rolled eligible non-reset rarity because Legendary was locked
            wasFeaturedPulled: false,
            pityConfig,
            pityTriggered: false,
         });
         // Pity progress is preserved so the participant does not lose their pulls
         expect(next.pityCount).toBe(49);
      });
   });

   describe("evaluatePity with Study Progression Gates (Section 11.1)", () => {
      it("strictly blocks hard pity for LEGENDARY when cumulative study hours < 500", () => {
         // 499h 59m 59s = 1,799,999s
         const res = evaluatePity({
            currentPityCount: 49,
            guaranteedFeatured: false,
            pityConfig,
            cumulativeStudySeconds: 1799999,
         });
         expect(res.pityTriggered).toBe(false);
         expect(res.guaranteedRarity).toBeNull();
      });

      it("activates hard pity for LEGENDARY at exactly 500 hours (1,800,000s)", () => {
         const res = evaluatePity({
            currentPityCount: 49,
            guaranteedFeatured: false,
            pityConfig,
            cumulativeStudySeconds: 1800000,
         });
         expect(res.pityTriggered).toBe(true);
         expect(res.guaranteedRarity).toBe("LEGENDARY");
      });

      it("respects explicit eligibleRarities Set", () => {
         const lockedRes = evaluatePity({
            currentPityCount: 49,
            guaranteedFeatured: false,
            pityConfig,
            eligibleRarities: new Set<PokemonRarity>([
               "NORMAL",
               "UNCOMMON",
               "RARE",
               "EPIC",
            ]),
         });
         expect(lockedRes.pityTriggered).toBe(false);

         const unlockedRes = evaluatePity({
            currentPityCount: 49,
            guaranteedFeatured: false,
            pityConfig,
            eligibleRarities: new Set<PokemonRarity>([
               "NORMAL",
               "UNCOMMON",
               "RARE",
               "EPIC",
               "LEGENDARY",
            ]),
         });
         expect(unlockedRes.pityTriggered).toBe(true);
         expect(unlockedRes.guaranteedRarity).toBe("LEGENDARY");
      });
   });
});
