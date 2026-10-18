import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   pullPokemonAction,
   getUserAcquisitionHistoryAction,
   adminCreateBannerAction,
   listActiveBannersAction,
} from "./acquisition.actions";
import { auth } from "@/core/auth";
import { executePokemonAcquisition } from "../data/acquisition.repository";
import { requireAdminUser } from "@/features/auth/api/require-admin";
import { isFeatureEnabled } from "@/features/feature-flags/api/server";
import { prisma } from "@/core/db";

vi.mock("@/core/auth", () => ({
   auth: vi.fn(),
}));

vi.mock("@/features/auth/api/require-admin", () => ({
   requireAdminUser: vi.fn(),
}));

vi.mock("@/features/feature-flags/api/server", () => ({
   isFeatureEnabled: vi.fn().mockResolvedValue(true),
}));

vi.mock("next/cache", () => ({
   revalidatePath: vi.fn(),
}));

vi.mock("../data/acquisition.repository", () => ({
   executePokemonAcquisition: vi.fn(),
   listBanners: vi.fn(),
   findBannerByIdOrSlug: vi.fn(),
   getUserBannerPity: vi.fn(),
}));

vi.mock("../data/acquisition-history.repository", () => ({
   getUserAcquisitionHistory: vi.fn(),
}));

vi.mock("@/core/db", () => ({
   prisma: {
      pokemonBanner: {
         create: vi.fn(),
         update: vi.fn(),
         findUnique: vi.fn(),
      },
   },
}));

describe("Pokemon Acquisition Server Actions", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   describe("pullPokemonAction", () => {
      it("returns FEATURE_DISABLED when the Pokémon system is off", async () => {
         vi.mocked(auth).mockResolvedValue({ user: { id: "user_1" } } as any);
         vi.mocked(isFeatureEnabled).mockResolvedValueOnce(false);

         const result = await pullPokemonAction({
            bannerId: "banner_1",
            idempotencyKey: "idem_1",
         });

         expect(result).toMatchObject({ ok: false, code: "FEATURE_DISABLED" });
         expect(executePokemonAcquisition).not.toHaveBeenCalled();
      });

      it("rejects unauthenticated requests with UNAUTHORIZED", async () => {
         vi.mocked(auth).mockResolvedValue(null as any);

         const result = await pullPokemonAction({
            bannerId: "banner_1",
            idempotencyKey: "key_1",
         });

         expect(result.ok).toBe(false);
         if (!result.ok) {
            expect(result.code).toBe("UNAUTHORIZED");
         }
         expect(executePokemonAcquisition).not.toHaveBeenCalled();
      });

      it("rejects invalid inputs with INVALID_INPUT", async () => {
         vi.mocked(auth).mockResolvedValue({
            user: { id: "usr_1" },
         } as any);

         const result = await pullPokemonAction({
            bannerId: "",
            idempotencyKey: "",
         });

         expect(result.ok).toBe(false);
         if (!result.ok) {
            expect(result.code).toBe("INVALID_INPUT");
         }
      });

      it("successfully delegates to executePokemonAcquisition and returns result", async () => {
         vi.mocked(auth).mockResolvedValue({
            user: { id: "usr_1" },
         } as any);

         const mockAcqResult = {
            acquisitionId: "acq_1",
            bannerId: "banner_1",
            bannerName: "Kanto Starters",
            species: { id: "sp_1", name: "Pikachu", rarity: "UNCOMMON" } as any,
            rarity: "UNCOMMON",
            isFeatured: false,
            isDuplicate: false,
            duplicateOutcome: "NEW_SPECIES_DISCOVERED",
            costPaid: 500,
            newBalance: 4500,
            pityCountBefore: 0,
            pityCountAfter: 1,
            pityTriggered: false,
            isIdempotentReplay: false,
            obtainedAt: new Date().toISOString(),
         };

         vi.mocked(executePokemonAcquisition).mockResolvedValue(mockAcqResult);

         const result = await pullPokemonAction({
            bannerId: "banner_1",
            idempotencyKey: "unique_pull_1",
         });

         expect(result.ok).toBe(true);
         if (result.ok) {
            expect(result.data.acquisitionId).toBe("acq_1");
            expect(result.data.costPaid).toBe(500);
         }
         expect(executePokemonAcquisition).toHaveBeenCalledWith({
            userId: "usr_1",
            bannerId: "banner_1",
            idempotencyKey: "unique_pull_1",
         });
      });
   });

   describe("adminCreateBannerAction", () => {
      it("enforces admin authorization check", async () => {
         vi.mocked(requireAdminUser).mockRejectedValue(
            new Error("Host administrative permissions required.")
         );

         const res = await adminCreateBannerAction({
            name: "Test",
            slug: "test",
            description: "Test",
            status: "DRAFT",
            startAt: new Date().toISOString(),
            pullCost: 500,
            rarityRates: { NORMAL: 10000 },
         } as any);

         expect(res.ok).toBe(false);
      });
   });
});
