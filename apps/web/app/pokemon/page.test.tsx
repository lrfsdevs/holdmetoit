import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import PokemonPage from "./page";
import { listPokemonSpecies } from "@/features/pokemon/data/pokemon-catalogue.repository";
import { isFeatureEnabled } from "@/features/feature-flags/api/server";

vi.mock("@/features/feature-flags/api/server", () => ({
   isFeatureEnabled: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/core/auth", () => ({ auth: vi.fn().mockResolvedValue(null) }));

vi.mock("next/headers", () => ({
   cookies: vi.fn().mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
   }),
}));

vi.mock("@/features/auth/domain/preview-mode", () => ({
   PARTICIPANT_PREVIEW_COOKIE: "holdmetoit_preview_as_participant",
   getEffectiveAdminState: vi.fn().mockReturnValue({ isAdmin: false }),
}));

vi.mock("@/core/db", () => ({
   prisma: { userBannerPity: { findMany: vi.fn() } },
}));

vi.mock("@/features/pokemon/data/pokemon-catalogue.repository", () => ({
   listPokemonSpecies: vi.fn(),
}));

vi.mock("@/features/pokemon/data/user-pokemon.repository", () => ({
   getUserCollectionSummary: vi.fn(),
   getUserPokemonCollection: vi.fn(),
}));

vi.mock("@/features/pokemon/data/acquisition.repository", () => ({
   listBanners: vi.fn(),
}));

vi.mock("@/features/economy/data/wallet.repository", () => ({
   getOrCreateWallet: vi.fn(),
}));

vi.mock("@/features/pokemon/presentation/pokemon-view", () => ({
   PokemonView: () => null,
}));

describe("PokemonPage feature flag", () => {
   it("renders the locked state and skips catalogue loading when off", async () => {
      const page = await PokemonPage({});
      const html = renderToStaticMarkup(page as any);

      expect(html).toContain("Pokémon system is currently unavailable");
      expect(listPokemonSpecies).not.toHaveBeenCalled();
   });

   it("checks the canonical pokemon flag key", async () => {
      await PokemonPage({});

      expect(isFeatureEnabled).toHaveBeenCalledWith("pokemon_system_v1");
   });
});
