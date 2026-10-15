import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BannerCard } from "./banner-card";
import { BannerViewModel } from "../../data/acquisition.repository";

vi.mock("@/core/auth", () => ({
   auth: vi.fn(),
   handlers: {},
   signIn: vi.fn(),
   signOut: vi.fn(),
}));

vi.mock("../../api/acquisition.actions", () => ({
   pullPokemonAction: vi.fn(),
}));

vi.mock("@/features/auth/presentation/auth-nav", () => ({
   SignInWithDiscordButton: () =>
      createElement("button", null, "Sign In with Discord to Summon"),
}));

describe("BannerCard Component", () => {
   const sampleBanner: BannerViewModel = {
      id: "banner_mythic_1",
      name: "Apex Mythical Genesis",
      slug: "apex-mythical-genesis",
      description:
         "Summon rare and mythical companions to bolster your study journey.",
      bannerType: "STANDARD",
      status: "ACTIVE",
      startAt: "2026-01-01T00:00:00.000Z",
      endAt: null,
      pullCost: 500,
      allowedQuantities: [1],
      version: 1,
      featuredSpeciesId: null,
      rarityRates: {
         NORMAL: 6000,
         UNCOMMON: 2500,
         RARE: 1000,
         EPIC: 400,
         LEGENDARY: 90,
         MYTHICAL: 10,
      },
      poolFilter: null,
      pityConfig: {
         hardPityThreshold: 50,
         targetRarity: "LEGENDARY",
         resetOnRarities: ["LEGENDARY", "MYTHICAL"],
         featuredGuarantee: true,
      },
      duplicatePolicy: "INCREASE_COUNT",
      totalSpeciesInPool: 151,
      isActive: true,
   };

   it("renders banner title, pull cost, and pity indicator", () => {
      const html = renderToStaticMarkup(
         createElement(BannerCard, {
            banner: sampleBanner,
            userPity: { pityCount: 25, guaranteedFeatured: false },
            userAvailableCoins: 1200,
            isLoggedIn: true,
         })
      );

      expect(html).toContain("Apex Mythical Genesis");
      expect(html).toContain("500");
      expect(html).toContain("Pity Progress");
      expect(html).toContain("25 / 50");
      expect(html).toContain('data-testid="banner-card-apex-mythical-genesis"');
      expect(html).toContain(
         'data-testid="summon-button-apex-mythical-genesis"'
      );
   });

   it("renders login required state when user is not logged in", () => {
      const html = renderToStaticMarkup(
         createElement(BannerCard, {
            banner: sampleBanner,
            userPity: { pityCount: 0, guaranteedFeatured: false },
            userAvailableCoins: 0,
            isLoggedIn: false,
         })
      );

      expect(html).toContain("Sign In with Discord to Summon");
   });

   it("indicates insufficient coins when balance is lower than pull cost", () => {
      const html = renderToStaticMarkup(
         createElement(BannerCard, {
            banner: sampleBanner,
            userPity: { pityCount: 0, guaranteedFeatured: false },
            userAvailableCoins: 200,
            isLoggedIn: true,
         })
      );

      expect(html).toContain("Insufficient Coins (500 required)");
   });
});
