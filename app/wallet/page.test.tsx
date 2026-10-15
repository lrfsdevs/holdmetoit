import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import WalletPage from "./page";
import { auth } from "@/core/auth";
import * as walletRepo from "@/features/economy/data/wallet.repository";
import * as ledgerRepo from "@/features/economy/data/ledger.repository";

vi.mock("next/headers", () => ({
   cookies: () => ({
      get: vi.fn(),
   }),
}));

vi.mock("@/core/auth", () => ({
   auth: vi.fn(),
}));

vi.mock("@/features/economy/data/wallet.repository", () => ({
   getWalletSummary: vi.fn(),
}));

vi.mock("@/features/economy/data/ledger.repository", () => ({
   findTransactionsByUserId: vi.fn(),
}));

vi.mock("@/features/ypt/data/ypt.repository", () => ({
   getUserYptId: vi.fn().mockResolvedValue(null),
}));

describe("WalletPage (/wallet)", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   it("renders sign in prompt when unauthenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null as any);

      const page = await WalletPage({});
      const html = renderToStaticMarkup(page);

      expect(html).toContain("Sign In to Access Your Wallet");
      expect(html).toContain("Sign In with Discord");
   });

   it("renders wallet and ledger view when authenticated", async () => {
      vi.mocked(auth).mockResolvedValue({
         user: { id: "user_1", name: "Afnan", role: "PARTICIPANT" },
      } as any);

      vi.mocked(walletRepo.getWalletSummary).mockResolvedValue({
         totalBalance: 250,
         reservedBalance: 50,
         availableBalance: 200,
         rewardProgressSeconds: 18,
         lifetimeEarned: 250,
         lifetimeSpent: 0,
      });

      vi.mocked(ledgerRepo.findTransactionsByUserId).mockResolvedValue({
         transactions: [
            {
               id: "tx_1",
               type: "STUDY_REWARD",
               amount: 100,
               totalDelta: 100,
               reservedDelta: 0,
               description: "Study reward: +100 coins",
               createdAt: new Date("2026-10-15T12:00:00Z"),
            } as any,
         ],
         pagination: { page: 1, limit: 20, totalCount: 1, totalPages: 1 },
      });

      const page = await WalletPage({});
      const html = renderToStaticMarkup(page);

      expect(html).toContain("Virtual Coin Wallet");
      expect(html).toContain("200"); // Available coins
      expect(html).toContain("50"); // Reserved coins
      expect(html).toContain("18s / 36s (50%)"); // Fractional progress
      expect(html).toContain("Study reward: +100 coins");
   });
});
